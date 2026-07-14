'use client';

import { useState } from 'react';
import { AreaChart } from '@/components/charts';

// Janela da tendência de entregas. A série é semanal (12 semanas), então o
// controle é em SEMANAS — antes o switcher "7/15/30 dias" ficava na topbar e
// não mexia em nada. Aqui ele realmente recorta o gráfico.
const JANELAS = [
  { n: 4, label: '4 sem' },
  { n: 8, label: '8 sem' },
  { n: 12, label: '12 sem' },
] as const;

export function CovilTendencia({ entregas }: { entregas: number[] }) {
  const [janela, setJanela] = useState<number>(12);
  const dados = entregas.slice(-janela);
  return (
    <div className="card">
      <div className="c-h">
        <span className="t">Entregas por semana</span>
        <div className="range" role="group" aria-label="Janela da tendência">
          {JANELAS.map((j) => (
            <button
              type="button"
              key={j.n}
              className={janela === j.n ? 'on' : ''}
              aria-pressed={janela === j.n}
              onClick={() => setJanela(j.n)}
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>
      <AreaChart data={dados} />
      <div className="s" style={{ color: 'var(--muted)', marginTop: 6 }}>Lenhas de Forja concluídas · últimas {janela} semanas</div>
    </div>
  );
}
