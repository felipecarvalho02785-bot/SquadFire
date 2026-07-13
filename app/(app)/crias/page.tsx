import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { listCrias } from '@/lib/data/crias';
import { brl, statusLabel, faseLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CriasPage() {
  const crias = await listCrias();

  return (
    <div className="main">
      <Topbar
        title="Crias"
        sub={`${crias.length} escritório(s) na Forja · espelho do ClickUp (Squad 08)`}
      />
      <div className="content">
        {crias.length === 0 ? (
          <div className="empty">
            <div className="big">⚒️</div>
            <b>Nenhuma Cria ainda</b>
            <p>
              As Crias entram pelo sync do ClickUp (lista-mestre, Squad 08) ou pelo cadastro do
              Gestor de Contas. Rode a sincronização para materializar os clientes.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 6 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Fase da Forja</th>
                  <th>Status</th>
                  <th>Investimento em mídia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {crias.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="t">{c.nome_cliente}</div>
                      <div className="s">{c.area_atuacao ?? 'Área a definir'}</div>
                    </td>
                    <td>{faseLabel(c.clickup_semana)}</td>
                    <td>
                      <span className={`dot ${c.status}`} /> {statusLabel(c.status)}
                      {c.em_risco && <span className="badge risk" style={{ marginLeft: 8 }}>em risco</span>}
                    </td>
                    <td>{brl(c.investimento_midia)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link className="btn" href={`/crias/${c.id}`}>
                        abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
