import { getSupabaseAdmin } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { renovarToken, type TokenResp } from '@/lib/google/oauth';
import { hojeBRT } from '@/lib/datas';

const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

interface TokenRow { access_token: string; refresh_token: string | null; expiry: string | null; email: string | null }

// Guarda (upsert) os tokens de um membro. Chamado no callback do OAuth.
export async function salvarTokens(membroId: string, t: TokenResp, email: string | null): Promise<void> {
  const admin = getSupabaseAdmin();
  const expiry = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  const patch: Record<string, unknown> = { membro_id: membroId, access_token: t.access_token, expiry, scope: t.scope ?? null, email };
  if (t.refresh_token) patch.refresh_token = t.refresh_token; // só vem na 1ª vez
  await admin.from('integracao_google').upsert(patch, { onConflict: 'membro_id' });
}

export async function statusGoogle(membroId: string): Promise<{ conectado: boolean; email: string | null; precisaReconectar: boolean }> {
  if (!isSupabaseConfigured) return { conectado: false, email: null, precisaReconectar: false };
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('integracao_google').select('email, refresh_token').eq('membro_id', membroId).maybeSingle();
    const row = data as { email: string | null; refresh_token: string | null } | null;
    // "conectado" = existe linha; mas sem refresh_token não dá pra renovar o
    // acesso → sinaliza reconectar (senão a agenda fica vazia sem explicação).
    return { conectado: !!row, email: row?.email ?? null, precisaReconectar: !!row && !row.refresh_token };
  } catch {
    return { conectado: false, email: null, precisaReconectar: false };
  }
}

export async function desconectarGoogle(membroId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from('integracao_google').delete().eq('membro_id', membroId);
}

// Access token válido: renova via refresh_token se estiver expirado.
async function accessTokenValido(membroId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('integracao_google').select('access_token, refresh_token, expiry, email').eq('membro_id', membroId).maybeSingle();
  const row = data as TokenRow | null;
  if (!row) return null;
  const expirado = !row.expiry || new Date(row.expiry).getTime() < Date.now();
  if (!expirado) return row.access_token;
  if (!row.refresh_token) return null; // sem refresh → precisa reconectar
  const novo = await renovarToken(row.refresh_token);
  await salvarTokens(membroId, novo, row.email);
  return novo.access_token;
}

export interface GEvento { id: string; titulo: string; inicio: string | null; allDay: boolean }

