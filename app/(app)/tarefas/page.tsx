import { Topbar } from '@/components/Topbar';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Lenha } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface TaskRow { titulo: string; sub: string; tipo: 'forja' | 'rotina'; who: string; due: string; dueKind: '' | 'crit' | 'warn'; done: boolean }

const DEMO: TaskRow[] = [
  { titulo: 'Coletar briefing semanal · Letícia Stein', sub: 'Fase 3 · Treinamento', tipo: 'forja', who: 'FC', due: 'hoje', dueKind: 'crit', done: false },
  { titulo: 'Revisar Diagnóstico 360 · Edi Carlos', sub: 'Fase 2 · entrega da consultoria', tipo: 'forja', who: 'LM', due: '1d', dueKind: 'warn', done: false },
  { titulo: 'Aprovar criativos · Mozini Advocacia', sub: 'Fase 3 · auditoria criativa', tipo: 'forja', who: 'MA', due: '2d', dueKind: '', done: false },
  { titulo: 'Implementar CRM + IA · Mendes', sub: 'Fase 5 · integração', tipo: 'forja', who: 'JB', due: '3d', dueKind: '', done: false },
  { titulo: 'Relatório diário das tarefas', sub: 'fim de expediente', tipo: 'rotina', who: 'FC', due: 'hoje', dueKind: '', done: false },
  { titulo: 'Daily (alinhamento interno)', sub: 'todo dia · 09:00', tipo: 'rotina', who: 'FC', due: 'feito', dueKind: '', done: true },
  { titulo: 'Check-in semanal · cada Cria', sub: 'toda semana', tipo: 'rotina', who: 'FC', due: '2d', dueKind: '', done: false },
];

async function getTarefas(): Promise<{ rows: TaskRow[]; kpis: { abertas: number; risco: number; concluidas: number; rotina: number } }> {
  if (!isSupabaseConfigured) {
    return { rows: DEMO, kpis: { abertas: 8, risco: 2, concluidas: 23, rotina: 5 } };
  }
  const supabase = await getSupabaseServer();
  const hoje = new Date();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - 7);
  const [{ data: abertasData }, { count: concl }] = await Promise.all([
    supabase.from('lenha').select('*').neq('status', 'concluida').order('prazo', { ascending: true, nullsFirst: false }).limit(200),
    supabase.from('lenha').select('*', { count: 'exact', head: true }).eq('status', 'concluida').gte('concluida_em', inicioSemana.toISOString()),
  ]);
  const abertas = (abertasData as Lenha[]) ?? [];
  const rows: TaskRow[] = abertas.map((l) => {
    const overdue = l.prazo ? new Date(l.prazo) < hoje : false;
    return { titulo: l.titulo, sub: l.tipo === 'forja' ? 'Lenha de Forja' : 'Lenha de Rotina', tipo: l.tipo, who: '', due: l.prazo ?? '—', dueKind: overdue ? 'crit' : '', done: false };
  });
  return {
    rows,
    kpis: {
      abertas: abertas.length,
      risco: abertas.filter((l) => l.prazo && new Date(l.prazo) < hoje).length,
      concluidas: concl ?? 0,
      rotina: abertas.filter((l) => l.tipo === 'rotina').length,
    },
  };
}

export default async function TarefasPage() {
  const { rows, kpis } = await getTarefas();
  const grupos = [
    { tipo: 'forja' as const, titulo: '🔥 Lenha de Forja', itens: rows.filter((r) => r.tipo === 'forja') },
    { tipo: 'rotina' as const, titulo: '🔁 Lenha de Rotina', itens: rows.filter((r) => r.tipo === 'rotina') },
  ];

  return (
    <div className="main">
      <Topbar title="Tarefas" sub="Lenhas" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Operação · Lenhas</div>
            <h2>Tarefas</h2>
            <p>Suas Lenhas de Forja e de Rotina — o que pega fogo primeiro.</p>
          </div>
        </div>

        <div className="kpis">
          <div className="card kpi"><div className="k-top"><span className="k-label">Abertas</span></div><div className="k-val">{kpis.abertas}</div><div className="k-sub">atribuídas à squad</div></div>
          <div className={`card kpi${kpis.risco > 0 ? ' flag-crit' : ''}`}><div className="k-top"><span className="k-label">Em risco (SLA)</span>{kpis.risco > 0 && <span className="chip crit">prazo</span>}</div><div className="k-val">{kpis.risco}</div><div className="k-sub">estouraram o prazo</div></div>
          <div className="card kpi"><div className="k-top"><span className="k-label">Concluídas</span></div><div className="k-val">{kpis.concluidas}</div><div className="k-sub">nesta semana</div></div>
          <div className={`card kpi${kpis.rotina > 0 ? ' flag-warn' : ''}`}><div className="k-top"><span className="k-label">Rotina de hoje</span></div><div className="k-val">{kpis.rotina}</div><div className="k-sub">Lenha de Rotina</div></div>
        </div>

        <div className="tkfilter">
          <button className="on">Todas</button>
          <button>Lenha de Forja</button>
          <button>Lenha de Rotina</button>
          <button>Atrasadas</button>
          <button>Concluídas</button>
        </div>

        {grupos.map((g) => (
          <div className="card tkgroup" key={g.tipo}>
            <div className="tkg-h"><span className="tt">{g.titulo}</span><span className="ct">{g.itens.length}</span></div>
            {g.itens.length === 0 ? (
              <div className="s" style={{ color: 'var(--muted)', paddingTop: 6 }}>Sem Lenha aqui por enquanto.</div>
            ) : (
              g.itens.map((t, i) => (
                <div className={`tk${t.done ? ' done' : ''}`} key={i}>
                  <span className={`chk${t.done ? ' done' : ''}`}>
                    {t.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : null}
                  </span>
                  <span className={`ttag ${t.tipo}`}>{t.tipo === 'forja' ? 'Forja' : 'Rotina'}</span>
                  <div className="rmain">
                    <div className="t">{t.titulo}</div>
                    <div className="s">{t.sub}</div>
                  </div>
                  {t.who && <span className="who">{t.who}</span>}
                  <span className={`due ${t.dueKind}`}>{t.due}</span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
