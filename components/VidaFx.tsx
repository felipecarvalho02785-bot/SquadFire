'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Contagem animada dos números (KPIs, medidor, stats do hero) ao entrar na tela.
// Barato: só atualiza texto por rAF, curto, e roda 1x por elemento.
export function VidaFx() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setTimeout(() => {
      const els = document.querySelectorAll('.kpi .n, .kpi .k-val, .hero .g-stat .v, .meter-tags .big');
      els.forEach((node) => {
        const el = node as HTMLElement;
        if (el.dataset.counted) return;
        const raw = (el.textContent || '').trim();
        const m = raw.match(/^(\d[\d.]*)(\s*%?)$/);
        if (!m) return;
        const target = parseInt(m[1].replace(/\./g, ''), 10);
        if (!isFinite(target) || target <= 0) return;
        el.dataset.counted = '1';
        const suffix = m[2] || '';
        const dur = 500;
        const t0 = performance.now();
        function step(t: number) {
          const p = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * e) + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = target + suffix;
        }
        requestAnimationFrame(step);
      });
    }, 40);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
