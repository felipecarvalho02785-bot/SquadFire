import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { MinhasLenhas } from '@/components/MinhasLenhas';
import { Sino } from '@/components/Sino';
import { getCurrentMembro } from '@/lib/auth';
import { getMeuDiaDashboard } from '@/lib/data/meudia';
import { getAlertas } from '@/lib/data/alertas';
import { garantirRituaisHoje } from '@/lib/data/agenda';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

function saudacao(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

const tagKind: Record<string, string> = { cliente: 'ember', roda: 'ok', interna: 'dim' };

export default async function MeuDiaPage() {
  await garantirRituaisHoje(); // materializa os rituais do dia (idempotente)
  const membro = isSupabaseConfigured ? await getCurrentMembro() : null;
  const [d, alertas] = await Promise.all([getMeuDiaDashboard(membro), getAlertas(membro)]);

  const busca = (
    <>
      <form action="/crias" className="tsearch">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
        <input name="q" placeholder="Buscar Cria…" aria-label="Buscar Cria" />
      </form>
      <Sino />
    </>
  );

  return (
    <div className="main">
      <Topbar title="Meu Dia" sub="seu foco de hoje" right={busca} />
      <div className="content">
        <div className="daygreet">
          <div className="eye">Operação · Seu dia</div>
          <h2>{saudacao()}, {d.nome}</h2>
          <p>Seu cockpit do dia — o que pega fogo primeiro hoje.</p>
        </div>

        {alertas.resumo && (
          <div className="card faisca-resumo">
            <span className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" /></svg>
            </span>
            <div>
              <div className="bt">A Faísca diz</div>
              <div className="bs">{alertas.resumo}</div>
            </div>
          </div>
        )}

        {d.banner && (
          <div className="card daybanner">
            <span className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" />
              </svg>
            </span>
            <div>
              <div className="bt">{d.banner.titulo}</div>
              <div className="bs">{d.banner.sub}</div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="kpis">
          <div className="card kpi">
            <div className="k-top"><span className="k-label">Lenhas de hoje</span></div>
            <div className="k-val">{d.kpis.lenhasHoje}</div>
            <div className="k-sub">{d.kpis.deRotina} de rotina</div>
          </div>
          <div className={`card kpi${d.kpis.slaQuente > 0 ? ' flag-crit' : ''}`}>
            <div className="k-top"><span className="k-label">SLA quente</span>{d.kpis.slaQuente > 0 && <span className="chip crit">risco</span>}</div>
            <div className="k-val">{d.kpis.slaQuente}</div>
            <div className="k-sub">estourando</div>
          </div>
          <div className={`card kpi${d.kpis.briefings > 0 ? ' flag-warn' : ''}`}>
            <div className="k-top"><span className="k-label">Briefings</span>{d.kpis.briefings > 0 && <span className="chip warn">colher</span>}</div>
            <div className="k-val">{d.kpis.briefings}</div>
            <div className="k-sub">faltam esta semana</div>
          </div>
          <div className="card kpi">
            <div className="k-top"><span className="k-label">Check-ins</span></div>
            <div className="k-val">{d.kpis.checkins}</div>
            <div className="k-sub">a fazer</div>
          </div>
        </div>

        {/* Lenhas + Agenda */}
        <div className="grid g-2">
          <div className="card">
            <div className="c-h"><span className="t">Minhas Lenhas de hoje</span><span className="s">{d.lenhas.length} hoje</span></div>
            <MinhasLenhas lenhas={d.lenhas} />
          </div>

          <div className="card">
            <div className="c-h"><span className="t">Agenda de hoje</span><span className="s">Google Agenda</span></div>
            {d.agenda.length === 0 ? (
              <div className="s" style={{ color: 'var(--muted)' }}>Sem reuniões no Google Agenda hoje. Conecte em Configurações se ainda não conectou — as Rodas de Fogo agendadas aparecem aqui.</div>
            ) : (
              <div className="list agn">
                {d.agenda.map((a, i) => (
                  <div className="lrow" key={i}>
                    <span className="time">{a.hora}</span>
                    <div className="rmain"><div className="t">{a.titulo}</div></div>
                    <span className={`badge ${tagKind[a.kind] ?? 'dim'}`}>{a.tag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Briefings & check-ins da semana */}
        <div className="card">
          <div className="c-h"><span className="t">Briefings &amp; check-ins da semana</span><span className="s">{d.briefings.length} Crias</span></div>
          {d.briefings.length === 0 ? (
            <div className="s" style={{ color: 'var(--muted)' }}>Nenhuma Cria ativa ainda — toda a Brigada acompanha as mesmas Crias.</div>
          ) : (
            <div className="list">
              {d.briefings.map((b, i) => (
                <div className="lrow" key={i}>
                  <span className="avatar sm">{b.iniciais}</span>
                  <div className="rmain"><div className="t">{b.nome}</div><div className="s">{b.sub}</div></div>
                  <Link className="linkact" href={b.href}>{b.acao}</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rituais da semana */}
        <div className="card">
          <div className="c-h"><span className="t">Rituais da semana</span><span className="s">recorrentes</span></div>
          {d.rituais.length === 0 ? (
            <div className="s" style={{ color: 'var(--muted)' }}>Sem rituais ativos para o seu papel.</div>
          ) : (
            <div className="list">
              {d.rituais.map((r, i) => (
                <div className="lrow" key={i}>
                  <div className="rmain"><div className="t">{r.titulo}</div><div className="s">{r.sub}</div></div>
                  {r.status ? <span className={`chip ${r.status.kind}`}>{r.status.label}</span> : <span className="badge">repete</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
