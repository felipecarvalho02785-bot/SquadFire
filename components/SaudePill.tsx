import type { SaudeKind } from '@/lib/data/saude';

// Pill de saúde reutilizável (server + client): mostra a faixa e, quando há,
// o score do termômetro de churn. Fonte visual ÚNICA — mesma cara em toda tela.
export function SaudePill({
  saude,
  score,
}: {
  saude: { label: string; kind: SaudeKind };
  score?: number | null;
}) {
  return (
    <span className={`pill ${saude.kind}`} title={score != null ? `Saúde ${score}/100` : undefined}>
      <span className="d" />
      {saude.label}
      {score != null && <span className="pill-score">{score}</span>}
    </span>
  );
}
