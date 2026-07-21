'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sincronizarCriasAgora } from '@/lib/actions';

// "há X" a partir de um ISO — recalculado no cliente pra não depender do fuso do
// servidor nem "congelar" o texto (atualiza a cada 30s enquanto a aba fica aberta).
function haQuanto(iso: string | null): string {
  if (!iso) return 'nunca sincronizado';
  const ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms) || ms < 0) return 'agora mesmo';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

// Selo de frescor do espelho do ClickUp + botão "Atualizar agora" (pra todo
// mundo, não só admin). O sync roda em segundo plano ao abrir a lista; este
// botão força o pull na hora quando alguém quer garantir o dado mais recente.
export function CriasFrescor({ sincronizadoEm }: { sincronizadoEm: string | null }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [, setTick] = useState(0); // força re-render pro "há X" andar sozinho

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  function atualizar() {
    setErro(null);
    iniciar(async () => {
      const r = await sincronizarCriasAgora();
      if (!r.ok) setErro(r.error ?? 'falhou');
      else router.refresh();
    });
  }

  return (
    <div className="frescor">
      <span className="frescor-dot" data-on={pendente ? 'sync' : 'idle'} aria-hidden />
      <span className="frescor-txt">
        {pendente ? 'Sincronizando com o ClickUp…' : erro ? erro : `Espelho do ClickUp · ${haQuanto(sincronizadoEm)}`}
      </span>
      <button type="button" className="frescor-btn" onClick={atualizar} disabled={pendente}>
        {pendente ? '…' : 'Atualizar'}
      </button>
    </div>
  );
}
