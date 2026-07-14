'use client';

import { useState } from 'react';

// Botão "Enviar prazos pro meu Google Agenda" (CRM → Google). Idempotente.
export function SyncGoogleBtn() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function sincronizar() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) { setOk(true); setMsg(`${data.total} prazo(s) no seu Google ✓`); }
      else { setOk(false); setMsg(data.error ?? 'não deu para sincronizar'); }
    } catch {
      setOk(false); setMsg('falha de conexão');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="btn" onClick={sincronizar} disabled={loading}>
        {loading ? 'Enviando…' : 'Enviar prazos pro Google'}
      </button>
      {msg && <span className="s" style={{ color: ok ? 'var(--ember-hi)' : 'var(--risk)' }}>{msg}</span>}
    </span>
  );
}
