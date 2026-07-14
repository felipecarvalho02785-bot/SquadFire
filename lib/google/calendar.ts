import { getSupabaseAdmin } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { renovarToken, type TokenResp } from '@/lib/google/oauth';

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

export async function statusGoogle(membroId: string): Promise<{ conectado: boolean; email: string | null }> {
  if (!isSupabaseConfigured) return { conectado: false, email: null };
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('integracao_google').select('email').eq('membro_id', membroId).maybeSingle();
    return { conectado: !!data, email: (data as { email: string | null } | null)?.email ?? null };
  } catch {
    return { conectado: false, email: null };
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
  const res = await fetch(`${CAL}?${p.toString()}`, { headers: { authorization: `Bearer ${token}` } });
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
  const res = await fetch(eventId ? CAL_EVENT(eventId) : CAL, {
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

type FaseSync = { id: string; ordem: number; data_prevista_fim: string | null; fase: { nome: string } | null; forja: { cria: { nome_cliente: string; status: string } | null } | null };

// Empurra os prazos das fases (linha do tempo de cada Cria ativa) pro Google
// Agenda do membro, de hoje pra frente. Idempotente via google_evento_sync:
// re-rodar ATUALIZA os eventos em vez de duplicar.
export async function sincronizarFasesGoogle(membroId: string): Promise<{ ok: boolean; total: number; error?: string }> {
  const admin = getSupabaseAdmin();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from('fase_da_forja')
    .select('id, ordem, data_prevista_fim, fase:fase_id(nome), forja:forja_id(cria:cria_id(nome_cliente, status))')
    .not('data_prevista_fim', 'is', null)
    .gte('data_prevista_fim', hoje);
  const rows = (data as unknown as FaseSync[]) ?? [];

  const { data: mapData } = await admin.from('google_evento_sync').select('ref_id, google_event_id').eq('membro_id', membroId).eq('ref_tipo', 'fase');
  const mapa = new Map(((mapData as { ref_id: string; google_event_id: string }[]) ?? []).map((m) => [m.ref_id, m.google_event_id]));

  let total = 0;
  for (const r of rows) {
    const cria = r.forja?.cria;
    if (!cria || cria.status !== 'ativa' || !r.data_prevista_fim) continue;
    const titulo = `Prazo Fase ${r.ordem} · ${cria.nome_cliente}`;
    const descricao = `${r.fase?.nome ?? 'Fase'} — Estruturação (SquadFire)`;
    const res = await upsertEventoDia(membroId, mapa.get(r.id) ?? null, { titulo, descricao, dia: r.data_prevista_fim });
    if (!res.ok) return { ok: false, total, error: res.error };
    if (res.id) {
      await admin.from('google_evento_sync').upsert(
        { membro_id: membroId, ref_tipo: 'fase', ref_id: r.id, google_event_id: res.id, atualizado_em: new Date().toISOString() },
        { onConflict: 'membro_id,ref_tipo,ref_id' },
      );
      total += 1;
    }
  }
  return { ok: true, total };
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
