import { Topbar } from '@/components/Topbar';
import { TarefasClient, type TaskRow, type MembroOpt } from '@/components/TarefasClient';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getCurrentMembro } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { iniciais } from '@/lib/format';
import { hojeBRT, diasDesdeBRT } from '@/lib/datas';
import type { Lenha, Membro } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

const DEMO_MEMBROS: MembroOpt[] = [
  { id: 'm1', nome: 'Felipe Carvalho' },
  { id: 'm2', nome: 'Luiz Mattos' },
  { id: 'm3', nome: 'João Bernardes' },
  { id: 'm4', nome: 'Marina Alves' },
];

const DEMO: TaskRow[] = [
  { id: 'd1', titulo: 'Coletar briefing semanal · Letícia Stein', sub: 'Fase 3 · Treinamento', tipo: 'forja', who: 'FC', whoNome: 'Felipe Carvalho', due: 'hoje', dueKind: 'crit', done: false },
  { id: 'd2', titulo: 'Revisar Diagnóstico 360 · Edi Carlos', sub: 'Fase 2 · entrega da consultoria', tipo: 'forja', who: 'LM', whoNome: 'Luiz Mattos', due: '1d', dueKind: 'warn', done: false },
  { id: 'd3', titulo: 'Ligar para o closer sobre a proposta', sub: 'tarefa do dia', tipo: 'avulsa', who: 'FC', whoNome: 'Felipe Carvalho', due: 'hoje', dueKind: '', done: false },
  { id: 'd4', titulo: 'Relatório diário das tarefas', sub: 'fim de expediente', tipo: 'rotina', who: 'FC', whoNome: 'Felipe Carvalho', due: 'hoje', dueKind: '', done: false },
  { id: 'd5', titulo: 'Daily (alinhamento interno)', sub: 'todo dia · 09:00', tipo: 'rotina', who: 'FC', whoNome: 'Felipe Carvalho', due: 'feito', dueKind: '', done: true },
];

function fmtPrazo(prazo: string | null, overdue: boolean): { due: string; dueKind: TaskRow['dueKind'] } {
  if (!prazo) return { due: '—', dueKind: '' };
  const dias = -diasDesdeBRT(prazo); // dias até o prazo (positivo = futuro), em BRT
  if (dias === 0) return { due: 'hoje', dueKind: 'warn' };
  if (dias < 0) return { due: `${Math.abs(dias)}d atr`, dueKind: 'crit' };
  return { due: `${dias}d`, dueKind: overdue ? 'crit' : '' };
}

async function getDados(): Promise<{ rows: TaskRow[]; kpis: { abertas: number; risco: number; concluidas: number; hoje: number }; membros: MembroOpt[]; meuId: string | null }> {
  if (!isSupabaseConfigured) {
    return { rows: DEMO, kpis: { abertas: 3, risco: 1, concluidas: 12, hoje: 2 }, membros: DEMO_MEMBROS, meuId: 'm1' };
  }
  const supabase = await getSupabaseServer();
  const hojeData = hojeBRT();
  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - 7);

  const [{ data: abertasData }, { count: concl }, { data: concluidasData }, { data: membrosData }, membroAtual] = await Promise.all([
    supabase.from('lenha').select('*').neq('status', 'concluida').order('prazo', { ascending: true, nullsFirst: false }).limit(300),
    supabase.from('lenha').select('*', { count: 'exact', head: true }).eq('status', 'concluida').gte('concluida_em', inicioSemana.toISOString()),
    supabase.from('lenha').select('*').eq('status', 'concluida').gte('concluida_em', inicioSemana.toISOString()).order('concluida_em', { ascending: false }).limit(100),
    supabase.from('membro').select('id, nome').eq('ativo', true).order('nome'),
    getCurrentMembro(),
  ]);

  const membrosList = (membrosData as { id: string; nome: string }[]) ?? [];
  const nomePor = new Map(membrosList.map((m) => [m.id, m.nome]));

  const abertas = (abertasData as Lenha[]) ?? [];
  const rows: TaskRow[] = abertas.map((l) => {
    const overdue = l.prazo ? l.prazo < hojeData : false;
    const { due, dueKind } = fmtPrazo(l.prazo, overdue);
    const nome = l.responsavel_id ? nomePor.get(l.responsavel_id) ?? '' : '';
    const sub = l.tipo === 'forja' ? 'Lenha de Forja' : l.tipo === 'rotina' ? 'Lenha de Rotina' : 'Tarefa do dia';
    return {
      id: l.id,
      titulo: l.titulo,
      sub,
      tipo: (l.tipo as TaskRow['tipo']) ?? 'avulsa',
      who: nome ? iniciais(nome) : '',
      whoNome: nome,
      due,
      dueKind,
      done: false,
    };
  });

  // Concluídas da semana (pro filtro "Concluídas" ter o que mostrar).
  const concluidasRows: TaskRow[] = ((concluidasData as Lenha[]) ?? []).map((l) => {
    const nome = l.responsavel_id ? nomePor.get(l.responsavel_id) ?? '' : '';
    return {
      id: l.id,
      titulo: l.titulo,
      sub: l.tipo === 'forja' ? 'Lenha de Forja' : l.tipo === 'rotina' ? 'Lenha de Rotina' : 'Tarefa do dia',
      tipo: (l.tipo as TaskRow['tipo']) ?? 'avulsa',
      who: nome ? iniciais(nome) : '',
      whoNome: nome,
      due: 'feito',
      dueKind: '',
      done: true,
    };
  });

  return {
    rows: [...rows, ...concluidasRows],
    kpis: {
      abertas: abertas.length,
      risco: abertas.filter((l) => l.prazo && l.prazo < hojeData).length,
      concluidas: concl ?? 0,
      hoje: abertas.filter((l) => l.tipo === 'avulsa' || l.data_referencia === hojeData).length,
    },
    membros: membrosList,
    meuId: (membroAtual as Membro | null)?.id ?? null,
  };
}

export default async function TarefasPage() {
  const { rows, kpis, membros, meuId } = await getDados();

  return (
    <div className="main">
      <Topbar title="Tarefas" sub="Lenhas" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Operação · Lenhas</div>
            <h2>Tarefas</h2>
            <p>Suas Lenhas de Forja, de Rotina e as tarefas do dia — crie, conclua e delegue para a Brigada.</p>
          </div>
        </div>

        <div className="kpis">
          <div className="card kpi"><div className="k-top"><span className="k-label">Abertas</span></div><div className="k-val">{kpis.abertas}</div><div className="k-sub">atribuídas à squad</div></div>
          <div className={`card kpi${kpis.risco > 0 ? ' flag-crit' : ''}`}><div className="k-top"><span className="k-label">Em risco (SLA)</span>{kpis.risco > 0 && <span className="chip crit">prazo</span>}</div><div className="k-val">{kpis.risco}</div><div className="k-sub">estouraram o prazo</div></div>
          <div className="card kpi"><div className="k-top"><span className="k-label">Concluídas</span></div><div className="k-val">{kpis.concluidas}</div><div className="k-sub">nesta semana</div></div>
          <div className={`card kpi${kpis.hoje > 0 ? ' flag-warn' : ''}`}><div className="k-top"><span className="k-label">Tarefas do dia</span></div><div className="k-val">{kpis.hoje}</div><div className="k-sub">avulsas + de hoje</div></div>
        </div>

        <TarefasClient rows={rows} membros={membros} meuId={meuId} />
      </div>
    </div>
  );
}
