'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/meu-dia', ic: '🔥', label: 'Meu Dia' },
  { href: '/covil', ic: '🐉', label: 'Covil' },
  { href: '/crias', ic: '⚒️', label: 'Crias' },
  { href: '/fogueira', ic: '🔥', label: 'Fogueira' },
  { href: '/tarefas', ic: '🪵', label: 'Tarefas' },
  { href: '/brigada', ic: '🛡️', label: 'Brigada' },
  { href: '/calendario', ic: '📅', label: 'Calendário' },
  { href: '/faisca', ic: '✨', label: 'Faísca' },
];

export function Sidebar({ membro }: { membro: { nome: string; papel_primario: string } | null }) {
  const path = usePathname();
  const iniciais = (membro?.nome || 'SF')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">🔥</div>
        <div>
          <b>SquadFire</b>
          <span>Squad 08 · a Forja</span>
        </div>
      </div>
      <nav className="nav">
        {NAV.map((n) => {
          const active = path === n.href || path.startsWith(n.href + '/');
          return (
            <Link key={n.href} href={n.href} className={active ? 'active' : ''}>
              <span className="ic">{n.ic}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="spacer" />
      <div className="me">
        <div className="avatar">{iniciais}</div>
        <div style={{ minWidth: 0 }}>
          <div className="t" style={{ fontSize: 13 }}>
            {membro?.nome ?? 'Visitante'}
          </div>
          <div className="s" style={{ fontSize: 11 }}>
            {papelLabel(membro?.papel_primario)}
          </div>
        </div>
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
