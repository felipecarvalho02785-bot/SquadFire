import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { faseLabel } from '@/lib/format';
import type { Cria, Papel } from '@/lib/types/database';

// Cores das séries (sólidas, on-brand). Espelham os tokens do design.
export const SERIE = {
  ember: '#ff6a1a',
  good: '#ff7a1f',
  warn: '#ffc531',
  crit: '#e5484d',
  ash: '#6b645f',
} as const;

export interface DonutSeg {
  label: string;
  value: number;
  color: string;
}
export interface CargaItem {
  nome: string;
  valor: number;
}
export interface AlertaItem {
  nivel: 'crit' | 'warn' | 'good';
  tag: string;
  titulo: string;
  sub: string;
  dias: string;
}
export interface RotinaItem {
  titulo: string;
  sub: string;
  done: boolean;
}

export interface CovilDashboard {
  demo: boolean;
  hero: { forjasAtivas: number; noPrazoPct: number; slaEstourando: number; lenhasNaFila: number };
  entregas: number[]; // 12 semanas (mais antiga → mais recente)
  saude: DonutSeg[];
  fases: number[]; // 7 fases (1→7)
  meta: { atual: number; meta: number };
  carga: CargaItem[];
  alertas: AlertaItem[];
  rotina: RotinaItem[];
}

// ── dados de demonstração (sem Supabase): espelham o protótipo, pra mostrar a
// interface populada. Em produção tudo abaixo vem de agregações reais do banco.
function demoDashboard(): CovilDashboard {
  return {
    demo: true,
    hero: { forjasAtivas: 12, noPrazoPct: 83, slaEstourando: 2, lenhasNaFila: 7 },
    entregas: [8, 11, 9, 13, 12, 15, 14, 17, 16, 19, 18, 22],
    saude: [
      { label: 'Em Chamas', value: 6, color: SERIE.good },
      { label: 'Esfriando', value: 3, color: SERIE.warn },
      { label: 'Apagando', value: 2, color: SERIE.crit },
      { label: 'Cinzas', value: 1, color: SERIE.ash },
    ],
    fases: [3, 2, 1, 2, 2, 1, 1],
    meta: { atual: 83, meta: 90 },
    carga: [
      { nome: 'Luiz M.', valor: 14 },
      { nome: 'João B.', valor: 11 },
      { nome: 'Marina A.', valor: 9 },
      { nome: 'Rafa N.', valor: 7 },
    ],
    alertas: [
      { nivel: 'crit', tag: 'Vermelho', titulo: 'Mendes Advocacia Previdenciária', sub: 'Implementação CRM + IA · +2 dias', dias: '-2d' },
      { nivel: 'warn', tag: 'Atenção', titulo: 'Vasconcelos Advocacia', sub: 'Diagnóstico 360 · vence amanhã', dias: '1d' },
      { nivel: 'good', tag: 'No ponto', titulo: 'Ribeiro & Advogados Associados', sub: 'Treinamento Comercial · 4 dias de folga', dias: '4d' },
    ],
    rotina: [
      { titulo: 'Daily com Account e Coordenador', sub: 'coletiva · 09:00', done: true },
      { titulo: 'Relatório de saúde no ClickUp', sub: 'hoje · fim de expediente', done: false },
    ],
  };
}

const vazio: CovilDashboard = {
  demo: false,
  hero: { forjasAtivas: 0, noPrazoPct: 0, slaEstourando: 0, lenhasNaFila: 0 },
  entregas: new Array(12).fill(0),
  saude: [],
  fases: new Array(7).fill(0),
  meta: { atual: 0, meta: 90 },
  carga: [],
  alertas: [],
  rotina: [],
};

