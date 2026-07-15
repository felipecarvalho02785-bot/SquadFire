import type { CSSProperties } from 'react';

// Faísca de recompensa: um estouro rápido de brasas ao concluir uma Lenha ou
// avançar de fase. Puramente decorativo — a visibilidade é controlada 100% por
// CSS (some sob "reduzir animações" / prefers-reduced-motion).
export function Spark() {
  return (
    <span className="spark" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />
      ))}
    </span>
  );
}
