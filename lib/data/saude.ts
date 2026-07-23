import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { hojeBRT } from '@/lib/datas';

// ── Termômetro de Churn ──────────────────────────────────────────────────────
// Score de saúde 0–100 de uma Cria (quanto MENOR, mais "apagando"), derivado de
// sinais DETERMINÍSTICOS que já vivem no banco — sem coluna nova, sem cron. Dá
// pra confiar: SLA de fase vencido, tempo sem briefing (Roda de Fogo é semanal)
// e Lenhas atrasadas. A satisfação (c2) é texto livre, então fica de fora do
// score automático por enquanto (entra quando for capturada de forma estruturada).

export interface SinaisSaude {
  slaVencido: boolean; // fase com prazo vencido (cria.em_risco)
  diasSemBriefing: number | null; // dias desde o último briefing (null = nenhum)
  lenhasAtrasadas: number; // Lenhas da Forja com prazo vencido e não concluídas
}

export type FaixaSaude = 'chamas' | 'mornando' | 'apagando' | 'brasa';

export interface SaudeScore {
  score: number; // 0–100
  faixa: FaixaSaude;
  label: string; // "Em Chamas" | "Mornando" | "Apagando" | "Brasa Fria"
  kind: 'good' | 'warn' | 'crit';
  motivos: string[]; // por que está apagando (pra mostrar no detalhe)
}

export const FAIXA_META: Record<FaixaSaude, { label: string; kind: 'good' | 'warn' | 'crit' }> = {
  chamas: { label: 'Em Chamas', kind: 'good' },
  mornando: { label: 'Mornando', kind: 'warn' },
  apagando: { label: 'Apagando', kind: 'crit' },
  brasa: { label: 'Brasa Fria', kind: 'crit' },
};

// Cor sólida por faixa (pra gráficos — donut do Covil). Espelha os tokens da UI.
export const FAIXA_COR: Record<FaixaSaude, string> = {
  chamas: '#ff7a1f', // brasa viva (good)
  mornando: '#ffc531', // amarelo (warn)
  apagando: '#e5484d', // vermelho (crit)
  brasa: '#8f1720', // vermelho profundo — o pior
};

// Estados fora da escala de churn (não têm score): Cria pausada/encerrada/backlog.
export type SaudeKind = 'good' | 'warn' | 'crit' | 'dim';
export interface SaudeVM {
  label: string;
  kind: SaudeKind;
  score: number | null; // null = estado especial (sem termômetro)
  faixa: FaixaSaude | 'cinzas' | 'temperada' | 'preforja';
}

// Fonte ÚNICA da saúde de exibição de uma Cria (mesma em toda tela: carteira,
// Fogueira, detalhe, Covil). Estados especiais mantêm a linguagem da casa; Cria
// ativa e na Forja entra no termômetro de churn.
export function saudeVM(
  cria: { status: string; em_risco: boolean; clickup_semana: number | null },
  sinais?: { diasSemBriefing: number | null; lenhasAtrasadas: number },
): SaudeVM {
  if (cria.status === 'pausada') return { label: 'Cinzas', kind: 'dim', score: null, faixa: 'cinzas' };
  if (cria.status === 'encerrada') return { label: 'Temperada', kind: 'dim', score: null, faixa: 'temperada' };
  if (!cria.clickup_semana) return { label: 'Pré-Forja', kind: 'dim', score: null, faixa: 'preforja' };
  const r = scoreSaude({
    slaVencido: cria.em_risco,
    diasSemBriefing: sinais?.diasSemBriefing ?? null,
    lenhasAtrasadas: sinais?.lenhasAtrasadas ?? 0,
  });
  return { label: r.label, kind: r.kind, score: r.score, faixa: r.faixa };
}

// Função PURA — mesma regra na carteira e no detalhe (nada de divergir de novo).
export function scoreSaude(s: SinaisSaude): SaudeScore {
  let score = 100;
  const motivos: string[] = [];

  if (s.slaVencido) {
    score -= 40;
    motivos.push('SLA da fase vencido');
  }

  if (s.diasSemBriefing == null) {
    score -= 10;
    motivos.push('sem briefing registrado');
  } else if (s.diasSemBriefing > 7) {
    // Roda de Fogo é semanal: passou de 7 dias começa a doer (−3/dia, teto −30).
    score -= Math.min(30, (s.diasSemBriefing - 7) * 3);
    motivos.push(`${s.diasSemBriefing} dias sem briefing`);
  }

  if (s.lenhasAtrasadas > 0) {
    score -= Math.min(30, s.lenhasAtrasadas * 8);
    motivos.push(`${s.lenhasAtrasadas} lenha${s.lenhasAtrasadas > 1 ? 's' : ''} atrasada${s.lenhasAtrasadas > 1 ? 's' : ''}`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const faixa: FaixaSaude = score >= 80 ? 'chamas' : score >= 55 ? 'mornando' : score >= 30 ? 'apagando' : 'brasa';
  return { score, faixa, ...FAIXA_META[faixa], motivos };
}

// Sinais em LOTE pra a carteira (2 queries baratas): último briefing por Cria e
// contagem de Lenhas atrasadas por Cria (só as vencidas voltam). O SLA (em_risco)
// já vem na linha da Cria, então o chamador junta ele. Respeita RLS.
export async function getSinaisSaudePorCria(): Promise<Map<string, { diasSemBriefing: number | null; lenhasAtrasadas: number }>> {
  const out = new Map<string, { diasSemBriefing: number | null; lenhasAtrasadas: number }>();
  if (!isSupabaseConfigured) return out;
  const supabase = await getSupabaseServer();
  const hoje = hojeBRT();

  const [{ data: briefs }, { data: lenhas }] = await Promise.all([
    supabase.from('briefing').select('cria_id, created_at').order('created_at', { ascending: false }),
    supabase
      .from('lenha')
      .select('id, fdf:fase_da_forja_id(forja:forja_id(cria_id))')
      .neq('status', 'concluida')
      .not('prazo', 'is', null)
      .lt('prazo', hoje),
  ]);

  // Último briefing por Cria (a query já vem do mais novo pro mais antigo).
  const ultimoBrief = new Map<string, string>();
  for (const b of (briefs as { cria_id: string; created_at: string }[]) ?? []) {
    if (b.cria_id && !ultimoBrief.has(b.cria_id)) ultimoBrief.set(b.cria_id, b.created_at);
  }

  // Lenhas atrasadas por Cria (via fase_da_forja → forja → cria).
  const atrasadas = new Map<string, number>();
  for (const l of (lenhas as unknown as { fdf: { forja: { cria_id: string } | null } | null }[]) ?? []) {
    const cid = l.fdf?.forja?.cria_id;
    if (cid) atrasadas.set(cid, (atrasadas.get(cid) ?? 0) + 1);
  }

  for (const id of new Set<string>([...ultimoBrief.keys(), ...atrasadas.keys()])) {
    const ub = ultimoBrief.get(id);
    const dias = ub ? Math.floor((Date.now() - new Date(ub).getTime()) / 86_400_000) : null;
    out.set(id, { diasSemBriefing: dias, lenhasAtrasadas: atrasadas.get(id) ?? 0 });
  }
  return out;
}
