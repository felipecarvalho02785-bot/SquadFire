'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { iniciais } from '@/lib/format';

type IconKey = 'meu-dia' | 'covil' | 'crias' | 'linha-de-fogo' | 'tarefas' | 'calendario' | 'biblioteca' | 'brigada' | 'forjaria' | 'auditoria';

const NAV: { grupo: string; itens: { href: string; ic: IconKey; label: string; admin?: boolean }[] }[] = [
  {
    grupo: 'Operação',
    itens: [
      { href: '/meu-dia', ic: 'meu-dia', label: 'Meu Dia' },
      { href: '/covil', ic: 'covil', label: 'Covil' },
      { href: '/crias', ic: 'crias', label: 'Crias' },
      { href: '/fogueira', ic: 'linha-de-fogo', label: 'Linha de Fogo' },
      { href: '/tarefas', ic: 'tarefas', label: 'Tarefas' },
      { href: '/calendario', ic: 'calendario', label: 'Calendário' },
      { href: '/biblioteca', ic: 'biblioteca', label: 'Biblioteca' },
    ],
  },
  {
    grupo: 'Gestão',
    itens: [
      { href: '/brigada', ic: 'brigada', label: 'Brigada' },
      { href: '/auditoria', ic: 'auditoria', label: 'Rastro', admin: true },
      { href: '/forjaria', ic: 'forjaria', label: 'Forjaria' },
    ],
  },
];

const ICON: Record<IconKey, React.ReactNode> = {
  'meu-dia': <path d="M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z" />,
  covil: <path d="M3 12l9-8 9 8M5 10v10h14V10" />,
  crias: <><circle cx="9" cy="7" r="3.4" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.2a3.4 3.4 0 010 5.6M22 20a6.5 6.5 0 00-4.2-6.1" /></>,
  'linha-de-fogo': <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8.5 7v7M12 7v10M15.5 7v4" /></>,
  tarefas: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
  calendario: <path d="M4 5h16v16H4zM4 9h16M8 3v4M16 3v4" />,
  biblioteca: <path d="M4 5h6a2 2 0 012 2v13a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v13a2 2 0 012-2h6z" />,
  brigada: <path d="M12 3l7 3v5c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6z" />,
  auditoria: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4M9 12h6M9 16h6M9 8h2" /></>,
  forjaria: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></>,
};

export function Sidebar({
  membro,
  pulso,
}: {
  membro: { nome: string; papel_primario: string; is_admin?: boolean } | null;
  pulso: { forjasQuentes: number; noPrazoPct: number };
}) {
  const path = usePathname();
  const [rail, setRail] = useState(false);

  // Sincroniza o estado local com a classe aplicada pelo script inline (sem flash).
  useEffect(() => {
    setRail(document.documentElement.classList.contains('sf-rail'));
  }, []);

  function toggleRail() {
    const next = !document.documentElement.classList.contains('sf-rail');
    document.documentElement.classList.toggle('sf-rail', next);
    try {
      localStorage.setItem('sf-rail', next ? '1' : '0');
    } catch {
      /* localStorage indisponível — segue só no estado da sessão */
    }
    setRail(next);
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/squad-icon.png" alt="SquadFire" width={36} height={36} />
        </div>
        <div className="brandtext">
          <b>Squad<i>Fire</i></b>
        </div>
        <button
          type="button"
          className="rail-toggle"
          onClick={toggleRail}
          aria-label={rail ? 'Expandir menu' : 'Minimizar menu'}
          aria-pressed={rail}
          title={rail ? 'Expandir menu' : 'Minimizar menu'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      {/* Faísca — assistente IA (abre o drawer de chat) */}
      <button type="button" className="faisca-card" title="Faísca — assistente IA" onClick={() => window.dispatchEvent(new Event('faisca:open'))}>
        <span className="fc-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" />
          </svg>
        </span>
        <span className="fc-txt">
          <b>Faísca</b>
          <small>assistente IA · voz &amp; texto</small>
        </span>
      </button>

      <nav className="nav">
        {NAV.map((g) => (
          <div key={g.grupo} style={{ display: 'contents' }}>
            <span className="lbl">{g.grupo}</span>
            {g.itens.filter((n) => !n.admin || membro?.is_admin).map((n) => {
              const active = path === n.href || path.startsWith(n.href + '/');
              return (
                // prefetch: pré-aquece a aba (dados + esqueleto) → clicar abre na
                // hora. Os efeitos colaterais (sync do ClickUp, gerar Lenhas) são
                // PULADOS no prefetch (ver lib/prefetch.ts / ehPrefetch), então
                // pré-aquecer é barato e não dispara escrita por aba não aberta.
                <Link key={n.href} href={n.href} prefetch className={active ? 'active' : ''} title={n.label} onClick={() => document.documentElement.classList.remove('sf-nav-open')}>

                  <span className="ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      {ICON[n.ic]}
                    </svg>
                  </span>
                  <span className="nm">{n.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="spacer" />

      <div className="insight" title="Pulso da Squad">
        <span className="fire">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3c1.8 3-1 4-.7 6.3.3 1.8 2.2 2 2-.2 1.7 1.3 2.5 3.4 2.2 5.4C16.9 19 14.7 22 12 22c-3.1 0-5.4-2.4-5.4-5.6 0-2.5 1.5-4 2.4-5.2.5 1.7 2.2 1.4 2.1-.4C11 8.5 9.6 6 12 3z" />
          </svg>
        </span>
        <div className="txt">
          <div className="h">Pulso da Squad · <b>{pulso.noPrazoPct}%</b></div>
          <div className="s">{pulso.forjasQuentes} Forjas quentes · {pulso.noPrazoPct}% no prazo</div>
        </div>
      </div>

      <div className="foot">
        <span className="avatar">{iniciais(membro?.nome || 'SF')}</span>
        <span className="who">
          {membro?.nome ?? 'Visitante'}
          <small>
            {papelLabel(membro?.papel_primario)}
            {membro?.is_admin ? ' · Admin' : ''}
          </small>
        </span>
      </div>
    </aside>
  );
}

function papelLabel(p?: string) {
  switch (p) {
    case 'gestor_contas':
      return 'Gestor de Contas';
    case 'gestor_projetos':
      return 'Gestor de Projetos';
    case 'gestor_trafego':
      return 'Gestor de Tráfego';
    default:
      return 'Sem papel';
  }
}
