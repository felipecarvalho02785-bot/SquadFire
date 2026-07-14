'use client';

import { useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHIPS = [
  'Resumir a semana da Cria X',
  'Rascunhar o briefing (6 campos) do áudio',
  'Ler o contrato e extrair valor + data de início',
  'Quais Crias estão em risco e por quê?',
  'Plano de ação pro gargalo da fase 2',
  'Fechar meu relatório do dia',
];

// Chat real da página /faisca — usa a mesma rota do drawer (/api/faisca/chat),
// que já roda a Faísca com ferramentas. Antes a página era só uma fachada.
export function FaiscaPageChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || pensando) return;
    const novo: Msg[] = [...messages, { role: 'user', content: t }];
    setMessages(novo);
    setInput('');
    setPensando(true);
    try {
      const r = await fetch('/api/faisca/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: novo }),
      });
      const data = await r.json().catch(() => ({}));
      setMessages((m) => [...m, { role: 'assistant', content: data.reply ?? 'Não consegui responder agora — tenta de novo?' }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Tive um problema pra falar com a IA agora. Tenta de novo daqui a pouco?' }]);
    } finally {
      setPensando(false);
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow">Peça algo à Faísca</div>

        {messages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0', maxHeight: 440, overflowY: 'auto' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                  background: m.role === 'user' ? 'color-mix(in srgb, var(--ember-hi, #f2760c) 16%, transparent)' : 'color-mix(in srgb, var(--fg, #fff) 6%, transparent)',
                }}
              >
                {m.content}
              </div>
            ))}
            {pensando && <div className="s" style={{ color: 'var(--muted)' }}>Faísca pensando…</div>}
            <div ref={fimRef} />
          </div>
        )}

        <form className="fa-composer" onSubmit={(e) => { e.preventDefault(); enviar(input); }}>
          <textarea
            placeholder="Ex.: quais Crias estão em risco e por quê?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviar(input); } }}
          />
          <div className="bar">
            <span className="s" style={{ color: 'var(--faint)' }}>Pipeline de IA no Google Gemini · Ctrl+Enter envia</span>
            <button className="btn primary" type="submit" disabled={pensando || !input.trim()}>{pensando ? 'Pensando…' : 'Acender a Faísca'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="eyebrow">O que a Faísca faz</div>
        <div className="fa-chips">
          {CHIPS.map((c) => (
            <button className="fa-chip" key={c} type="button" onClick={() => enviar(c)} disabled={pensando}>{c}</button>
          ))}
        </div>
        <p className="s" style={{ marginTop: 14, color: 'var(--muted)' }}>
          Catálogo completo em <code>docs/faisca-capacidades.md</code>. O briefing por áudio já tem o
          pipeline (gravar → transcrever → estruturar 6 campos) na página de cada Cria.
        </p>
      </div>
    </>
  );
}
