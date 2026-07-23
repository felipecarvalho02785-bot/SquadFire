// Gráficos server-rendered (SVG puro, sem lib, sem JS de cliente).
// Portados do protótipo design/covil-imersivo.html, com eixos dinâmicos
// pra escalar com dados reais. Cada um degrada bem quando não há dado.
import type { DonutSeg, CargaItem } from '@/lib/data/covil';

const EMBER = '#ff6a1a';
const EMBER_HI = '#ff9436';
const SURFACE = '#131010';

function niceMax(vals: number[], floor: number): number {
  const m = Math.max(0, ...vals);
  return Math.max(floor, Math.ceil(m / 4) * 4);
}

// ── Área: entregas por semana (12 semanas) ───────────────────────
export function AreaChart({ data }: { data: number[] }) {
  const W = 640, H = 200, L = 34, R = 14, T = 14, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const n = data.length;
  const mx = niceMax(data, 4);
  const X = (i: number) => L + (i * iw) / (n - 1);
  const Y = (v: number) => T + ih - (v / mx) * ih;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * mx));
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${X(n - 1).toFixed(1)} ${T + ih} L${X(0).toFixed(1)} ${T + ih} Z`;
  const last = data[n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }} preserveAspectRatio="none">
      {grid.map((g) => (
        <g key={g}>
          <line x1={L} y1={Y(g)} x2={W - R} y2={Y(g)} className="grid-line" />
          <text x={L - 6} y={Y(g) + 3} textAnchor="end">{g}</text>
        </g>
      ))}
      <path className="area-in" d={area} fill={EMBER} opacity={0.13} />
      <path className="line-draw" pathLength={1} d={line} fill="none" stroke={EMBER} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle className="livedot" cx={X(n - 1)} cy={Y(last)} r={6} fill={EMBER} />
      <circle cx={X(n - 1)} cy={Y(last)} r={5} fill={EMBER} stroke={SURFACE} strokeWidth={2} />
      <text x={X(n - 1) - 4} y={Y(last) - 9} textAnchor="end" fill="#9a8e85">{last}</text>
      {data.map((_, i) =>
        i % 3 === 0 || i === n - 1 ? (
          <text key={i} x={X(i)} y={H - 8} textAnchor="middle" className="axis">S{i + 1}</text>
        ) : null,
      )}
    </svg>
  );
}

// ── Rosca: saúde das Forjas ──────────────────────────────────────
export function Donut({ segs }: { segs: DonutSeg[] }) {
  const cx = 80, cy = 80, r = 58, sw = 16, gap = 0.045;
  const total = segs.reduce((a, s) => a + s.value, 0);
  const arcs: { d: string; color: string }[] = [];
  let ang = -Math.PI / 2;
  const pt = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  for (const s of segs) {
    const frac = s.value / total;
    const a0 = ang + gap / 2;
    const a1 = ang + frac * 2 * Math.PI - gap / 2;
    ang += frac * 2 * Math.PI;
    if (a1 <= a0) continue;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    arcs.push({ d: `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`, color: s.color });
  }

  return (
    <svg viewBox="0 0 160 160" style={{ width: 150, height: 150, flex: '0 0 auto' }}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--inset)" strokeWidth={sw} />
      ) : (
        arcs.map((a, i) => (
          <path key={i} className="donut-arc" style={{ '--i': i } as React.CSSProperties} pathLength={1} d={a.d} fill="none" stroke={a.color} strokeWidth={sw} strokeLinecap="round" />
        ))
      )}
      <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--text)" fontSize={26} fontWeight={700}>{total}</text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize={9.5}>FORJAS</text>
    </svg>
  );
}

export function DonutLegend({ segs }: { segs: DonutSeg[] }) {
  if (!segs.length) return <div className="s" style={{ color: 'var(--muted)' }}>Sem Forjas ainda.</div>;
  return (
    <div className="legend rows" style={{ flex: 1 }}>
      {segs.map((s) => (
        <div className="item" key={s.label}>
          <span className="dot" style={{ background: s.color }} />
          {s.label}
          <span className="v">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Barras verticais: Forjas por fase (1→7) ──────────────────────
export function Bars({ data }: { data: number[] }) {
  const W = 380, H = 210, L = 20, R = 12, T = 12, B = 44;
  const iw = W - L - R, ih = H - T - B, n = data.length;
  const mx = niceMax(data, 4);
  const band = iw / n, bw = Math.min(24, band - 10);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * mx));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 210 }}>
      {grid.map((g) => {
        const y = T + ih - (g / mx) * ih;
        return (
          <g key={g}>
            <line x1={L} y1={y} x2={W - R} y2={y} className="grid-line" />
            <text x={L - 4} y={y + 3} textAnchor="end">{g}</text>
          </g>
        );
      })}
      {data.map((v, i) => {
        const x = L + band * i + (band - bw) / 2;
        const h = (v / mx) * ih;
        const y = T + ih - h;
        return (
          <g key={i}>
            {v > 0 && <rect className="bar-grow" x={x} y={y} width={bw} height={h} rx={4} fill={EMBER} />}
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fill="#9a8e85">{v}</text>
            <text x={x + bw / 2} y={H - 26} textAnchor="middle" className="axis" fontSize={8.5}>{i + 1}</text>
          </g>
        );
      })}
      <text x={L} y={H - 8} fill="#9a8e85" fontSize={9}>fase 1 → 7 (frio → quente)</text>
    </svg>
  );
}

// ── Barras horizontais: carga da Brigada ─────────────────────────
export function HBars({ data }: { data: CargaItem[] }) {
  const W = 360, H = 200, L = 68, R = 30, T = 6, B = 8;
  const iw = W - L - R;
  if (!data.length) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="#6a605a" fontSize={12}>sem carga aberta</text>
      </svg>
    );
  }
  const n = data.length;
  const mx = niceMax(data.map((d) => d.valor), 4);
  const band = (H - T - B) / n, bh = Math.min(20, band - 12);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
      {data.map((d, i) => {
        const y = T + band * i + (band - bh) / 2;
        const w = (d.valor / mx) * iw;
        return (
          <g key={i}>
            <text x={L - 8} y={y + bh / 2 + 3} textAnchor="end" fill="#9a8e85" fontSize={11}>{d.nome}</text>
            <rect className="hbar-grow" x={L} y={y} width={Math.max(2, w)} height={bh} rx={4} fill={EMBER} />
            <text x={L + w + 7} y={y + bh / 2 + 3} fill="#9a8e85" fontSize={11}>{d.valor}</text>
          </g>
        );
      })}
    </svg>
  );
}
