import { Topbar } from '@/components/Topbar';
import { getCurrentMembro } from '@/lib/auth';
import { getAuditoria } from '@/lib/data/auditoria';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

const ACAO: Record<string, { label: string; kind: string }> = {
  INSERT: { label: 'criou', kind: 'ok' },
  UPDATE: { label: 'editou', kind: 'ember' },
  DELETE: { label: 'removeu', kind: 'risk' },
};
const ENT: Record<string, string> = { cria: 'Cria', forja: 'Forja', contrato: 'Contrato' };

export default async function AuditoriaPage() {
  const membro = isSupabaseConfigured ? await getCurrentMembro() : null;
  const admin = membro?.is_admin ?? false;
  const rows = admin ? await getAuditoria(200) : [];

  return (
    <div className="main">
      <Topbar title="Rastro" sub="auditoria de alterações" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Segurança · LGPD</div>
            <h2>Rastro de alterações</h2>
            <p>Quem mudou o quê em Crias, Forjas e Contratos — para accountability e LGPD. Visível só para Admin.</p>
          </div>
        </div>

        {!admin ? (
          <div className="card"><div className="s" style={{ color: 'var(--muted)' }}>🔒 Só Admin vê o rastro de alterações.</div></div>
        ) : rows.length === 0 ? (
          <div className="card"><div className="s" style={{ color: 'var(--muted)' }}>Nenhuma alteração registrada ainda.</div></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map((r) => {
              const a = ACAO[r.acao] ?? { label: r.acao.toLowerCase(), kind: 'dim' };
              const ent = ENT[r.entidade] ?? r.entidade;
              const quando = new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={r.id} className="audit-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid var(--line, rgba(255,255,255,.06))', flexWrap: 'wrap' }}>
                  <span className={`badge ${a.kind}`} style={{ minWidth: 74, textAlign: 'center' }}>{a.label}</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="t" style={{ fontSize: 14 }}>
                      {ent}{r.alvo ? ` · ${r.alvo}` : ''}
                    </div>
                    <div className="s" style={{ color: 'var(--muted)' }}>
                      {r.mudou.length ? `campos: ${r.mudou.join(', ')}` : a.label === 'criou' ? 'registro criado' : 'registro removido'}
                    </div>
                  </div>
                  <div className="s" style={{ color: 'var(--faint)', textAlign: 'right', minWidth: 150 }}>
                    <div>{r.membro_email ?? 'sistema/serviço'}</div>
                    <div className="mono">{quando}</div>
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
