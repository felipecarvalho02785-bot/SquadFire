'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// Puxa o PDF do Diagnóstico 360 do comentário da task do cliente no ClickUp e
// anexa no CRM (a Faísca resume). Botão discreto ao lado do "Vincular PDF".
export function ImportarDiagnostico({ criaId }: { criaId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, start] = useTransition();

  function puxar() {
    setMsg(null);
    start(async () => {
      try {
        const r = await fetch('/api/clickup/diagnostico', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ criaId }),
        });
        const d = await r.json();
        if (d.ok) {
          const partes: string[] = [];
          if (d.diagnostico) partes.push(`diagnóstico${d.resumido ? ' resumido' : ''}`);
          if (d.dados) partes.push('dados + fase');
          setOk(true); setMsg(`Puxado do ClickUp: ${partes.join(' + ') || 'ok'} ✓`); router.refresh();
        } else { setOk(false); setMsg(d.error ?? 'não deu para puxar'); }
      } catch {
        setOk(false); setMsg('falha de conexão');
      }
    });
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="btn" onClick={puxar} disabled={loading}>
        {loading ? 'Puxando…' : 'Puxar do ClickUp'}
      </button>
      {msg && <span className="s" style={{ color: ok ? 'var(--ember-hi)' : 'var(--risk)' }}>{msg}</span>}
    </span>
  );
}
