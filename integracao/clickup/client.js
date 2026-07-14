// ─────────────────────────────────────────────────────────────
// SquadFire · Integração ClickUp — cliente HTTP da API v2
// ─────────────────────────────────────────────────────────────
// Fininho de propósito: só o que o sync das Crias precisa.
// Usa fetch global (Node ≥ 18). Token via env (config.getClickUpToken).

import { CLICKUP, getClickUpToken } from './config.js';

async function cuFetch(path, { method = 'GET', query, body } = {}) {
  const url = new URL(CLICKUP.apiBase + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
      else url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: getClickUpToken(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ClickUp ${method} ${path} → ${res.status} ${res.statusText} ${text}`.trim());
  }
  return res.json();
}

// Puxa TODAS as tasks da lista-mestre (paginado; inclui custom fields).
// A API não filtra por custom field, então trazemos tudo e filtramos por Squad no sync.
export async function getTasksListaMestre({ includeClosed = true } = {}) {
  const { listId } = CLICKUP.listaMestre;
  const all = [];
  let page = 0;
  // ClickUp devolve `last_page` quando acabou.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await cuFetch(`/list/${listId}/task`, {
      query: {
        page,
        include_closed: includeClosed,
        subtasks: false,
        // custom fields vêm por padrão no payload de task da lista
      },
    });
    const tasks = data.tasks || [];
    all.push(...tasks);
    if (data.last_page || tasks.length === 0) break;
    page += 1;
    if (page > 50) break; // guarda-chuva contra loop infinito
  }
  return all;
}

// Detalhe de uma task específica (usado pelo webhook, que só manda o id).
export async function getTask(taskId) {
  return cuFetch(`/task/${taskId}`, { query: { include_subtasks: false } });
}

// Cria um comentário numa task (usado pelo push do briefing: CRM → ClickUp).
// Devolve { id, ... } — guardar o id em briefing.clickup_comment_id.
export async function createTaskComment(taskId, commentText, { notifyAll = false } = {}) {
  return cuFetch(`/task/${taskId}/comment`, {
    method: 'POST',
    body: { comment_text: commentText, notify_all: notifyAll },
  });
}

// Registra um webhook do ClickUp apontando pra nossa rota (ClickUp → CRM, em
// tempo real). Escuta a lista-mestre. Devolve { id, webhook: { secret, ... } } —
// o `secret` vai pra env CLICKUP_WEBHOOK_SECRET (assinatura HMAC dos eventos).
export async function createWebhook(endpoint, events) {
  const { teamId, listaMestre } = CLICKUP;
  return cuFetch(`/team/${teamId}/webhook`, {
    method: 'POST',
    body: { endpoint, events, list_id: listaMestre.listId },
  });
}

// Lista os webhooks já registrados no time (diagnóstico / evitar duplicar).
export async function listWebhooks() {
  const { teamId } = CLICKUP;
  return cuFetch(`/team/${teamId}/webhook`);
}

// Comentários de uma task (inclui anexos nos blocos). Usado pra puxar o PDF do
// Diagnóstico 360 que o time anexou no comentário da task do cliente.
export async function getTaskComments(taskId) {
  return cuFetch(`/task/${taskId}/comment`);
}

// Baixa um anexo do ClickUp pela URL. Tenta com o token; se recusar, tenta sem
// header (a URL pode já vir acessível). Devolve um Buffer.
export async function baixarAnexoUrl(url) {
  let res = await fetch(url, { headers: { Authorization: getClickUpToken() } });
  if (!res.ok) res = await fetch(url);
  if (!res.ok) throw new Error(`download do anexo falhou → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export { cuFetch };
