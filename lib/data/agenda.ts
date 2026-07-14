import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { hojeBRT, diasDesdeBRT } from '@/lib/datas';

// Materializa as Lenhas de Rotina de hoje (idempotente) — pra os rituais
// aparecerem como tarefas de verdade mesmo antes do cron diário rodar.
export async function garantirRituaisHoje(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await getSupabaseAdmin().rpc('gerar_lenhas_do_dia');
  } catch {
    /* sem service_role ou falha — o cron diário cobre de qualquer forma */
  }
}

const FASES_NOMES = ['Alinhamento', 'Diagnóstico 360', 'Treinamento', 'Consultoria', 'Implementação CRM + IA', 'Auditoria de Mídia', 'Auditoria Criativa'];

export type SlaStatus = 'sem_inicio' | 'no_prazo' | 'atrasada' | 'concluida';

export interface ForjaTimeline {
  criaId: string;
  nome: string;
  dataInicio: string | null;
  diaAtual: number | null;
  faseAtualOrdem: number;
  faseAtualNome: string;
  faseEsperadaOrdem: number | null;
  prazoFaseAtual: string | null;
  sla: SlaStatus;
}

const DIA = 86400000;

type FaseRow = { id: string; ordem: number; data_prevista_fim: string | null; status: string; fase: { nome: string } | null };
type ForjaRow = { id: string; data_inicio: string | null; fase_atual_id: string | null; concluida: boolean; cria: { id: string; nome_cliente: string; status: string } | null; fases: FaseRow[] };

function montar(f: ForjaRow): ForjaTimeline | null {
  const cria = f.cria;
  if (!cria || cria.status !== 'ativa') return null;
  const fases = (f.fases ?? []).slice().sort((a, b) => a.ordem - b.ordem);

  // Progresso REAL = fases efetivamente concluídas (não o ponteiro manual, que
  // pode vir adiantado do ClickUp). A fase "em curso" é a próxima da concluída.
  const concluidas = fases.filter((x) => x.status === 'concluida').length;
  const faseAtualOrdem = Math.min(7, concluidas + 1);
  const faseAtualNome = fases[faseAtualOrdem - 1]?.fase?.nome ?? FASES_NOMES[faseAtualOrdem - 1] ?? '—';
  const prazoFaseAtual = fases[faseAtualOrdem - 1]?.data_prevista_fim ?? null;

  if (f.concluida || concluidas >= 7) {
    return { criaId: cria.id, nome: cria.nome_cliente, dataInicio: f.data_inicio, diaAtual: 49, faseAtualOrdem: 7, faseAtualNome: FASES_NOMES[6], faseEsperadaOrdem: 7, prazoFaseAtual: null, sla: 'concluida' };
  }
  if (!f.data_inicio) {
    return { criaId: cria.id, nome: cria.nome_cliente, dataInicio: null, diaAtual: null, faseAtualOrdem, faseAtualNome, faseEsperadaOrdem: null, prazoFaseAtual: null, sla: 'sem_inicio' };
  }

  const dias = diasDesdeBRT(f.data_inicio);
  const diaAtual = Math.max(1, dias + 1);

  // Fase ESPERADA hoje = 1ª fase cujo prazo (data_prevista_fim) ainda não passou.
  // Assim respeita a duração real de cada etapa. Sem prazos computados, cai pra
  // aproximação de 7 dias/fase. Compara datas civis (BRT) — não instantes UTC.
  const hojeStr = hojeBRT();
  let faseEsperadaOrdem = 7;
  if (fases.some((x) => x.data_prevista_fim)) {
    const proxima = fases.find((x) => x.data_prevista_fim && x.data_prevista_fim >= hojeStr);
    faseEsperadaOrdem = proxima?.ordem ?? 7;
  } else {
    faseEsperadaOrdem = Math.min(7, Math.max(1, Math.ceil(diaAtual / 7)));
  }

  // Atrasada quando o progresso real está atrás do que a data manda.
  const sla: SlaStatus = faseAtualOrdem < faseEsperadaOrdem ? 'atrasada' : 'no_prazo';
  return { criaId: cria.id, nome: cria.nome_cliente, dataInicio: f.data_inicio, diaAtual: Math.min(49, diaAtual), faseAtualOrdem, faseAtualNome, faseEsperadaOrdem, prazoFaseAtual, sla };
}

