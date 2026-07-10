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

export { cuFetch };
