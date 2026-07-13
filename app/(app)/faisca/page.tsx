import { Topbar } from '@/components/Topbar';

export const dynamic = 'force-dynamic';

const CHIPS = [
  'Resumir a semana da Cria X',
  'Rascunhar o briefing (6 campos) do áudio',
  'Ler o contrato e extrair valor + data de início',
  'Quais Crias estão em risco e por quê?',
  'Sugerir plano de ação pro gargalo da fase 2',
  'Fechar meu relatório do dia',
];

export default function FaiscaPage() {
  return (
    <div className="main">
      <Topbar title="Faísca ✨" sub="A IA da squad — consulta, redige, organiza e provoca." />
      <div className="content grid" style={{ gap: 18 }}>
        <div className="card">
          <div className="eyebrow">O que a Faísca faz</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CHIPS.map((c) => (
              <span className="badge ember" key={c}>
                {c}
              </span>
            ))}
          </div>
          <p className="s" style={{ marginTop: 14 }}>
            Catálogo completo de capacidades em <code>docs/faisca-capacidades.md</code>. A camada de
            IA (Gemini para ingestão, Claude para raciocínio/escrita) roda server-side — chaves nunca
            no browser. Ver <code>docs/camada-ia.md</code>.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">Compositor</div>
          <textarea
            placeholder="Peça algo à Faísca…"
            style={{
              width: '100%',
              minHeight: 90,
              background: 'var(--bg-2)',
              border: '1px solid var(--line-2)',
              borderRadius: 10,
              color: 'var(--ink)',
              padding: 12,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn primary">Acender a Faísca ✨</button>
          </div>
        </div>
      </div>
    </div>
  );
}
