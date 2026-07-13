'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { iniciais } from '@/lib/format';

type IconKey = 'meu-dia' | 'covil' | 'crias' | 'fogueira' | 'tarefas' | 'calendario' | 'brigada' | 'faisca';

const NAV: { grupo: string; itens: { href: string; ic: IconKey; label: string }[] }[] = [
  {
    grupo: 'Operação',
    itens: [
      { href: '/meu-dia', ic: 'meu-dia', label: 'Meu Dia' },
      { href: '/covil', ic: 'covil', label: 'Covil' },
      { href: '/crias', ic: 'crias', label: 'Crias' },
      { href: '/fogueira', ic: 'fogueira', label: 'Fogueira' },
      { href: '/tarefas', ic: 'tarefas', label: 'Tarefas' },
      { href: '/calendario', ic: 'calendario', label: 'Calendário' },
    ],
  },
  {
    grupo: 'Gestão',
    itens: [
      { href: '/brigada', ic: 'brigada', label: 'Brigada' },
      { href: '/faisca', ic: 'faisca', label: 'Faísca' },
    ],
  },
];

const ICON: Record<IconKey, React.ReactNode> = {
  'meu-dia': <path d="M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z" />,
  covil: <path d="M3 12l9-8 9 8M5 10v10h14V10" />,
  crias: <path d="M9 8a3.2 3.2 0 100-.01M3 20c0-3.3 2.7-5.5 6-5.5m6 0a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4m0 0c3.3 0 6 2.2 6 5.5" />,
  fogueira: <path d="M12 3c1.8 3-1 4-.7 6.3.3 1.8 2.2 2 2-.2 1.7 1.3 2.5 3.4 2.2 5.4C16.9 19 14.7 22 12 22c-3.1 0-5.4-2.4-5.4-5.6 0-2.5 1.5-4 2.4-5.2.5 1.7 2.2 1.4 2.1-.4C11 8.5 9.6 6 12 3z" />,
  tarefas: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
  calendario: <path d="M4 5h16v16H4zM4 9h16M8 3v4M16 3v4" />,
  brigada: <path d="M12 3l7 3v5c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6z" />,
  faisca: <path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" />,
};

export function Sidebar({
  membro,
  pulso,
}: {
  membro: { nome: string; papel_primario: string; is_admin?: boolean } | null;
  pulso: { forjasQuentes: number; noPrazoPct: number };
}) {
  const path = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/squad-icon.png" alt="SquadFire" width={36} height={36} />
        </div>
        <div className="brandtext">
          <b>Squad<i>Fire</i></b>
          <span className="brandsub">Squad 08 · a Forja</span>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((g) => (
          <div key={g.grupo} style={{ display: 'contents' }}>
            <span className="lbl">{g.grupo}</span>
            {g.itens.map((n) => {
              const active = path === n.href || path.startsWith(n.href + '/');
              return (
                <Link key={n.href} href={n.href} className={active ? 'active' : ''}>
                  <span className="ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      {ICON[n.ic]}
                    </svg>
                  </span>
                  {n.label}
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
            {membro?.is_admin ? <span className="badge admin" style={{ marginLeft: 6 }}>Admin</span> : null}
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
