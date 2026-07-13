'use client';

import { useState } from 'react';

export interface CalEvento { label: string; kind: string; hora?: string }

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const KIND_LABEL: Record<string, string> = { fase: 'Prazo de fase', 'fase-crit': 'Prazo de fase · atrasada', ritual: 'Ritual', gcal: 'Google Agenda' };

// Mês interativo: clique num dia para ver todos os compromissos daquele dia
// (prazos de fase, rituais e eventos do Google).
export function CalendarioMes({ year, month, today, eventos }: { year: number; month: number; today: number; eventos: Record<number, CalEvento[]> }) {
  const [sel, setSel] = useState<number>(today);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const doDia = eventos[sel] ?? [];
  const dataSel = new Date(year, month, sel).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <>
      <div className="cal-grid" style={{ marginBottom: 6 }}>
        {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((day, i) => day == null ? (
          <div key={i} className="cal-cell out" />
        ) : (
          <button
            key={i}
            type="button"
            className={`cal-cell${day === today ? ' today' : ''}${day === sel ? ' sel' : ''}`}
            onClick={() => setSel(day)}
            aria-pressed={day === sel}
          >
            <span className="dn">{day}</span>
            {(eventos[day] ?? []).slice(0, 3).map((ev, j) => (
              <span className={`cal-ev ${ev.kind}`} key={j}>{ev.label}</span>
            ))}
            {(eventos[day]?.length ?? 0) > 3 && <span className="cal-more">+{eventos[day].length - 3}</span>}
          </button>
        ))}
      </div>

      {/* painel do dia selecionado */}
      <div className="cal-detail">
        <div className="cd-h"><span className="cd-date">{dataSel}</span><span className="cd-count">{doDia.length} compromisso{doDia.length === 1 ? '' : 's'}</span></div>
        {doDia.length === 0 ? (
          <div className="s" style={{ color: 'var(--muted)', paddingTop: 4 }}>Sem compromissos nesse dia.</div>
        ) : (
          <div className="cd-list">
            {doDia.slice().sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99')).map((ev, i) => (
              <div className="cd-row" key={i}>
                <span className={`cd-dot ${ev.kind}`} />
                {ev.hora && <span className="cd-hora mono">{ev.hora}</span>}
                <span className="cd-label">{ev.label}</span>
                <span className="cd-kind">{KIND_LABEL[ev.kind] ?? ev.kind}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
