'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Puxa TODAS as Crias do ClickUp (dados + fase + comentários + diagnóstico),
// chamando o endpoint em lotes até zerar. Mostra o progresso.
export function PuxarTodosBtn() {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const cancelar = useRef(false);

  async function puxarTodos() {
    cancelar.current = false;
    setRodando(true); setErro(false); setMsg('Puxando…');
    let feitos = 0;
    try {
      for (let i = 0; i < 80; i++) { // teto de segurança
        if (cancelar.current) { setMsg(`Interrompido — ${feitos} Cria(s) atualizada(s)`); break; }
        const res = await fetch('/api/clickup/pull-todos', { method: 'POST' });
        const d = await res.json();
        if (!res.ok || !d.ok) { setErro(true); setMsg(d.error ?? 'não deu para puxar'); break; }
        feitos += d.processados;
        if (d.processados === 0 || d.restantes === 0) { setMsg(`Pronto — ${feitos} Cria(s) atualizada(s) do ClickUp ✓`); break; }
        setMsg(`Puxando… ${feitos} feitas, ${d.restantes} restantes`);
      }
      router.refresh();
    } catch {
      setErro(true); setMsg('falha de conexão');
    } finally {
      setRodando(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
      <button type="button" className="btn primary" onClick={puxarTodos} disabled={rodando}>
        {rodando ? 'Puxando…' : 'Puxar todos do ClickUp'}
      </button>
      {rodando && <button type="button" className="btn" onClick={() => { cancelar.current = true; }}>Cancelar</button>}
      {msg && <span className="s" style={{ color: erro ? 'var(--risk)' : 'var(--ember-hi)' }}>{msg}</span>}
    </div>
  );
}
