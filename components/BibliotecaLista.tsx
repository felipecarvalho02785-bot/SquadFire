'use client';

import { useState } from 'react';

export interface ItemBiblioteca { titulo: string; cria: string; tipo: 'Roteiro' | 'Criativo'; data: string }

type Filtro = 'Todos' | 'Roteiros' | 'Criativos';
const FILTROS: Filtro[] = ['Todos', 'Roteiros', 'Criativos'];

// Acervo com filtro REAL (antes os botões Todos/Roteiros/Criativos eram inertes).
export function BibliotecaLista({ itens }: { itens: ItemBiblioteca[] }) {
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const vis = itens.filter((it) => filtro === 'Todos' || (filtro === 'Roteiros' ? it.tipo === 'Roteiro' : it.tipo === 'Criativo'));

  return (
    <>
      <div className="tkfilter">
        {FILTROS.map((f) => (
          <button key={f} type="button" className={filtro === f ? 'on' : ''} onClick={() => setFiltro(f)}>{f}</button>
        ))}
      </div>

      {vis.length === 0 ? (
        <div className="card"><div className="s" style={{ color: 'var(--muted)' }}>Nada neste filtro.</div></div>
      ) : (
        <div className="grid cols-3">
          {vis.map((it, i) => (
            <div className="card" key={i}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className={`ttag ${it.tipo === 'Roteiro' ? 'forja' : 'rotina'}`}>{it.tipo}</span>
                <span className="s" style={{ color: 'var(--faint)' }}>{it.data}</span>
              </div>
              <div className="t" style={{ marginTop: 10, fontSize: 14 }}>{it.titulo}</div>
              <div className="s" style={{ color: 'var(--muted)', marginTop: 4 }}>{it.cria}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
