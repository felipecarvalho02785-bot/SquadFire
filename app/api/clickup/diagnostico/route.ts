import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTaskComments, baixarAnexoUrl, getTask } from '@/integracao/clickup/client.js';
import { dadosDaDescricao, dataInicioDaTask, getSemana } from '@/integracao/clickup/sync-crias.js';
import { resumirDiagnosticoGemini, iaGeminiConfigurada } from '@/lib/ia/gemini';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type Anexo = { url: string; nome: string };
type Bloco = { attachment?: { extension?: string; mimetype?: string; title?: string; url?: string } };
type Comentario = { comment?: Bloco[] };

// Acha o PDF do Diagnóstico nos comentários: primeiro por nome (diagnóstico/360),
// senão qualquer PDF anexado.
function acharDiagnostico(comments: Comentario[]): Anexo | null {
  const pdfs: Anexo[] = [];
  for (const cm of comments ?? []) {
    for (const b of cm.comment ?? []) {
      const a = b.attachment;
      if (a?.url && (a.extension === 'pdf' || a.mimetype === 'application/pdf')) {
        pdfs.push({ url: a.url, nome: a.title ?? 'diagnostico.pdf' });
      }
    }
  }
  return pdfs.find((p) => /diagn|360/i.test(p.nome)) ?? pdfs[0] ?? null;
}

// Puxa o PDF do Diagnóstico 360 do comentário da task do cliente no ClickUp,
// anexa no CRM (Storage) e a Faísca resume. Body: { criaId }.
export async function POST(request: Request) {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ ok: false, error: 'ClickUp não configurado' }, { status: 400 });

  let body: { criaId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'json inválido' }, { status: 400 }); }
  if (!body.criaId) return NextResponse.json({ ok: false, error: 'criaId obrigatório' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: cria } = await admin.from('cria').select('clickup_task_id').eq('id', body.criaId).maybeSingle();
  const taskId = (cria as { clickup_task_id: string | null } | null)?.clickup_task_id;
  if (!taskId) return NextResponse.json({ ok: false, error: 'esta Cria não tem task no ClickUp' });

  // 1) Puxa a task completa: dados do cliente (descrição) + Data inicial + Semana.
  let dadosPuxados = false;
  try {
    const task = await getTask(taskId);
    const dados = dadosDaDescricao(task);
    const patch: Record<string, unknown> = {};
    for (const k of ['email', 'telefone_whatsapp', 'area_atuacao', 'closer'] as const) {
      if (dados?.[k]) patch[k] = dados[k];
    }
    if (Object.keys(patch).length) { await admin.from('cria').update(patch).eq('id', body.criaId); dadosPuxados = true; }
    const dataInicio = dataInicioDaTask(task);
    if (dataInicio) { await admin.rpc('definir_inicio_forja_sync', { p_cria_id: body.criaId, p_data: dataInicio }); dadosPuxados = true; }
    const semana = getSemana(task);
    if (semana) { await admin.rpc('definir_fase_forja_sync', { p_cria_id: body.criaId, p_semana: semana }); dadosPuxados = true; }
  } catch { /* segue pro diagnóstico mesmo se a task falhar */ }

  // 2) Diagnóstico 360 (PDF anexado num comentário)
  let anexo: Anexo | null = null;
  try {
    const cm = (await getTaskComments(taskId)) as { comments?: Comentario[] };
    anexo = acharDiagnostico(cm.comments ?? []);
  } catch { /* sem comentários acessíveis */ }

  if (!anexo) {
    return NextResponse.json({ ok: dadosPuxados, dados: dadosPuxados, diagnostico: false, error: dadosPuxados ? undefined : 'nada novo pra puxar (sem PDF de diagnóstico e sem dados na task)' });
  }

  try {
    const buffer = await baixarAnexoUrl(anexo.url);
    const path = `${body.criaId}/diagnostico-clickup-${Date.now()}.pdf`;
    const up = await admin.storage.from('entregaveis').upload(path, buffer, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw up.error;
    await admin.from('cria').update({ diagnostico_path: path, diagnostico_nome: anexo.nome }).eq('id', body.criaId);

    let resumido = false;
    if (iaGeminiConfigurada()) {
      try {
        const resumo = await resumirDiagnosticoGemini(buffer);
        await admin.from('cria').update({ diagnostico_resumo: resumo }).eq('id', body.criaId);
        resumido = true;
      } catch { /* fica sem resumo */ }
    }
    return NextResponse.json({ ok: true, dados: dadosPuxados, diagnostico: true, nome: anexo.nome, resumido });
  } catch {
    // dados já foram puxados; só o download do PDF falhou
    return NextResponse.json({ ok: dadosPuxados, dados: dadosPuxados, diagnostico: false, error: 'não consegui baixar o PDF do diagnóstico do ClickUp' });
  }
}
