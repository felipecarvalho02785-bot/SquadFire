import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { listCrias } from '@/lib/data/crias';
import { saudeDaCria } from '@/lib/format';

export const dynamic = 'force-dynamic';

const FASES = ['Alinhamento', 'Diagnóstico 360', 'Treinamento', 'Consultoria', 'Implementação', 'Aud. Mídia', 'Aud. Criativa'];

export default async function FogueiraPage() {
  const crias = await listCrias();
  const colunas = [
    { key: 0, titulo: 'Backlog', sub: 'pré-forja' },
    ...FASES.map((f, i) => ({ key: i + 1, titulo: `Fase ${i + 1}`, sub: f })),
  ];

  return (
    <div className="main">
      <Topbar title="Linha de Fogo" sub="as Crias por fase da Forja" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Operação · Linha de Fogo</div>
            <h2>Linha de Fogo</h2>
            <p>As {crias.length} Crias distribuídas nas 7 fases da Forja (frio → quente). Clique numa Cria pra abrir.</p>
          </div>
        </div>

        <div className="kboard">
          {colunas.map((col) => {
            const doGrupo = crias.filter((c) => (col.key === 0 ? c.clickup_semana == null : c.clickup_semana === col.key));
            return (
              <div key={col.key} className="kcol">
                <div className="kcol-h">
                  <span>
                    <span className="kt">{col.titulo}</span>
                    <span className="ks">{col.sub}</span>
                  </span>
                  <span className="kc">{doGrupo.length}</span>
                </div>
                {doGrupo.length === 0 ? (
                  <div className="empty-min">—</div>
                ) : (
                  doGrupo.map((c) => {
                    const s = saudeDaCria(c);
                    return (
                      <Link key={c.id} href={`/crias/${c.id}`} className="card kcard">
                        <div className="kn">{c.nome_cliente}</div>
                        <div className="kmeta">
                          <span className={`pill ${s.kind}`}>
                            <span className="d" style={{ background: s.kind === 'crit' ? 'var(--risk)' : s.kind === 'warn' ? 'var(--warn)' : s.kind === 'good' ? 'var(--ember-hi)' : 'var(--faint)' }} />
                            {s.label}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
