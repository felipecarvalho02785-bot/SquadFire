import { Topbar } from '@/components/Topbar';

export const dynamic = 'force-dynamic';

const CHIPS = [
  'Resumir a semana da Cria X',
  'Rascunhar o briefing (6 campos) do áudio',
  'Ler o contrato e extrair valor + data de início',
  'Quais Crias estão em risco e por quê?',
  'Plano de ação pro gargalo da fase 2',
  'Fechar meu relatório do dia',
];

export default function FaiscaPage() {
  return (
    <div className="main">
      <Topbar title="Faísca" sub="a IA da squad" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Gestão · Inteligência</div>
            <h2>Faísca ✨</h2>
            <p>A IA da squad — consulta, redige, organiza e provoca. Gemini para ingestão, Claude para raciocínio/escrita; roda server-side (chaves nunca no browser).</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow">Peça algo à Faísca</div>
          <div className="fa-composer">
            <textarea placeholder="Ex.: monte o briefing da Letícia a partir do áudio e me diga o próximo passo…" />
            <div className="bar">
              <span className="s" style={{ color: 'var(--faint)' }}>⚙️ Pipeline de IA conecta na P1 (Anthropic + Gemini)</span>
              <button className="btn primary" type="button">Acender a Faísca ✨</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">O que a Faísca faz</div>
          <div className="fa-chips">
            {CHIPS.map((c) => (
              <span className="fa-chip" key={c}>✦ {c}</span>
            ))}
          </div>
          <p className="s" style={{ marginTop: 14, color: 'var(--muted)' }}>
            Catálogo completo em <code>docs/faisca-capacidades.md</code>. O briefing por áudio já tem o
            pipeline (gravar → transcrever → estruturar 6 campos) na página de cada Cria.
          </p>
        </div>
      </div>
    </div>
  );
}
