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

  // Timeout por chamada + retry com backoff (respeita Retry-After) em 429/5xx —
  // antes um único 429 derrubava o sync inteiro e um upstream lento travava a rota.
  for (let i = 0; ; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: getClickUpToken(), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      // Erro de rede/timeout (AbortError, ECONNRESET) — retenta como 429/5xx em
      // vez de abortar o sync inteiro num blip transitório.
      if (i < 3) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1) + Math.floor(Math.random() * 400)));
        continue;
      }
      throw err;
    }
    clearTimeout(timer);

    if ((res.status === 429 || res.status >= 500) && i < 3) {
      const ra = Number(res.headers.get('retry-after'));
      const espera = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 500 * (i + 1) + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, Math.min(espera, 8000)));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ClickUp ${method} ${path} → ${res.status} ${res.statusText} ${text}`.trim());
    }
    return res.json();
  }
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
    // Teto de páginas (~5000 tasks). Se bater com mais por vir, AVISA — Crias do
    // Squad 08 em páginas seguintes não sincronizariam em silêncio.
    if (page > 50) {
      console.warn(`[clickup] getTasksListaMestre parou no teto de 50 páginas (~${all.length} tasks); pode haver Crias não sincronizadas.`);
      break;
    }
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

// Baixa um anexo do ClickUp pela URL. Anexos ficam no S3 e vêm com URL
// pré-assinada (url_w_query) — o S3 RECUSA (403) se mandarmos o header
// Authorization junto. Por isso tentamos primeiro SEM header (presigned); só se
// falhar caímos pro token (caso seja um endpoint da API que exige auth).
export async function baixarAnexoUrl(url) {
  // Timeout por tentativa — um S3 lento não pode pendurar o lote "Puxar todos"
  // (teto de 60s) num único arquivo.
  const comTimeout = async (init) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  let res = await comTimeout();
  if (!res.ok) res = await comTimeout({ headers: { Authorization: getClickUpToken() } });
  if (!res.ok) throw new Error(`download do anexo falhou → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export { cuFetch };
