'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { atualizarCampoCria } from '@/lib/actions';

// Campo de texto editável da Cria (e-mail / área / closer). Clique no lápis →
// edita → salva via Server Action. Se não puxar do ClickUp, edita aqui.
export function EditCampoCria({ criaId, campo, valor, placeholder, tipo = 'text' }: {
  criaId: string;
  campo: 'email' | 'area_atuacao' | 'closer';
  valor: string | null;
  placeholder?: string;
  tipo?: 'text' | 'email';
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(valor ?? '');
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    setErro(null);
    start(async () => {
      const r = await atualizarCampoCria(criaId, campo, draft);
      if (r.ok) { setEditando(false); router.refresh(); }
      else setErro(r.error ?? 'falhou');
    });
  }

  if (!editando) {
    return (
      <b className="inv-view" style={{ fontWeight: valor ? 700 : 400, color: valor ? undefined : 'var(--muted)' }}>
        {valor || '—'}
        <button type="button" className="inv-edit" title="Editar" onClick={() => { setDraft(valor ?? ''); setEditando(true); }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
        </button>
      </b>
    );
  }

  return (
    <span className="inv-editing">
      <input
        autoFocus
        type={tipo}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false); }}
        placeholder={placeholder ?? ''}
        style={{ minWidth: 200 }}
      />
      <button type="button" className="inv-ok" onClick={salvar} disabled={pending} title="Salvar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      </button>
      <button type="button" className="inv-cancel" onClick={() => setEditando(false)} title="Cancelar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {erro && <span className="inv-erro">{erro}</span>}
    </span>
  );
}