function demo(): ForjaTimeline[] {
  const hoje = new Date();
  const mk = (nome: string, offsetDias: number, faseAtual: number): ForjaTimeline => {
    const inicio = new Date(hoje.getTime() - offsetDias * DIA);
    const diaAtual = Math.min(49, offsetDias + 1);
    const faseEsperada = Math.min(7, Math.max(1, Math.ceil(diaAtual / 7)));
    const prazo = new Date(inicio.getTime() + faseAtual * 7 * DIA);
    return { criaId: nome.toLowerCase().replace(/\W+/g, '-'), nome, dataInicio: inicio.toISOString().slice(0, 10), diaAtual, faseAtualOrdem: faseAtual, faseAtualNome: FASES_NOMES[faseAtual - 1], faseEsperadaOrdem: faseEsperada, prazoFaseAtual: prazo.toISOString().slice(0, 10), sla: faseAtual < faseEsperada ? 'atrasada' : 'no_prazo' };
  };
  return [
    mk('M. Oliveira Sociedade de Advogados', 4, 1),
    mk('Edi Carlos Advocacia', 11, 2),
    mk('Letícia Stein Carlos de Souza', 17, 2),
    mk('Mozini Advocacia', 16, 3),
    mk('Mendes Advocacia Previdenciária', 30, 5),
  ];
}

// ── Rituais (rotinas) projetados no calendário ─────────────────────────────
const DOW_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

type RotinaRow = { titulo: string; recorrencia_tipo: string; recorrencia_config: Record<string, unknown> };

function rotinasDemo(): RotinaRow[] {
  return [
    { titulo: 'Daily (alinhamento interno)', recorrencia_tipo: 'diaria', recorrencia_config: {} },
    { titulo: 'Relatório diário das tarefas', recorrencia_tipo: 'diaria', recorrencia_config: {} },
    { titulo: 'Check-in com cada Cria', recorrencia_tipo: 'semanal', recorrencia_config: { dia: 'seg' } },
    { titulo: 'Envio de relatórios pelo criativo', recorrencia_tipo: 'semanal', recorrencia_config: { dia: 'seg' } },
    { titulo: 'Relatório de saúde do projeto (ClickUp)', recorrencia_tipo: 'semanal', recorrencia_config: { dia: 'qui' } },
    { titulo: 'Weekly (alinhamento da squad)', recorrencia_tipo: 'semanal', recorrencia_config: { dia: 'sex' } },
    { titulo: 'Planilha BSC', recorrencia_tipo: 'semanal', recorrencia_config: { dia: 'sex' } },
  ];
}

// Fira uma rotina num dia específico? Espelha app.gerar_lenhas_do_dia.
function fira(r: RotinaRow, d: Date): boolean {
  const cfg = r.recorrencia_config ?? {};
  const dow = d.getDay();
  const diaTxt = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][dow];
  switch (r.recorrencia_tipo) {
    case 'diaria': return dow >= 1 && dow <= 5; // dias úteis (seg–sex)
    case 'semanal': return DOW_MAP[String(cfg.dia)] === dow;
    case 'dias_da_semana': return Array.isArray(cfg.dias) && (cfg.dias as string[]).includes(diaTxt);
    case 'mensal': return d.getDate() === Number(cfg.dia_mes);
    default: return false;
  }
}

export interface RituaisMes {
  porDia: Record<number, string[]>; // rituais semanais/mensais pontuados no dia
  diarios: string[]; // rituais diários (todo dia útil) — listados à parte
}

// Projeta as rotinas ativas nos dias do mês (cada uma no seu dia da semana).
export async function getRituaisDoMes(year: number, month: number): Promise<RituaisMes> {
  let rotinas: RotinaRow[];
  if (!isSupabaseConfigured) {
    rotinas = rotinasDemo();
  } else {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.from('rotina').select('titulo, recorrencia_tipo, recorrencia_config').eq('ativo', true);
    rotinas = (data as RotinaRow[]) ?? [];
  }

  const diarios = rotinas.filter((r) => r.recorrencia_tipo === 'diaria').map((r) => r.titulo);
  const periodicas = rotinas.filter((r) => r.recorrencia_tipo !== 'diaria');
  const porDia: Record<number, string[]> = {};
  const diasNoMes = new Date(year, month + 1, 0).getDate();
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const d = new Date(year, month, dia);
    for (const r of periodicas) {
      if (fira(r, d)) (porDia[dia] ??= []).push(r.titulo);
    }
  }
  return { porDia, diarios };
}

// Linha do tempo das Forjas ativas: em que fase/dia cada Cria está e o SLA
// (comparando a fase esperada pela data de início com a fase real).
export async function getForjasTimeline(): Promise<ForjaTimeline[]> {
  if (!isSupabaseConfigured) return demo();
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('forja')
    .select('id, data_inicio, fase_atual_id, concluida, cria:cria_id(id, nome_cliente, status), fases:fase_da_forja(id, ordem, data_prevista_fim, status, fase:fase_id(nome))');
  const rows = (data as unknown as ForjaRow[]) ?? [];
  return rows.map(montar).filter((x): x is ForjaTimeline => x !== null).sort((a, b) => {
    const rank = { atrasada: 0, no_prazo: 1, sem_inicio: 2, concluida: 3 };
    return rank[a.sla] - rank[b.sla] || (b.diaAtual ?? 0) - (a.diaAtual ?? 0);
  });
}