// Agrega o Covil a partir de dados reais (RLS: roda como o membro logado).
export async function getCovilDashboard(papel: Papel): Promise<CovilDashboard> {
  if (!isSupabaseConfigured) return demoDashboard();
  const supabase = await getSupabaseServer();

  const { data: criasData } = await supabase.from('cria').select('*');
  const crias = (criasData as Cria[]) ?? [];
  const ativas = crias.filter((c) => c.status === 'ativa');
  const emRisco = ativas.filter((c) => c.em_risco);
  const pausadas = crias.filter((c) => c.status === 'pausada');
  const noPrazoPct = ativas.length ? Math.round(((ativas.length - emRisco.length) / ativas.length) * 100) : 0;

  // Lenhas de Forja em aberto (fila) e concluídas por semana (12 semanas)
  const desde = new Date();
  desde.setDate(desde.getDate() - 7 * 12);
  const [{ count: fila }, { data: concluidas }] = await Promise.all([
    supabase.from('lenha').select('*', { count: 'exact', head: true }).eq('tipo', 'forja').in('status', ['pendente', 'em_andamento']),
    supabase.from('lenha').select('concluida_em').eq('tipo', 'forja').eq('status', 'concluida').gte('concluida_em', desde.toISOString()),
  ]);

  const entregas = new Array(12).fill(0);
  const agora = Date.now();
  for (const l of (concluidas as { concluida_em: string | null }[]) ?? []) {
    if (!l.concluida_em) continue;
    const semanasAtras = Math.floor((agora - new Date(l.concluida_em).getTime()) / (7 * 864e5));
    const idx = 11 - Math.min(11, Math.max(0, semanasAtras));
    entregas[idx] += 1;
  }

  // Distribuição por fase (1→7) das Crias ativas
  const fases = new Array(7).fill(0);
  for (const c of ativas) {
    if (c.clickup_semana && c.clickup_semana >= 1 && c.clickup_semana <= 7) fases[c.clickup_semana - 1] += 1;
  }

  // Saúde das Forjas (só segmentos com valor)
  const saude: DonutSeg[] = [
    { label: 'Em Chamas', value: ativas.length - emRisco.length, color: SERIE.good },
    { label: 'Apagando', value: emRisco.length, color: SERIE.crit },
    { label: 'Cinzas', value: pausadas.length, color: SERIE.ash },
  ].filter((s) => s.value > 0);

  // Carga da Brigada — Lenhas abertas por responsável
  const { data: abertas } = await supabase
    .from('lenha')
    .select('responsavel_id')
    .in('status', ['pendente', 'em_andamento'])
    .not('responsavel_id', 'is', null);
  const contagem = new Map<string, number>();
  for (const l of (abertas as { responsavel_id: string }[]) ?? []) {
    contagem.set(l.responsavel_id, (contagem.get(l.responsavel_id) ?? 0) + 1);
  }
  let carga: CargaItem[] = [];
  if (contagem.size) {
    const { data: membros } = await supabase.from('membro').select('id, nome').in('id', [...contagem.keys()]);
    const nomeDe = new Map((membros as { id: string; nome: string }[] ?? []).map((m) => [m.id, m.nome]));
    carga = [...contagem.entries()]
      .map(([id, valor]) => ({ nome: primeiroUltimo(nomeDe.get(id) ?? '—'), valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }

  // Alertas de SLA — Crias em risco
  const alertas: AlertaItem[] = emRisco.slice(0, 6).map((c) => ({
    nivel: 'crit' as const,
    tag: 'Vermelho',
    titulo: c.nome_cliente,
    sub: faseLabel(c.clickup_semana),
    dias: 'risco',
  }));

  // Rotina do dia — rituais do papel selecionado
  const rotina = await rotinasDoPapel(supabase, papel);

  return {
    demo: false,
    hero: { forjasAtivas: ativas.length, noPrazoPct, slaEstourando: emRisco.length, lenhasNaFila: fila ?? 0 },
    entregas,
    saude,
    fases,
    meta: { atual: noPrazoPct, meta: 90 },
    carga,
    alertas,
    rotina,
  };
}

async function rotinasDoPapel(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  papel: Papel,
): Promise<RotinaItem[]> {
  const { data: rp } = await supabase.from('rotina_papel').select('rotina_id').eq('papel', papel);
  const ids = (rp ?? []).map((r: { rotina_id: string }) => r.rotina_id);
  if (!ids.length) return [];
  const { data: rot } = await supabase
    .from('rotina')
    .select('titulo, recorrencia_tipo')
    .in('id', ids)
    .eq('ativo', true)
    .order('titulo')
    .limit(4);
  const RECOR: Record<string, string> = { diaria: 'todo dia', semanal: 'toda semana', dias_da_semana: 'dias fixos', mensal: 'todo mês', sprint: 'por sprint' };
  return ((rot as { titulo: string; recorrencia_tipo: string }[]) ?? []).map((r) => ({
    titulo: r.titulo,
    sub: RECOR[r.recorrencia_tipo] ?? r.recorrencia_tipo,
    done: false,
  }));
}

function primeiroUltimo(nome: string): string {
  const p = nome.trim().split(/\s+/);
  if (p.length === 1) return p[0];
  return `${p[0]} ${p[p.length - 1][0]}.`;
}

// Pulso da Squad (card da sidebar) — números leves e reais.
export interface Pulso {
  forjasQuentes: number;
  noPrazoPct: number;
}
export async function getPulso(): Promise<Pulso> {
  if (!isSupabaseConfigured) return { forjasQuentes: 3, noPrazoPct: 92 };
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from('cria').select('status, em_risco');
  const crias = (data as { status: string; em_risco: boolean }[]) ?? [];
  const ativas = crias.filter((c) => c.status === 'ativa');
  const emRisco = ativas.filter((c) => c.em_risco).length;
  const noPrazoPct = ativas.length ? Math.round(((ativas.length - emRisco) / ativas.length) * 100) : 0;
  return { forjasQuentes: ativas.length, noPrazoPct };
}
