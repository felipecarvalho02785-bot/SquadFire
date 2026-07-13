'use client';

import { useState, useTransition } from 'react';
import { avancarFase } from '@/lib/actions';

// Botão "Avançar fase": chama a RPC; o banco recusa se houver Lenha pendente
// ou se o papel não for Projetos/Admin, e a mensagem volta pro usuário.
export function AvancarFaseBtn({ forjaId, disabled }: { forjaId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onClick() {
    setErro(null);
    startTransition(async () => {
      const r = await avancarFase(forjaId);
      if (!r.ok) setErro(traduzErro(r.error));
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button className="btn primary" onClick={onClick} disabled={pending || disabled}>
        {pending ? 'Avançando…' : 'Avançar fase'}
      </button>
      {erro && <div className="s" style={{ color: 'var(--risk)' }}>{erro}</div>}
    </div>
  );
}

function traduzErro(msg?: string) {
  if (!msg) return 'Não foi possível avançar.';
  if (msg.includes('pendente')) return 'Conclua as Lenhas da fase antes de avançar.';
  if (msg.toLowerCase().includes('permiss')) return 'Sem permissão (requer Projetos ou Admin).';
  return msg;
}
