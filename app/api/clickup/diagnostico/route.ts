import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTaskComments, baixarAnexoUrl, getTask } from '@/integracao/clickup/client.js';
import { dataInicioDaTask, getSemana } from '@/integracao/clickup/sync-crias.js';
import { extrairDadosClienteGemini, resumirDiagnosticoGemini, iaGeminiConfigurada } from '@/lib/ia/gemini';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type Anexo = { url: string; nome: string };
type Bloco = { attachment?: { extension?: string; mimetype?: string; title?: string; url?: string } };
type Comentario = { comment?: Bloco[]; comment_text?: string };

// Acha o PDF do Diagnóstico nos comentários: por nome (diagnóstico/360), senão
// qualquer PDF anexado.
function acharDiagnostico(comments: Comentario[]): Anexo | null {
  const pdfs: Anexo[] = [];
  for (const cm of comments ?? []) {
    for (const b of cm.comment ?? []) {
      const a = b.attachment;
      if (a?.url && (a.extension === 'pdf' || a.mimetype === 'application/pdf')) pdfs.push({ url: a.url, nome: a.title ?? 'diagnostico.pdf' });
    }
  }
  return pdfs.find((p) => /diagn|360/i.test(p.nome)) ?? pdfs[0] ?? null;
}

// "Puxar do ClickUp": puxa TUDO da task do cliente — dados (descrição +
// comentários, lidos pela Faísca) + Data inicial + Semana/fase + PDF do
// diagnóstico. Body: { criaId }.
export async function POST(request: Request) {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ ok: false, error: 'ClickUp não configurado' }, { status: 400 });

  let body: { criaId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'json inválido' }, { status: 400 }); }
  if (!body.criaId) return NextResponse.json({ ok: false, error: 'criaId obrigatório' }, { status: 400 });
  const criaId = body.criaId;

  const admin = getSupabaseAdmin();
  const { data: cria } = await admin.from('cria').select('clickup_task_id, email, telefone_whatsapp, area_atuacao, closer').eq('id', criaId).maybeSingle();
  const c = cria as { clickup_task_id: string | null; email: string | null; telefone_whatsapp: string | null; area_atuacao: string | null; closer: string | null } | null;
  const taskId = c?.clickup_task_id;
  if (!taskId) return NextResponse.json({ ok: false, error: 'esta Cria não tem task no ClickUp' });

  let dadosPuxados = false;
  const textos: string[] = [];

  // 1) Task: descrição + Data inicial + Semana (fase)
  try {
    const task = await getTask(taskId);
    textos.push(String(task.text_content || task.description || task.markdown_description || ''));
    const dataInicio = dataInicioDaTask(task);
    if (dataInicio) { await admin.rpc('definir_inicio_forja_sync', { p_cria_id: criaId, p_data: dataInicio }); dadosPuxados = true; }
    const semana = getSemana(task);
    if (semana) { await admin.rpc('definir_fase_forja_sync', { p_cria_id: criaId, p_semana: semana }); dadosPuxados = true; }
  } catch { /* segue */ }

  // 2) Comentários (relatório de onboarding tem os dados) + acha o PDF
  let anexo: Anexo | null = null;
  try {
    const cm = (await getTaskComments(taskId)) as { comments?: Comentario[] };
    const comentarios = cm.comments ?? [];
    for (const co of comentarios) if (co.comment_text) textos.push(co.comment_text);
    anexo = acharDiagnostico(comentarios);
  } catch { /* sem comentários acessíveis */ }

  // 3) A Faísca lê descrição + comentários e extrai os dados que faltam (só
  //    preenche campo VAZIO no CRM — não sobrescreve o que você já ajustou).
  if (iaGeminiConfigurada() && textos.join('').trim()) {
    try {
      const ex = await extrairDadosClienteGemini(textos.join('\n\n'));
      const patch: Record<string, unknown> = {};
      if (ex.email && !c?.email) patch.email = ex.email;
      if (ex.telefone && !c?.telefone_whatsapp) patch.telefone_whatsapp = ex.telefone;
      if (ex.area_atuacao && !c?.area_atuacao) patch.area_atuacao = ex.area_atuacao;
      if (ex.closer && !c?.closer) patch.closer = ex.closer;
      if (Object.keys(patch).length) { await admin.from('cria').update(patch).eq('id', criaId); dadosPuxados = true; }
    } catch { /* fica sem extração */ }
  }

  // 4) Diagnóstico 360 (PDF)
  if (!anexo) {
    return NextResponse.json({ ok: dadosPuxados, dados: dadosPuxados, diagnostico: false, error: dadosPuxados ? undefined : 'nada novo pra puxar' });
  }
  try {
    const buffer = await baixarAnexoUrl(anexo.url);
    const path = `${criaId}/diagnostico-clickup-${Date.now()}.pdf`;
    const up = await admin.storage.from('entregaveis').upload(path, buffer, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw up.error;
    await admin.from('cria').update({ diagnostico_path: path, diagnostico_nome: anexo.nome }).eq('id', criaId);
    let resumido = false;
    if (iaGeminiConfigurada()) {
      try { await admin.from('cria').update({ diagnostico_resumo: await resumirDiagnosticoGemini(buffer) }).eq('id', criaId); resumido = true; } catch { /* sem resumo */ }
    }
    return NextResponse.json({ ok: true, dados: dadosPuxados, diagnostico: true, nome: anexo.nome, resumido });
  } catch {
    return NextResponse.json({ ok: dadosPuxados, dados: dadosPuxados, diagnostico: false, error: 'não consegui baixar o PDF do diagnóstico do ClickUp' });
  }
}
