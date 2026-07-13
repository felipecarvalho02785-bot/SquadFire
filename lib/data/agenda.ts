import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

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
function diasDesde(iso: string): number {
  const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : '')).getTime();
  const hoje = new Date(new Date().toDateString()).getTime();
  return Math.floor((hoje - d) / DIA);
}

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

  const dias = diasDesde(f.data_inicio);
  const diaAtual = Math.max(1, dias + 1);

  // Fase ESPERADA hoje = 1ª fase cujo prazo (data_prevista_fim) ainda não passou.
  // Assim respeita a duração real de cada etapa. Sem prazos computados, cai pra
  // aproximação de 7 dias/fase.
  const hoje = new Date(new Date().toDateString()).getTime();
  let faseEsperadaOrdem = 7;
  if (fases.some((x) => x.data_prevista_fim)) {
    const proxima = fases.find((x) => x.data_prevista_fim && new Date(x.data_prevista_fim + 'T23:59:59').getTime() >= hoje);
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
