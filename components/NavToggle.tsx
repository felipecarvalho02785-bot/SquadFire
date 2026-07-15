'use client';

import { useEffect } from 'react';

// Botão hambúrguer (só aparece no mobile via CSS) + overlay. Abre/fecha o drawer
// da Sidebar alternando a classe `sf-nav-open` na raiz <html>. Fecha no Esc e no
// clique do overlay. A Sidebar fecha ao clicar num item (ver Sidebar.tsx).
export function NavToggle() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') document.documentElement.classList.remove('sf-nav-open');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-label="Abrir menu"
        onClick={() => document.documentElement.classList.toggle('sf-nav-open')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className="nav-overlay" aria-hidden="true" onClick={() => document.documentElement.classList.remove('sf-nav-open')} />
    </>
  );
}
