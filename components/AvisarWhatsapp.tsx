'use client';

import { useState, useTransition } from 'react';
import { avisarCriaWhatsapp } from '@/lib/actions';

// Dispara uma mensagem no WhatsApp do cliente (Evolution API) e registra como
// comentário na Cria. Fica escondido atrás de um botão pra não poluir a tela.
export function AvisarWhatsapp({ criaId }: { criaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, start] = useTransition();

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    setMsg(null);
    start(async () => {
      const r = await avisarCriaWhatsapp(criaId, t);
      if (r.ok) {
        setOk(true); setMsg('Enviado ✓'); setTexto('');
        setTimeout(() => { setMsg(null); setAberto(false); }, 1600);
      } else {
        setOk(false); setMsg(r.error ?? 'não deu para enviar');
      }
    });
  }

  if (!aberto) {
    return <button type="button" className="btn" onClick={() => setAberto(true)}>Avisar no WhatsApp</button>;
  }

  return (
    <div className="wa-box">
      <textarea className="roda-nota" rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensagem pro grupo do cliente…" />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
        <button className="btn primary" onClick={enviar} disabled={enviando || !texto.trim()}>{enviando ? 'Enviando…' : 'Enviar'}</button>
        <button className="btn" onClick={() => { setAberto(false); setMsg(null); }}>Cancelar</button>
        {msg && <span className="s" style={{ color: ok ? 'var(--ember-hi)' : 'var(--risk)' }}>{msg}</span>}
      </div>
    </div>
  );
}
