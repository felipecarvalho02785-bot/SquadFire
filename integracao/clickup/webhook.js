// ─────────────────────────────────────────────────────────────
// SquadFire · Integração ClickUp — handler de webhook (stub)
// ─────────────────────────────────────────────────────────────
// Reflete em quase-tempo-real mudanças na lista-mestre (task criada/movida/
// atualizada) no CRM. Este arquivo faz: verificar assinatura → identificar a
// task → devolver a Cria mapeada. A persistência fica a cargo do chamador
// (route handler do Next.js, edge function, etc.).
//
// NÃO está deployado ainda — precisa registrar o webhook no ClickUp e plugar
// a gravação no banco. Ver README.md (§ Webhook, PENDENTE DE DEPLOY).

import { createHmac, timingSafeEqual } from 'node:crypto';
import { CLICKUP, getWebhookSecret } from './config.js';
import { getTask } from './client.js';
import { isSquad08, mapTaskToCria } from './sync-crias.js';

// Eventos que nos interessam na lista-mestre.
const EVENTOS_RELEVANTES = new Set([
  'taskCreated',
  'taskUpdated',
  'taskMoved',
  'taskStatusUpdated',
  'taskDeleted',
]);

// Extrai o comentário de um payload taskCommentPosted (formato tolerante: o
// texto pode vir em comment_text, text_content ou no array rico `comment`).
function extrairComentario(payload) {
  const hi = Array.isArray(payload?.history_items) ? payload.history_items[0] : null;
  const c = (hi && hi.comment) || {};
  let texto = c.text_content || c.comment_text || '';
  if (!texto && Array.isArray(c.comment)) texto = c.comment.map((p) => p?.text ?? '').join('');
  const user = (hi && hi.user) || {};
  return {
    id: String(c.id ?? (hi && hi.id) ?? ''),
    texto: String(texto).trim(),
    autor_email: user.email ?? null,
    autor_nome: user.username ?? user.email ?? 'ClickUp',
  };
}

// Verifica a assinatura HMAC-SHA256 que o ClickUp manda no header `X-Signature`.
export function verifySignature(rawBody, signatureHeader) {
  const secret = getWebhookSecret();
  if (!secret) return false; // sem segredo configurado → rejeita por segurança
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signatureHeader || ''), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Processa o payload já parseado. Devolve uma "ação" pro chamador aplicar no DB.
// rawBody + signature são passados pra verificação (chamador tem o corpo cru).
export async function handleWebhook({ rawBody, signature, payload }) {
  if (!verifySignature(rawBody, signature)) {
    return { ok: false, status: 401, reason: 'assinatura inválida' };
  }

  const event = payload?.event;
  const taskId = payload?.task_id;

  // Comentário postado no ClickUp → importa como comentário no CRM. O anti-eco
  // (não reimportar o que o próprio CRM enviou) fica no chamador, pelo id.
  if (event === 'taskCommentPosted' && taskId) {
    return { ok: true, status: 200, action: 'comment', clickup_task_id: taskId, comment: extrairComentario(payload) };
  }

  if (!EVENTOS_RELEVANTES.has(event) || !taskId) {
    return { ok: true, status: 202, action: 'ignore', reason: `evento não tratado: ${event}` };
  }

  if (event === 'taskDeleted') {
    // Não apagamos a Cria — quem consome decide (ex.: marcar como arquivada).
    return { ok: true, status: 200, action: 'delete', clickup_task_id: taskId };
  }

  // Busca o estado atual da task e re-avalia o gate de Squad 08.
  const task = await getTask(taskId);
  const naListaMestre = task?.list?.id === CLICKUP.listaMestre.listId;
  if (!naListaMestre) {
    return { ok: true, status: 202, action: 'ignore', reason: 'task fora da lista-mestre' };
  }
  if (!isSquad08(task)) {
    // Saiu do Squad 08 (ou nunca esteve) → não é Cria; sinaliza remoção do espelho.
    return { ok: true, status: 200, action: 'unlink', clickup_task_id: taskId };
  }

  return { ok: true, status: 200, action: 'upsert', cria: mapTaskToCria(task) };
}
