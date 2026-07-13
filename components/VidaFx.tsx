'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Efeitos de "vida" globais: brilho que segue o cursor nos cards e
// contagem animada dos números (KPIs, medidor, stats do hero).
export function VidaFx() {
  const pathname = usePathname();

  // brilho no cursor — anexa uma vez
  useEffect(() => {
    let raf = 0;
    function onMove(e: MouseEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = e.target as Element | null;
        const card = el?.closest?.('.card') as HTMLElement | null;
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--sf-mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        card.style.setProperty('--sf-my', `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    }
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => { document.removeEventListener('mousemove', onMove); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // contagem dos números — roda a cada troca de página
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
        const dur = 850;
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
    }, 60);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
