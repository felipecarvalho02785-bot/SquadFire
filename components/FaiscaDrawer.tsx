'use client';

import { useEffect, useRef, useState } from 'react';

interface Msg { role: 'ai' | 'me'; text?: string; html?: string; voice?: string; speaking?: boolean }

const DEMO: Msg[] = [
  { role: 'ai', text: 'E aí, Felipe! Posso te ajudar em qualquer aba — por texto ou por voz. Pergunta ou pede que eu resolvo.' },
  { role: 'me', text: 'Quais Forjas estão atrasadas?', voice: '0:04' },
  { role: 'ai', html: '2 Forjas com Estopim estourado: <b>Letícia</b> (Treinamento, −2 dias) e <b>Mozini</b> (Treinamento, vence amanhã). Quer que eu abra a da Letícia ou avise o gestor?', speaking: true },
  { role: 'me', text: 'Agenda uma Roda de Fogo com a Letícia quinta 15h' },
];

const CHIPS = ['Forjas atrasadas', 'Prever SLA', 'Risco de churn', 'Agendar Roda'];

export function FaiscaDrawer() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(DEMO);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abrir = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('faisca:open', abrir);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('faisca:open', abrir); window.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  function enviar(texto: string) {
    const t = texto.trim();
    if (!t) return;
    setMsgs((m) => [...m, { role: 'me', text: t }]);
    setDraft('');
    setTimeout(() => {
      setMsgs((m) => [...m, { role: 'ai', text: 'Pra eu responder de verdade preciso das chaves de IA (Anthropic + Gemini) ligadas na Forjaria. A navegação e o contexto já estão prontos — assim que conectar, eu resolvo isso na hora.' }]);
    }, 550);
  }

  return (
    <div className={`fdrawer-ov${open ? ' open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <aside className="fdrawer" role="dialog" aria-label="Faísca" aria-hidden={!open}>
        <div className="fd-head">
          <span className="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" />
            </svg>
          </span>
          <div>
            <div className="t">Faísca</div>
            <div className="s">assistente do Squad 8 · Gemini + Claude</div>
          </div>
          <button className="x" aria-label="Fechar" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="fd-msgs">
          {msgs.map((m, i) => (
            <div className={`fd-msg ${m.role === 'me' ? 'me' : 'ai'}`} key={i}>
              {m.role === 'ai' && <div className="who">Faísca</div>}
              <div className="fd-bubble">
                {m.html ? <span dangerouslySetInnerHTML={{ __html: m.html }} /> : m.text}
              </div>
              {m.voice && (
                <div className="fd-sig right">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3" /></svg>
                  mensagem de voz · {m.voice}
                </div>
              )}
              {m.speaking && (
                <div className="fd-sig">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4zM16 9a3 3 0 010 6M19 6a7 7 0 010 12" /></svg>
                  respondendo por voz
                  <span className="fd-eq"><i /><i /><i /></span>
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="fd-chips">
          {CHIPS.map((c) => <button className="fd-chip" key={c} onClick={() => enviar(c)}>{c}</button>)}
        </div>

        <form className="fd-input" onSubmit={(e) => { e.preventDefault(); enviar(draft); }}>
          <button type="button" className="fd-mic" aria-label="Falar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3" /></svg>
          </button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pergunte ou peça algo…" aria-label="Mensagem para a Faísca" />
          <button type="submit" className="fd-send" aria-label="Enviar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      </aside>
    </div>
  );
}
