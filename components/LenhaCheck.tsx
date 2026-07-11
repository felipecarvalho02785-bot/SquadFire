'use client';

import { useState, useTransition } from 'react';
import { toggleLenha } from '@/lib/actions';

// Checkbox de uma Lenha: alterna concluída/pendente via Server Action.
// Otimista: reflete o clique na hora e reverte se o servidor recusar.
export function LenhaCheck({
  id,
  titulo,
  done,
  sub,
}: {
  id: string;
  titulo: string;
  done: boolean;
  sub?: string;
}) {
  const [checked, setChecked] = useState(done);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onClick() {
    const novo = !checked;
    setChecked(novo);
    setErro(null);
    startTransition(async () => {
      const r = await toggleLenha(id, novo);
      if (!r.ok) {
        setChecked(!novo); // reverte
        setErro(r.error ?? 'falhou');
      }
    });
  }

  return (
    <div className="row" style={{ cursor: 'pointer', opacity: pending ? 0.6 : 1 }} onClick={onClick}>
      <span className={`badge ${checked ? 'ok' : 'dim'}`}>{checked ? '✓' : '○'}</span>
      <div className="grow">
        <div className="t" style={{ textDecoration: checked ? 'line-through' : 'none' }}>
          {titulo}
        </div>
        {sub && !erro && <div className="s">{sub}</div>}
        {erro && <div className="s" style={{ color: 'var(--risk)' }}>{erro}</div>}
      </div>
    </div>
  );
}
