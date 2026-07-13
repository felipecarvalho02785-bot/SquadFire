'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Busca de Crias na topbar. Enter (ou o ícone) navega para /crias?q=…, que
// filtra no servidor. Botão limpa a busca.
export function CriaSearch({ inicial = '' }: { inicial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(inicial);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const termo = q.trim();
    router.push(termo ? `/crias?q=${encodeURIComponent(termo)}` : '/crias');
  }

  return (
    <form className="cria-search" onSubmit={buscar} role="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar Cria…" aria-label="Buscar Cria" />
      {q && (
        <button type="button" className="cs-clear" aria-label="Limpar" onClick={() => { setQ(''); router.push('/crias'); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </form>
  );
}
