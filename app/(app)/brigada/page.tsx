import { Topbar } from '@/components/Topbar';
import { getBrigada } from '@/lib/data/brigada';
import { iniciais } from '@/lib/format';
import type { Papel } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

const PAPEL_LABEL: Record<Papel, string> = {
  gestor_contas: 'Contas',
  gestor_projetos: 'Projetos',
  gestor_trafego: 'Tráfego',
};

export default async function BrigadaPage() {
  const membros = await getBrigada();

  return (
    <div className="main">
      <Topbar title="Brigada 🛡️" sub="A squad — papéis e carga de Lenhas em aberto." />
      <div className="content">
        {membros.length === 0 ? (
          <div className="empty">
            <div className="big">🛡️</div>
            <b>Brigada vazia</b>
            <p>Adicione membros na allowlist (tabela <code>membro</code>) para vê-los aqui.</p>
          </div>
        ) : (
          <div className="grid cols-3">
            {membros.map((m) => (
              <div className="card" key={m.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="avatar" style={{ width: 42, height: 42, fontSize: 16 }}>
                    {iniciais(m.nome)}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="t">
                      {m.nome} {m.is_admin && <span className="badge ember">Admin</span>}
                    </div>
                    <div className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.email}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  {m.papeis.map((p) => (
                    <span
                      key={p}
                      className={`badge ${p === m.papel_primario ? 'ember' : 'dim'}`}
                    >
                      {PAPEL_LABEL[p]}
                      {p === m.papel_primario ? ' ★' : ''}
                    </span>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <div className="grow">
                    <div className="s">Lenhas em aberto</div>
                  </div>
                  <div className="kpi">
                    <div className="n" style={{ fontSize: 22 }}>{m.lenhas_abertas}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
