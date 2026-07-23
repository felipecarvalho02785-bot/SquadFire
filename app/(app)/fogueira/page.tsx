import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { SaudePill } from '@/components/SaudePill';
import { listCrias } from '@/lib/data/crias';
import { getSinaisSaudePorCria, saudeVM } from '@/lib/data/saude';
import { brl } from '@/lib/format';

export const dynamic = 'force-dynamic';

const FASES = ['Alinhamento', 'Diagnóstico 360', 'Treinamento', 'Consultoria', 'Implementação', 'Aud. Mídia', 'Aud. Criativa'];

export default async function FogueiraPage() {
  const [crias, sinais] = await Promise.all([listCrias(), getSinaisSaudePorCria()]);
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
          <span className="kboard-hint" aria-hidden>arraste ↔ pra ver todas as fases</span>
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
                  <div className="empty-min">vazio</div>
                ) : (
                  doGrupo.map((c, i) => {
                    const vm = saudeVM(c, sinais.get(c.id));
                    return (
                      <Link
                        key={c.id}
                        href={`/crias/${c.id}`}
                        className={`card kcard sf-reveal${vm.kind === 'crit' ? ' urgente' : ''}`}
                        style={{ '--i': i } as React.CSSProperties}
                      >
                        <div className="kn">{c.nome_cliente}</div>
                        <div className="ksub">{c.area_atuacao ?? 'Área a definir'}</div>
                        {col.key > 0 && (
                          <div className="kprog" aria-hidden>
                            {Array.from({ length: 7 }, (_, s) => (
                              <span key={s} className={`cseg${s < col.key ? ' on' : ''}`} style={{ '--s': s } as React.CSSProperties} />
                            ))}
                          </div>
                        )}
                        <div className="kmeta">
                          <SaudePill saude={vm} score={vm.score} />
                          <span className="kinv">{brl(c.investimento_midia)}</span>
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
