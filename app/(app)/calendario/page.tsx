import { Topbar } from '@/components/Topbar';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Ev { label: string; kind: 'fase' | 'cli' | 'roda' }

export default function CalendarioPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Eventos de demonstração (produção lê do Google Agenda). Ancorados perto de hoje.
  const eventos: Record<number, Ev[]> = {};
  const add = (d: number, ev: Ev) => { if (d >= 1 && d <= daysInMonth) (eventos[d] ??= []).push(ev); };
  if (!isSupabaseConfigured) {
    add(today, { label: 'Daily · Squad', kind: 'cli' });
    add(today, { label: 'Roda de Fogo · Letícia', kind: 'roda' });
    add(today + 1, { label: 'Reunião · Mozini', kind: 'cli' });
    add(today + 2, { label: 'Prazo Fase 3 · Edi', kind: 'fase' });
    add(today + 5, { label: 'Prazo Fase 5 · Mendes', kind: 'fase' });
    add(today - 3, { label: 'Weekly + BSC', kind: 'cli' });
  }

  const cells: { day: number | null; inMonth: boolean }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
  while (cells.length % 7 !== 0) cells.push({ day: null, inMonth: false });

  return (
    <div className="main">
      <Topbar title="Calendário" sub="prazos das fases + reuniões" action={<span className="badge ok">Google Agenda · a conectar</span>} />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Operação · Agenda</div>
            <h2>Calendário</h2>
            <p>Prazos das fases da Forja + reuniões e Rodas de Fogo. Em produção, sincroniza com o Google Agenda (P1).</p>
          </div>
        </div>

        <div className="card">
          <div className="cal-nav"><span className="mo">{mesLabel}</span></div>
          <div className="cal-grid" style={{ marginBottom: 6 }}>
            {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((c, i) => (
              <div key={i} className={`cal-cell${c.inMonth ? '' : ' out'}${c.day === today ? ' today' : ''}`}>
                {c.day && <span className="dn">{c.day}</span>}
                {c.day && (eventos[c.day] ?? []).slice(0, 3).map((ev, j) => (
                  <span className={`cal-ev ${ev.kind}`} key={j}>{ev.label}</span>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <span className="badge ember">Prazo de fase</span>
            <span className="badge">Reunião / ritual</span>
            <span className="badge ok">Roda de Fogo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
