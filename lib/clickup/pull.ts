import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTask, getTaskComments, baixarAnexoUrl } from '@/integracao/clickup/client.js';
import { dataInicioDaTask, getSemana } from '@/integracao/clickup/sync-crias.js';
import { extrairDadosClienteGemini, resumirDiagnosticoGemini, iaGeminiConfigurada } from '@/lib/ia/gemini';

// Lógica de "Puxar do ClickUp" de UMA Cria — usada pelo botão da Cria e pelo
// lote (Puxar todos). Puxa: dados do cliente (descrição + comentários, lidos
// pela Faísca) + Data inicial + Semana/fase + comentários do ClickUp (viram
// comentários no CRM) + PDF do diagnóstico. Tudo best-effort, nunca lança.

type Anexo = { url: string; nome: string };
type Bloco = { attachment?: { extension?: string; mimetype?: string; title?: string; url?: string; url_w_query?: string } };
type ClickComment = { id?: string | number; comment?: Bloco[]; comment_text?: string; user?: { email?: string; username?: string } };

export interface PullResult { ok: boolean; dados: boolean; diagnostico: boolean; comentarios: number; error?: string }

function acharDiagnostico(comments: ClickComment[]): Anexo | null {
  const pdfs: Anexo[] = [];
  for (const cm of comments ?? []) {
    for (const b of cm.comment ?? []) {
      const a = b.attachment;
      // Prefere a URL pré-assinada (url_w_query) — baixa direto do S3 sem token.
      const link = a?.url_w_query ?? a?.url;
      if (a && link && (a.extension === 'pdf' || a.mimetype === 'application/pdf')) pdfs.push({ url: link, nome: a.title ?? 'diagnostico.pdf' });
    }
  }
  return pdfs.find((p) => /diagn|360/i.test(p.nome)) ?? pdfs[0] ?? null;
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

// Resolve o autor de um comentário importado: membro pelo e-mail; se não for da
// squad, cai num admin (e o nome do autor vai no corpo).
async function resolverAutor(admin: Admin, email?: string): Promise<{ id: string | null; prefixar: boolean }> {
  if (email) {
    const { data } = await admin.from('membro').select('id').eq('email', email).maybeSingle();
    const id = (data as { id: string } | null)?.id;
    if (id) return { id, prefixar: false };
  }
  const { data: adm } = await admin.from('membro').select('id').eq('ativo', true).order('is_admin', { ascending: false }).limit(1).maybeSingle();
  return { id: (adm as { id: string } | null)?.id ?? null, prefixar: true };
}

// Comentário do ClickUp que é só um nome de arquivo anexado → não vira comentário.
function soAnexo(texto: string): boolean {
  return /^\s*\S+\.(pdf|png|jpe?g|docx?|xlsx?|pptx?)\s*$/i.test(texto);
}

export async function puxarCriaDoClickup(criaId: string): Promise<PullResult> {
  const admin = getSupabaseAdmin();
  const { data: cria } = await admin.from('cria').select('clickup_task_id, email, telefone_whatsapp, area_atuacao, closer').eq('id', criaId).maybeSingle();
  const c = cria as { clickup_task_id: string | null; email: string | null; telefone_whatsapp: string | null; area_atuacao: string | null; closer: string | null } | null;
  const taskId = c?.clickup_task_id;
  if (!taskId) return { ok: false, dados: false, diagnostico: false, comentarios: 0, error: 'sem task no ClickUp' };

  let dados = false;
  const textos: string[] = [];

  // 1) Task: descrição + Data inicial + Semana (fase)
  try {
    const task = await getTask(taskId);
    textos.push(String(task.text_content || task.description || task.markdown_description || ''));
    const di = dataInicioDaTask(task);
    if (di) { await admin.rpc('definir_inicio_forja_sync', { p_cria_id: criaId, p_data: di }); dados = true; }
    const sem = getSemana(task);
    if (sem) { await admin.rpc('definir_fase_forja_sync', { p_cria_id: criaId, p_semana: sem }); dados = true; }
  } catch { /* segue */ }

  // 2) Comentários + acha o PDF do diagnóstico
  let comentarios: ClickComment[] = [];
  let anexo: Anexo | null = null;
  try {
    const cm = (await getTaskComments(taskId)) as { comments?: ClickComment[] };
    comentarios = cm.comments ?? [];
    for (const co of comentarios) if (co.comment_text) textos.push(co.comment_text);
    anexo = acharDiagnostico(comentarios);
  } catch { /* sem comentários */ }

  // 3) Faísca extrai os dados que faltam (só preenche campo VAZIO)
  if (iaGeminiConfigurada() && textos.join('').trim()) {
    try {
      const ex = await extrairDadosClienteGemini(textos.join('\n\n'));
      const patch: Record<string, unknown> = {};
      if (ex.email && !c?.email) patch.email = ex.email;
      if (ex.telefone && !c?.telefone_whatsapp) patch.telefone_whatsapp = ex.telefone;
      if (ex.area_atuacao && !c?.area_atuacao) patch.area_atuacao = ex.area_atuacao;
      if (ex.closer && !c?.closer) patch.closer = ex.closer;
      if (Object.keys(patch).length) { await admin.from('cria').update(patch).eq('id', criaId); dados = true; }
    } catch { /* sem extração */ }
  }

  // 4) Importa os comentários do ClickUp (com texto) → aba Comentários. Anti-eco
  //    pelo clickup_comment_id; pula os que são só anexo.
  let importados = 0;
  for (const co of comentarios) {
    const texto = (co.comment_text ?? '').trim();
    if (texto.length < 3 || soAnexo(texto)) continue;
    const id = co.id != null ? String(co.id) : null;
    if (id) {
      const { data: ex } = await admin.from('comentario').select('id').eq('clickup_comment_id', id).maybeSingle();
      if (ex) continue;
    }
    const autor = await resolverAutor(admin, co.user?.email);
    if (!autor.id) continue;
    const corpo = autor.prefixar ? `${co.user?.username ?? 'ClickUp'}: ${texto}` : texto;
    const { error } = await admin.from('comentario').insert({ cria_id: criaId, autor_id: autor.id, corpo, origem: 'clickup', clickup_comment_id: id });
    if (!error) importados += 1;
  }

  // 5) PDF do diagnóstico
  let diagnostico = false;
  if (anexo) {
    try {
      const buffer = await baixarAnexoUrl(anexo.url);
      const path = `${criaId}/diagnostico-clickup-${Date.now()}.pdf`;
      const up = await admin.storage.from('entregaveis').upload(path, buffer, { contentType: 'application/pdf', upsert: true });
      if (!up.error) {
        await admin.from('cria').update({ diagnostico_path: path, diagnostico_nome: anexo.nome }).eq('id', criaId);
        diagnostico = true;
        if (iaGeminiConfigurada()) {
          try { await admin.from('cria').update({ diagnostico_resumo: await resumirDiagnosticoGemini(buffer) }).eq('id', criaId); } catch { /* sem resumo */ }
        }
      }
    } catch { /* sem download */ }
  }

  return { ok: dados || diagnostico || importados > 0, dados, diagnostico, comentarios: importados };
}
