'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { definirGestorContas } from '@/lib/actions';

interface MembroOpt { id: string; nome: string }

// Dropdown do Gestor de Contas da Cria. Salva na hora ao trocar.
export function EditGestorContas({ criaId, atual, membros }: { criaId: string; atual: string | null; membros: MembroOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function trocar(membroId: string) {
    setErro(null);
    start(async () => {
      const r = await definirGestorContas(criaId, membroId || null);
      if (r.ok) router.refresh();
      else setErro(r.error ?? 'falhou');
    });
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <select className="selin" defaultValue={atual ?? ''} onChange={(e) => trocar(e.target.value)} disabled={pending}>
        <option value="">— sem gestor —</option>
        {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
      {erro && <span className="s" style={{ color: 'var(--risk)' }}>{erro}</span>}
    </span>
  );
}
