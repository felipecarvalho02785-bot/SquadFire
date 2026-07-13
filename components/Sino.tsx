'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface AlertaItem { tipo: string; titulo: string; sub: string; kind: 'crit' | 'warn' | 'info'; href: string }

// Sino de notificações: busca os alertas do membro (/api/alertas) e mostra num
// dropdown. Alertas derivados do estado atual (SLA, briefings, Lenhas atrasadas).
export function Sino() {
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<AlertaItem[]>([]);
  const [carregou, setCarregou] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/alertas')
      .then((r) => r.json())
      .then((d) => setItens(Array.isArray(d.itens) ? d.itens : []))
      .catch(() => {})
      .finally(() => setCarregou(true));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, []);

  const n = itens.length;

  return (
    <div className="sino-wrap" ref={ref}>
      <button type="button" className="bell" aria-label={`Notificações${n ? ` (${n})` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {n > 0 && <span className="dot-n">{n}</span>}
      </button>
      {open && (
        <div className="sino-pop" role="dialog" aria-label="Notificações">
          <div className="sino-h"><span>Notificações</span>{n > 0 && <span className="badge risk">{n}</span>}</div>
          {!carregou ? (
            <div className="sino-empty">carregando…</div>
          ) : n === 0 ? (
            <div className="sino-empty">Nada pegando fogo agora. 🔥</div>
          ) : (
            <div className="sino-list">
              {itens.map((a, i) => (
                <Link className="sino-row" href={a.href} key={i} onClick={() => setOpen(false)}>
                  <span className={`sino-dot ${a.kind}`} />
                  <div className="sino-main"><div className="t">{a.titulo}</div><div className="s">{a.sub}</div></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
