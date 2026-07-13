'use client';

import { useRef, useState, useTransition } from 'react';
import { adicionarComentario } from '@/lib/actions';

export function ComentarioForm({ criaId }: { criaId: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    const corpo = ref.current?.value ?? '';
    if (!corpo.trim()) return;
    setErro(null);
    startTransition(async () => {
      const r = await adicionarComentario(criaId, corpo);
      if (r.ok) {
        if (ref.current) ref.current.value = '';
      } else {
        setErro(r.error ?? 'falhou');
      }
    });
  }

  return (
    <div style={{ marginTop: 12 }}>
      <textarea
        ref={ref}
        placeholder="Escreva um comentário…"
        style={{
          width: '100%',
          minHeight: 68,
          background: 'var(--bg-2)',
          border: '1px solid var(--line-2)',
          borderRadius: 10,
          color: 'var(--ink)',
          padding: 10,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span className="s" style={{ color: erro ? 'var(--risk)' : 'var(--muted)' }}>
          {erro ?? 'Contas, Projetos e Admin comentam.'}
        </span>
        <button className="btn primary" onClick={enviar} disabled={pending}>
          {pending ? 'Enviando…' : 'Comentar'}
        </button>
      </div>
    </div>
  );
}
