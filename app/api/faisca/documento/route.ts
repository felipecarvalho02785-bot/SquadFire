import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server';
import { extrairContratoGemini, resumirDiagnosticoGemini, iaGeminiConfigurada } from '@/lib/ia/gemini';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// A Faísca lê o PDF vinculado (contrato ou diagnóstico) e extrai o essencial.
// Body: { criaId, kind: 'contrato'|'diagnostico', path }
// Autorização: a rota grava em contrato/cria via service_role (bypassa RLS),
// então NÃO pode ficar aberta a qualquer membro. Exige Contas/Projetos/Admin,
// e o `path` precisa ser da própria Cria (o storage é por bucket, não por path).
export async function POST(request: Request) {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 });
  if (!iaGeminiConfigurada()) return NextResponse.json({ ok: false, skipped: true, error: 'IA não configurada' });

  let body: { criaId?: string; kind?: string; path?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'json inválido' }, { status: 400 }); }
  const { criaId, kind, path } = body;
  if (!criaId || !path || (kind !== 'contrato' && kind !== 'diagnostico')) {
    return NextResponse.json({ ok: false, error: 'parâmetros inválidos' }, { status: 400 });
  }

  // Gate de papel: Tráfego não dispara a leitura (a rota escreve contrato/cria).
  const supabase = await getSupabaseServer();
  const papeis = new Set<string>((membro.papel_primario ? [membro.papel_primario] : []) as string[]);
  const { data: mp } = await supabase.from('membro_papel').select('papel').eq('membro_id', membro.id);
  ((mp as { papel: string }[] | null) ?? []).forEach((r) => papeis.add(r.papel));
  const autorizado = membro.is_admin || papeis.has('gestor_contas') || papeis.has('gestor_projetos');
  if (!autorizado) return NextResponse.json({ ok: false, error: 'sem permissão para ler documentos desta Cria' }, { status: 403 });

  // O arquivo precisa pertencer a esta Cria (evita ler/gravar arquivo de outra).
  if (path.includes('..') || !path.startsWith(`${criaId}/`)) {
    return NextResponse.json({ ok: false, error: 'arquivo não pertence a esta Cria' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const bucket = kind === 'contrato' ? 'contratos' : 'entregaveis';
  let buffer: Buffer;
  try {
    const { data: file, error } = await admin.storage.from(bucket).download(path);
    if (error || !file) throw error ?? new Error('arquivo não encontrado');
    buffer = Buffer.from(await file.arrayBuffer());
    // Guarda de tamanho: PDF grande estoura os 60s da função.
    if (buffer.length > 15 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'PDF muito grande (máx. ~15 MB) pra Faísca ler agora.' }, { status: 413 });
    }
  } catch (e) {
    console.error('[faisca/documento] download', e);
    return NextResponse.json({ ok: false, error: 'não consegui abrir o PDF agora' }, { status: 502 });
  }

  try {
    if (kind === 'contrato') {
      const { valor, dataInicio, resumo } = await extrairContratoGemini(buffer);
      const { data: ultimo } = await admin.from('contrato').select('id').eq('cria_id', criaId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const contratoId = (ultimo as { id: string } | null)?.id;
      if (contratoId) {
        await admin.from('contrato').update({ valor_contrato: valor, data_inicio_extraida: dataInicio, dados_extraidos: { resumo } }).eq('id', contratoId);
      }
      return NextResponse.json({ ok: true, valor, dataInicio, resumo });
    } else {
      const resumo = await resumirDiagnosticoGemini(buffer);
      await admin.from('cria').update({ diagnostico_resumo: resumo }).eq('id', criaId);
      return NextResponse.json({ ok: true, resumo });
    }
  } catch (e) {
    console.error('[faisca/documento]', e);
    return NextResponse.json({ ok: false, error: 'a IA não conseguiu ler o PDF agora' }, { status: 502 });
  }
}
