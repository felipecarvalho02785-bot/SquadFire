'use client';

import { useEffect, useRef, useState } from 'react';

interface Msg { role: 'ai' | 'me'; text: string }

const SAUDACAO: Msg = {
  role: 'ai',
  text: 'E aí! Sou a Faísca, sua copiloto do Squad 8. Além de responder, eu AJO: crio Lenhas (tarefas), busco Crias e resumo seu dia. É só pedir — por texto ou voz. Ex.: "cria uma tarefa: ligar pro closer amanhã".',
};

const CHIPS = ['Cria uma Lenha pra hoje', 'Resumo do meu dia', 'Como está a Cria Letícia?', 'Alguma Cria em risco?'];

// Tipos do Web Speech API (não vêm no lib.dom padrão).
type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };

export function FaiscaDrawer() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([SAUDACAO]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [falar, setFalar] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const abrir = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('faisca:open', abrir);
    window.addEventListener('keydown', onKey);
    try { setFalar(localStorage.getItem('sf-faisca-voz') === '1'); } catch { /* ignora */ }
    return () => { window.removeEventListener('faisca:open', abrir); window.removeEventListener('keydown', onKey); };
  }, []);

  // Fecha o drawer → corta a fala em andamento.
  useEffect(() => { if (!open && typeof window !== 'undefined') window.speechSynthesis?.cancel(); }, [open]);

  // Lê a resposta em voz alta (pt-BR), se a voz estiver ligada.
  function dizer(texto: string) {
    if (!falar || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    const vozPt = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'));
    if (vozPt) u.voice = vozPt;
    window.speechSynthesis.speak(u);
  }

  function toggleFalar() {
    setFalar((v) => {
      const novo = !v;
      try { localStorage.setItem('sf-faisca-voz', novo ? '1' : '0'); } catch { /* ignora */ }
      if (!novo && typeof window !== 'undefined') window.speechSynthesis?.cancel();
      return novo;
    });
  }

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open, loading]);

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || loading) return;
    const proximas = [...msgs, { role: 'me', text: t } as Msg];
    setMsgs(proximas);
    setDraft('');
    setLoading(true);
    try {
      const payload = proximas.map((m) => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }));
      const res = await fetch('/api/faisca/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = (data.reply as string) || (data.error as string) || 'Não consegui responder agora — tenta de novo?';
      setMsgs((m) => [...m, { role: 'ai', text: reply }]);
      dizer(reply);
    } catch {
      setMsgs((m) => [...m, { role: 'ai', text: 'Falha de conexão com o servidor. Tenta de novo daqui a pouco.' }]);
    } finally {
      setLoading(false);
    }
  }

  function ouvir() {
    if (ouvindo) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setMsgs((m) => [...m, { role: 'ai', text: 'Ditado por voz não é suportado neste navegador — pode digitar que eu entendo igual.' }]); return; }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.onresult = (e) => { const txt = e.results[0][0].transcript; setDraft((d) => (d ? d + ' ' : '') + txt); };
    rec.onend = () => setOuvindo(false);
    recRef.current = rec;
    setOuvindo(true);
    rec.start();
  }

  return (
    <div className={`fdrawer-ov${open ? ' open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <aside className="fdrawer" role="dialog" aria-label="Faísca" aria-hidden={!open} inert={!open}>
        <div className="fd-head">
          <span className="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" />
            </svg>
          </span>
          <div>
            <div className="t">Faísca</div>
            <div className="s">assistente do Squad 8 · Google Gemini</div>
          </div>
          <button className={`fd-voz${falar ? ' on' : ''}`} aria-label={falar ? 'Desligar voz' : 'Ligar voz'} aria-pressed={falar} title={falar ? 'Voz ligada — clique para silenciar' : 'Ler respostas em voz alta'} onClick={toggleFalar}>
            {falar ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" /></svg>
            )}
          </button>
          <button className="x" aria-label="Fechar" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="fd-msgs">
          {msgs.map((m, i) => (
            <div className={`fd-msg ${m.role === 'me' ? 'me' : 'ai'}`} key={i}>
              {m.role === 'ai' && <div className="who">Faísca</div>}
              <div className="fd-bubble">{m.text}</div>
            </div>
          ))}
          {loading && (
            <div className="fd-msg ai">
              <div className="who">Faísca</div>
              <div className="fd-bubble"><span className="fd-typing"><i /><i /><i /></span></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="fd-chips">
          {CHIPS.map((c) => <button className="fd-chip" key={c} onClick={() => enviar(c)} disabled={loading}>{c}</button>)}
        </div>

        <form className="fd-input" onSubmit={(e) => { e.preventDefault(); enviar(draft); }}>
          <button type="button" className={`fd-mic${ouvindo ? ' on' : ''}`} aria-label="Falar" onClick={ouvir}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3" /></svg>
          </button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={ouvindo ? 'Ouvindo…' : 'Pergunte ou peça algo…'} aria-label="Mensagem para a Faísca" disabled={loading} />
          <button type="submit" className="fd-send" aria-label="Enviar" disabled={loading || !draft.trim()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      </aside>
    </div>
  );
}
