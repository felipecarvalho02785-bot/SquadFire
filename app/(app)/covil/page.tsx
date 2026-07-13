import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { AreaChart, Donut, DonutLegend, Bars, HBars } from '@/components/charts';
import { getCovilDashboard } from '@/lib/data/covil';
import { getCurrentMembro } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import type { Papel } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

type RoleKey = 'contas' | 'projetos' | 'trafego' | 'admin';

const ROLES: { key: RoleKey; papel: Papel; tab: string; eyebrow: string; persona: string; portrait: string }[] = [
  { key: 'contas', papel: 'gestor_contas', tab: 'Contas', eyebrow: 'Gestor de Contas · Brigada', persona: 'Felipe', portrait: '/img/felipe.webp' },
  { key: 'projetos', papel: 'gestor_projetos', tab: 'Projetos', eyebrow: 'Gestor de Projetos · Brigada', persona: 'Luiz', portrait: '/img/luiz.webp' },
  { key: 'trafego', papel: 'gestor_trafego', tab: 'Tráfego', eyebrow: 'Gestor de Tráfego · Brigada', persona: 'Squad', portrait: '/img/luiz.webp' },
  { key: 'admin', papel: 'gestor_contas', tab: 'Admin', eyebrow: 'Admin · Visão geral da squad', persona: 'Felipe', portrait: '/img/felipe.webp' },
];

function saudacao(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function portraitDe(nome: string): string {
  return /^felipe/i.test(nome.trim()) ? '/img/felipe.webp' : '/img/luiz.webp';
}

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export default async function CovilPage({ searchParams }: { searchParams: Promise<{ papel?: string }> }) {
  const sp = await searchParams;
  const membro = isSupabaseConfigured ? await getCurrentMembro() : null;

  const defaultKey: RoleKey = membro
    ? membro.is_admin
      ? 'admin'
      : ((ROLES.find((r) => r.papel === membro.papel_primario)?.key ?? 'contas') as RoleKey)
    : 'projetos';
  const role = ROLES.find((r) => r.key === sp.papel) ?? ROLES.find((r) => r.key === defaultKey)!;

  const dash = await getCovilDashboard(role.papel);

  const nomeHero = membro?.nome?.split(' ')[0] ?? role.persona;
  const retrato = membro ? portraitDe(membro.nome) : role.portrait;

  const switcher = (
    <>
      <div className="seg">
        {ROLES.map((r) => (
          <Link key={r.key} href={`/covil?papel=${r.key}`} className={r.key === role.key ? 'on' : ''}>
            {r.tab}
          </Link>
        ))}
      </div>
      <div className="range">
        <button type="button">4s</button>
        <button type="button" className="on">12s</button>
        <button type="button">YTD</button>
      </div>
    </>
  );

  return (
    <div className="main">
      <Topbar title="Covil" sub="visão de gestão" right={switcher} />
      <div className="content">
        {/* Hero por papel */}
        <section className="hero">
          <div className="bg" />
          <div className="portrait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="member" src={retrato} alt={nomeHero} />
          </div>
          <div className="hcontent">
            <div className="eye">{role.eyebrow}</div>
            <h1 className="big">{saudacao()}, {nomeHero}</h1>
            <p>Suas Forjas, saúde e SLAs num relance — este é o seu Covil.</p>
            <div className="glass">
              <div className="g-stat"><div className="v">{dash.hero.forjasAtivas}</div><div className="l">Forjas ativas</div></div>
              <div className="g-stat"><div className="v">{dash.hero.noPrazoPct}%</div><div className="l">No prazo</div></div>
              <div className="g-stat crit"><div className="v">{dash.hero.slaEstourando}</div><div className="l">SLA estourando</div></div>
              <div className="g-stat warn"><div className="v">{dash.hero.lenhasNaFila}</div><div className="l">Lenhas na fila</div></div>
            </div>
          </div>
        </section>

        {/* Row 1 — entregas (área) + saúde (rosca) */}
        <div className="grid g-2">
          <div className="card">
            <div className="c-h"><span className="t">Entregas por semana</span><span className="s">Lenhas de Forja concluídas · 12 semanas</span></div>
            <AreaChart data={dash.entregas} />
          </div>
          <div className="card">
            <div className="c-h"><span className="t">Saúde das Forjas</span><span className="s">agora</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Donut segs={dash.saude} />
              <DonutLegend segs={dash.saude} />
            </div>
          </div>
        </div>

        {/* Row 2 — fases (barras) + meta/rotina + carga (barras H) */}
        <div className="grid g-3">
          <div className="card">
            <div className="c-h"><span className="t">Forjas por fase</span><span className="s">distribuição no funil</span></div>
            <Bars data={dash.fases} />
          </div>
          <div className="stack-col">
            <div className="card">
              <div className="c-h"><span className="t">No prazo vs meta</span></div>
              <div className="meter-wrap">
                <div className="meter">
                  <div className="fill" style={{ width: `${dash.meta.atual}%` }} />
                  <div className="target" style={{ left: `${dash.meta.meta}%` }} />
                </div>
                <div className="meter-tags">
                  <span className="big">{dash.meta.atual}%</span>
                  <span>meta <b className="mono" style={{ color: 'var(--text)' }}>{dash.meta.meta}%</b></span>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="c-h"><span className="t">Rotina do dia</span></div>
              <div className="list">
                {dash.rotina.length === 0 ? (
                  <div className="s" style={{ color: 'var(--muted)' }}>Sem rituais para o seu papel.</div>
                ) : (
                  dash.rotina.map((r, i) => (
                    <div className="lrow" key={i}>
                      <span className={`chk${r.done ? ' done' : ''}`}>{r.done ? CHECK : null}</span>
                      <div className="rmain"><div className="t">{r.titulo}</div><div className="s">{r.sub}</div></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="c-h"><span className="t">Carga da Brigada</span><span className="s">Lenhas abertas</span></div>
            <HBars data={dash.carga} />
          </div>
        </div>

        {/* Row 3 — alertas de SLA */}
        <div className="card">
          <div className="c-h"><span className="t">Alertas de SLA</span><span className="s">fases estourando o Estopim</span></div>
          <div className="list">
            {dash.alertas.length === 0 ? (
              <div className="s" style={{ color: 'var(--muted)' }}>Nenhuma Cria em risco. A Forja está quente e no controle. 🔥</div>
            ) : (
              dash.alertas.map((a, i) => (
                <div className="lrow" key={i}>
                  <span className={`pill ${a.nivel}`}><span className="d" style={{ background: a.nivel === 'crit' ? 'var(--risk)' : a.nivel === 'warn' ? 'var(--warn)' : 'var(--ember-hi)' }} />{a.tag}</span>
                  <div className="rmain"><div className="t">{a.titulo}</div><div className="s">{a.sub}</div></div>
                  <span className="rside">{a.dias}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