// Eventos do Google Agenda do membro num intervalo (para o Calendário).
export async function listarEventos(membroId: string, timeMinISO: string, timeMaxISO: string): Promise<GEvento[]> {
  const token = await accessTokenValido(membroId);
  if (!token) return [];
  const p = new URLSearchParams({ timeMin: timeMinISO, timeMax: timeMaxISO, singleEvents: 'true', orderBy: 'startTime', maxResults: '50' });
  const res = await gfetch(`${CAL}?${p.toString()}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const j = (await res.json()) as { items?: { id: string; summary?: string; start?: { dateTime?: string; date?: string } }[] };
  return (j.items ?? []).map((e) => ({
    id: e.id,
    titulo: e.summary ?? '(sem título)',
    inicio: e.start?.dateTime ?? e.start?.date ?? null,
    allDay: !e.start?.dateTime,
  }));
}

const CAL_EVENT = (id: string) => `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`;

// fetch pro Google com timeout (evita rota travada num upstream lento) e retry
// com backoff+jitter em 429/5xx transitório (antes qualquer 429 era fatal).
async function gfetch(url: string, init: RequestInit, tentativas = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if ((res.status === 429 || res.status >= 500) && i < tentativas - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1) + Math.floor(300 * Math.random())));
      continue;
    }
    return res;
  }
}

function proximoDia(dia: string): string {
  const d = new Date(dia + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Cria/atualiza um evento de DIA INTEIRO no Google. Com eventId → PATCH; sem →
// POST. Se o PATCH der 404 (evento apagado no Google), recria. Retorna o id.
async function upsertEventoDia(membroId: string, eventId: string | null, ev: { titulo: string; descricao?: string; dia: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = await accessTokenValido(membroId);
  if (!token) return { ok: false, error: 'Google Agenda não conectado (ou precisa reconectar).' };
  const body = { summary: ev.titulo, description: ev.descricao ?? '', start: { date: ev.dia }, end: { date: proximoDia(ev.dia) } };
  const res = await gfetch(eventId ? CAL_EVENT(eventId) : CAL, {
    method: eventId ? 'PATCH' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (eventId && res.status === 404) return upsertEventoDia(membroId, null, ev);
    return { ok: false, error: `Google recusou (${res.status})` };
  }
  const j = (await res.json()) as { id?: string };
  return { ok: true, id: j.id };
}

const DOW_RRULE: Record<string, string> = { dom: 'SU', seg: 'MO', ter: 'TU', qua: 'WE', qui: 'TH', sex: 'FR', sab: 'SA' };

// Traduz a recorrência do ritual (CRM) para uma RRULE do Google.
function rruleDoRitual(tipo: string, cfg: Record<string, unknown>): string | null {
  switch (tipo) {
    case 'diaria': return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'; // dias úteis
    case 'semanal': { const d = DOW_RRULE[String(cfg.dia)]; return d ? `RRULE:FREQ=WEEKLY;BYDAY=${d}` : null; }
    case 'dias_da_semana': {
      const ds = (Array.isArray(cfg.dias) ? (cfg.dias as string[]) : []).map((x) => DOW_RRULE[x]).filter(Boolean);
      return ds.length ? `RRULE:FREQ=WEEKLY;BYDAY=${ds.join(',')}` : null;
    }
    case 'mensal': return cfg.dia_mes ? `RRULE:FREQ=MONTHLY;BYMONTHDAY=${Number(cfg.dia_mes)}` : null;
    default: return null;
  }
}

// Cria/atualiza um evento RECORRENTE de dia inteiro. No update (PATCH) NÃO
// mexe no start/end — assim, se você ajustou o horário no Google, ele fica.
async function upsertEventoRecorrente(membroId: string, eventId: string | null, ev: { titulo: string; descricao?: string; rrule: string; dia: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = await accessTokenValido(membroId);
  if (!token) return { ok: false, error: 'Google Agenda não conectado (ou precisa reconectar).' };
  const base = { summary: ev.titulo, description: ev.descricao ?? '', recurrence: [ev.rrule] };
  const body = eventId ? base : { ...base, start: { date: ev.dia }, end: { date: proximoDia(ev.dia) } };
  const res = await gfetch(eventId ? CAL_EVENT(eventId) : CAL, {
    method: eventId ? 'PATCH' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (eventId && res.status === 404) return upsertEventoRecorrente(membroId, null, ev);
    return { ok: false, error: `Google recusou (${res.status})` };
  }
  const j = (await res.json()) as { id?: string };
  return { ok: true, id: j.id };
}

type FaseSync = { id: string; ordem: number; data_prevista_fim: string | null; fase: { nome: string } | null; forja: { cria: { nome_cliente: string; status: string } | null } | null };
type RotinaSync = { id: string; titulo: string; recorrencia_tipo: string; recorrencia_config: Record<string, unknown> };

// Empurra a agenda do CRM pro Google Agenda do membro: prazos das fases (linha
// do tempo de cada Cria ativa, de hoje pra frente) + rituais recorrentes.
// Idempotente via google_evento_sync: re-rodar ATUALIZA em vez de duplicar.
export async function sincronizarAgendaGoogle(membroId: string): Promise<{ ok: boolean; total: number; erros?: number; error?: string }> {
  const admin = getSupabaseAdmin();
  const hoje = hojeBRT();
  const erros: string[] = [];

  const { data: mapData } = await admin.from('google_evento_sync').select('ref_tipo, ref_id, google_event_id').eq('membro_id', membroId);
  const mapa = new Map(((mapData as { ref_tipo: string; ref_id: string; google_event_id: string }[]) ?? []).map((m) => [`${m.ref_tipo}:${m.ref_id}`, m.google_event_id]));
  const desejados = new Set<string>(); // refs que DEVEM existir nesta sync
  let total = 0;

  async function gravar(tipo: string, ref: string, eventId: string) {
    await admin.from('google_evento_sync').upsert(
      { membro_id: membroId, ref_tipo: tipo, ref_id: ref, google_event_id: eventId, atualizado_em: new Date().toISOString() },
      { onConflict: 'membro_id,ref_tipo,ref_id' },
    );
    total += 1;
  }

  // 1) Prazos das fases (eventos de dia único)
  const { data: fasesData } = await admin
    .from('fase_da_forja')
    .select('id, ordem, data_prevista_fim, fase:fase_id(nome), forja:forja_id(cria:cria_id(nome_cliente, status))')
    .not('data_prevista_fim', 'is', null)
    .gte('data_prevista_fim', hoje);
  for (const r of (fasesData as unknown as FaseSync[]) ?? []) {
    const cria = r.forja?.cria;
    if (!cria || cria.status !== 'ativa' || !r.data_prevista_fim) continue;
    desejados.add(`fase:${r.id}`);
    const res = await upsertEventoDia(membroId, mapa.get(`fase:${r.id}`) ?? null, {
      titulo: `Prazo Fase ${r.ordem} · ${cria.nome_cliente}`,
      descricao: `${r.fase?.nome ?? 'Fase'} — Estruturação (SquadFire)`,
      dia: r.data_prevista_fim,
    });
    if (!res.ok) { erros.push(res.error ?? 'falha'); continue; } // não aborta os demais
    if (res.id) await gravar('fase', r.id, res.id);
  }

  // 2) Rituais recorrentes (eventos com RRULE)
  const { data: rotData } = await admin.from('rotina').select('id, titulo, recorrencia_tipo, recorrencia_config').eq('ativo', true);
  for (const r of (rotData as RotinaSync[]) ?? []) {
    const rrule = rruleDoRitual(r.recorrencia_tipo, r.recorrencia_config ?? {});
    if (!rrule) continue;
    desejados.add(`ritual:${r.id}`);
    const res = await upsertEventoRecorrente(membroId, mapa.get(`ritual:${r.id}`) ?? null, {
      titulo: `Ritual · ${r.titulo}`,
      descricao: 'Rotina recorrente (SquadFire)',
      rrule,
      dia: hoje,
    });
    if (!res.ok) { erros.push(res.error ?? 'falha'); continue; } // não aborta os demais
    if (res.id) await gravar('ritual', r.id, res.id);
  }

  // 3) Apaga órfãos: eventos mapeados que não são mais desejados (fase que
  // passou, Cria inativa, rotina desativada). Sem isso, viram fantasmas eternos
  // na agenda. Só apaga se a sync não teve erro (senão poderia apagar por engano
  // um evento cuja origem só falhou de ler agora).
  if (!erros.length) {
    for (const [chave, eventId] of mapa) {
      if (desejados.has(chave)) continue;
      const [tipo, ref] = chave.split(':');
      try {
        const token = await accessTokenValido(membroId);
        if (token) await gfetch(CAL_EVENT(eventId), { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
      } catch { /* segue: remove o vínculo mesmo se o Google já não tiver o evento */ }
      await admin.from('google_evento_sync').delete().eq('membro_id', membroId).eq('ref_tipo', tipo).eq('ref_id', ref);
    }
  }

  // Sucesso se algo sincronizou ou não houve erro; falha total só quando nada
  // entrou e todas as tentativas falharam (ex.: token inválido / reconectar).
  const ok = total > 0 || erros.length === 0;
  return { ok, total, erros: erros.length, error: erros.length ? `${erros.length} evento(s) falharam: ${erros[0]}` : undefined };
}

// Sincroniza a agenda de TODOS os membros que conectaram o Google (pro cron
// diário). Best-effort por membro — a falha de um não derruba os outros.
export async function sincronizarTodosGoogle(): Promise<{ membros: number; eventos: number; parciais: number }> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('integracao_google').select('membro_id');
  const ids = ((data as { membro_id: string }[]) ?? []).map((m) => m.membro_id);
  // Orçamento de tempo: a função tem teto de 60s no plano Hobby. Sincroniza
  // quantos membros couberem e para; o resto entra no próximo cron (idempotente).
  const limite = Date.now() + 40_000;
  let eventos = 0, feitos = 0;
  for (const id of ids) {
    if (Date.now() > limite) break;
    try { const r = await sincronizarAgendaGoogle(id); eventos += r.total; } catch { /* segue */ }
    feitos += 1;
  }
  return { membros: ids.length, eventos, parciais: Math.max(0, ids.length - feitos) };
}

// Cria um evento (ex.: agendar a Roda de Fogo). Retorna o link do evento.
export async function criarEvento(
  membroId: string,
  ev: { titulo: string; descricao?: string; inicioISO: string; fimISO: string },
): Promise<{ ok: boolean; htmlLink?: string; error?: string }> {
  const token = await accessTokenValido(membroId);
  if (!token) return { ok: false, error: 'Google Agenda não conectado (ou precisa reconectar).' };
  const res = await fetch(CAL, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      summary: ev.titulo,
      description: ev.descricao ?? '',
      start: { dateTime: ev.inicioISO, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: ev.fimISO, timeZone: 'America/Sao_Paulo' },
    }),
  });
  if (!res.ok) return { ok: false, error: `Google recusou: ${await res.text()}` };
  const j = (await res.json()) as { htmlLink?: string };
  return { ok: true, htmlLink: j.htmlLink };
}
