import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { listCrias, getCovilResumo } from '@/lib/data/crias';
import { statusLabel, faseLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CovilPage() {
  const [resumo, crias] = await Promise.all([getCovilResumo(), listCrias()]);
  const emRisco = crias.filter((c) => c.em_risco);

  return (
    <div className="main">
      <Topbar title="Covil 🐉" sub="Panorama da squad — a visão do dragão sobre a Forja." />
      <div className="content grid" style={{ gap: 18 }}>
        <div className="grid cols-4">
          <div className="card kpi">
            <div className="n">{resumo.total}</div>
            <div className="l">Crias na Forja</div>
          </div>
          <div className="card kpi">
            <div className="n ember">{resumo.ativas}</div>
            <div className="l">Ativas</div>
          </div>
          <div className="card kpi">
            <div className="n risk">{resumo.emRisco}</div>
            <div className="l">Em risco</div>
          </div>
          <div className="card kpi">
            <div className="n">{resumo.backlog}</div>
            <div className="l">Backlog (pré-forja)</div>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">🔴 Crias em risco</div>
          {emRisco.length === 0 ? (
            <div className="s">Nenhuma Cria em risco. A Forja está quente e no controle. 🔥</div>
          ) : (
            emRisco.map((c) => (
              <div className="row" key={c.id}>
                <div className="grow">
                  <div className="t">{c.nome_cliente}</div>
                  <div className="s">
                    {faseLabel(c.clickup_semana)} · {statusLabel(c.status)}
                  </div>
                </div>
                <Link className="btn" href={`/crias/${c.id}`}>
                  abrir →
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
