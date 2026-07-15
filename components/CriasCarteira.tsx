'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface CriaVM {
  id: string;
  nome: string;
  iniciais: string;
  area: string;
  semana: number | null;
  faseNome: string | null;
  investimento: string;
  investimentoNum: number | null;
  saude: { label: string; kind: 'good' | 'warn' | 'crit' | 'dim' };
}

type Filtro = 'todas' | 'chamas' | 'apagando' | 'backlog';
type Ordem = 'quentes' | 'fase' | 'investimento' | 'nome';

const RANK: Record<string, number> = { crit: 0, good: 1, warn: 2, dim: 3 };

// Carteira de Crias: cada Cria é uma linha-cartão (faixa de saúde + progresso da
// Forja + tudo clicável), com filtros rápidos e ordenação. Substitui a tabela.
export function CriasCarteira({ itens }: { itens: CriaVM[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [ordem, setOrdem] = useState<Ordem>('quentes');

  const contagem = useMemo(
    () => ({
      todas: itens.length,
      chamas: itens.filter((c) => c.saude.kind === 'good').length,
      apagando: itens.filter((c) => c.saude.kind === 'crit').length,
      backlog: itens.filter((c) => c.semana == null).length,
    }),
    [itens],
  );

  const vis = useMemo(() => {
    const filtrada = itens.filter((c) => {
      if (filtro === 'chamas') return c.saude.kind === 'good';
      if (filtro === 'apagando') return c.saude.kind === 'crit';
      if (filtro === 'backlog') return c.semana == null;
      return true;
    });
    const ord = [...filtrada];
    if (ordem === 'quentes') ord.sort((a, b) => RANK[a.saude.kind] - RANK[b.saude.kind] || (b.semana ?? 0) - (a.semana ?? 0));
    else if (ordem === 'fase') ord.sort((a, b) => (b.semana ?? 0) - (a.semana ?? 0));
    else if (ordem === 'investimento') ord.sort((a, b) => (b.investimentoNum ?? 0) - (a.investimentoNum ?? 0));
    else ord.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return ord;
  }, [itens, filtro, ordem]);

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: 'todas', label: `Todas ${contagem.todas}` },
    { key: 'chamas', label: `Em Chamas ${contagem.chamas}` },
    { key: 'apagando', label: `Apagando ${contagem.apagando}` },
    { key: 'backlog', label: `Backlog ${contagem.backlog}` },
  ];

  return (
    <>
      <div className="cart-bar">
        <div className="tkfilter" style={{ margin: 0 }}>
          {FILTROS.map((f) => (
            <button key={f.key} type="button" className={filtro === f.key ? 'on' : ''} onClick={() => setFiltro(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <select className="selin cart-sort" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
          <option value="quentes">Mais quentes</option>
          <option value="fase">Fase avançada</option>
          <option value="investimento">Maior investimento</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
      </div>

      {vis.length === 0 ? (
        <div className="card"><div className="s" style={{ color: 'var(--muted)' }}>Nenhuma Cria neste filtro.</div></div>
      ) : (
        <div className="carteira">
          {vis.map((c, i) => (
            <Link key={c.id} href={`/crias/${c.id}`} className={`crow sf-reveal k-${c.saude.kind}`} style={{ '--i': i } as React.CSSProperties}>
              <span className="crow-stripe" aria-hidden />
              <span className="avatar sm">{c.iniciais}</span>
              <div className="crow-main">
                <div className="crow-top">
                  <span className="crow-nome">{c.nome}</span>
                  <span className="crow-fase">{c.semana ? `Fase ${c.semana}` : 'Backlog'}</span>
                </div>
                <div className="crow-sub">{c.faseNome ? `${c.area} · ${c.faseNome}` : c.area}</div>
                <div className="crow-prog" aria-hidden>
                  {Array.from({ length: 7 }, (_, s) => (
                    <span key={s} className={`cseg${c.semana && s < c.semana ? ' on' : ''}`} style={{ '--s': s } as React.CSSProperties} />
                  ))}
                </div>
              </div>
              <div className="crow-right">
                <span className={`pill ${c.saude.kind}`}>
                  <span className="d" />
                  {c.saude.label}
                </span>
                <span className="crow-inv">{c.investimento}</span>
              </div>
              <span className="crow-chev" aria-hidden>→</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
