import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { listCrias } from '@/lib/data/crias';
import { statusLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

const FASES = [
  'Alinhamento',
  'Diagnóstico 360',
  'Treinamento',
  'Consultoria',
  'CRM + IA',
  'Auditoria Mídia',
  'Auditoria Criativa',
];

export default async function FogueiraPage() {
  const crias = await listCrias();
  const colunas = [
    { key: 0, titulo: 'Backlog', sub: 'pré-forja' },
    ...FASES.map((f, i) => ({ key: i + 1, titulo: `Fase ${i + 1}`, sub: f })),
  ];

  return (
    <div className="main">
      <Topbar title="Fogueira 🔥" sub="Linha de Fogo — as Crias por fase da Forja." />
      <div className="content">
        {crias.length === 0 ? (
          <div className="empty">
            <div className="big">🔥</div>
            <b>Sem Crias na Fogueira</b>
            <p>As Crias entram pelo sync do ClickUp (Squad 08).</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {colunas.map((col) => {
              const doGrupo = crias.filter((c) =>
                col.key === 0 ? c.clickup_semana == null : c.clickup_semana === col.key,
              );
              return (
                <div key={col.key} style={{ minWidth: 220, flex: '0 0 220px' }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>
                    {col.titulo} · {doGrupo.length}
                    <div style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none' }}>
                      {col.sub}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {doGrupo.map((c) => (
                      <Link key={c.id} href={`/crias/${c.id}`} className="card" style={{ padding: 12 }}>
                        <div className="t" style={{ fontSize: 13 }}>{c.nome_cliente}</div>
                        <div className="s" style={{ marginTop: 4 }}>
                          <span className={`dot ${c.status}`} /> {statusLabel(c.status)}
                          {c.em_risco && <span className="badge risk" style={{ marginLeft: 6 }}>risco</span>}
                        </div>
                      </Link>
                    ))}
                    {doGrupo.length === 0 && (
                      <div className="s" style={{ opacity: 0.5, padding: '8px 2px' }}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
