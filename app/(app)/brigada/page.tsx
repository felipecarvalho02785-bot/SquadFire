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
  const maxCarga = Math.max(1, ...membros.map((m) => m.lenhas_abertas));

  return (
    <div className="main">
      <Topbar title="Brigada" sub="a squad" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Gestão · Brigada</div>
            <h2>Brigada</h2>
            <p>A squad da Forja — papéis (um membro pode ter vários) e carga de Lenhas em aberto.</p>
          </div>
        </div>

        {membros.length === 0 ? (
          <div className="empty">
            <b>Brigada vazia</b>
            <p>Adicione membros na allowlist (tabela <code>membro</code>) para vê-los aqui.</p>
          </div>
        ) : (
          <div className="grid cols-3">
            {membros.map((m, i) => (
              <div className="card sf-reveal" key={m.id} style={{ '--i': i } as React.CSSProperties}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="avatar" style={{ width: 42, height: 42, fontSize: 15 }}>{iniciais(m.nome)}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="t">
                      {m.nome} {m.is_admin && <span className="badge admin" style={{ marginLeft: 4 }}>Admin</span>}
                    </div>
                    <div className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  {m.papeis.map((p) => (
                    <span key={p} className={`badge ${p === m.papel_primario ? 'ember' : 'dim'}`}>
                      {PAPEL_LABEL[p]}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span className="s">Lenhas em aberto</span>
                    <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{m.lenhas_abertas}</span>
                  </div>
                  <div className="loadbar"><div className="f" style={{ width: `${Math.round((m.lenhas_abertas / maxCarga) * 100)}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
