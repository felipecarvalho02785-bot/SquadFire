'use client';

import { useState } from 'react';

export interface TabDef {
  key: string;
  label: string;
  content: React.ReactNode;
}

// Abas do detalhe da Cria (Visão geral, Contrato, Comentários, Gargalos, Briefing).
// Os painéis são renderizados no servidor e passados como React nodes; aqui só
// alternamos qual fica visível.
export function CriaTabs({ tabs }: { tabs: TabDef[] }) {
  const [ativa, setAtiva] = useState(tabs[0]?.key);

  return (
    <div className="card detalhe">
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} type="button" className={`tab${ativa === t.key ? ' on' : ''}`} onClick={() => setAtiva(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} className={`tabpanel${ativa === t.key ? ' on' : ''}`}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
