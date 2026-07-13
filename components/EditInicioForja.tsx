'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { iniciarForja } from '@/lib/actions';

function fmt(d: string | null): string {
  if (!d) return '—';
  return new Date(d + (d.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR');
}

// Data de início da Forja (projeto). Definir dispara o cálculo dos prazos das 7
// fases — é o que liga o SLA e o Calendário. Só Projetos/Admin (checado no RPC).
export function EditInicioForja({ criaId, data }: { criaId: string; data: string | null }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(data ? data.slice(0, 10) : '');
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    if (!draft) { setErro('escolha uma data'); return; }
    setErro(null);
    start(async () => {
      const r = await iniciarForja(criaId, draft);
      if (r.ok) { setEditando(false); router.refresh(); }
      else setErro(r.error ?? 'falhou');
    });
  }

  if (!editando) {
    return (
      <b className="inv-view">
        <span className="mono">{fmt(data)}</span>
        <button type="button" className="inv-edit" title={data ? 'Alterar início da Forja' : 'Definir início da Forja'} onClick={() => setEditando(true)}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
        </button>
      </b>
    );
  }

  return (
    <span className="inv-editing">
      <input type="date" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false); }} />
      <button type="button" className="inv-ok" onClick={salvar} disabled={pending} title="Salvar e calcular prazos">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      </button>
      <button type="button" className="inv-cancel" onClick={() => setEditando(false)} title="Cancelar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {erro && <span className="inv-erro">{erro}</span>}
    </span>
  );
}
