'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { adicionarComentario } from '@/lib/actions';
import { LenhaCheck } from '@/components/LenhaCheck';
import { Topbar } from '@/components/Topbar';

export interface RodaProps {
  criaId: string;
  nome: string;
  area: string | null;
  faseOrdem: number;
  faseNome: string;
  gestorContas: string | null;
  cliente: string;
  proximas: { id: string; titulo: string; sub: string; done: boolean }[];
  googleConectado: boolean;
}

type Campos = {
  c1_o_que_aconteceu: string; c2_satisfacao: string; c3_campanhas: string;
  c4_nosso_desempenho: string; c5_pontos_atencao: string; c6_proximos_passos: string;
};
const CAMPO_LABEL: [keyof Campos, string][] = [
  ['c1_o_que_aconteceu', 'O que aconteceu essa semana'],
  ['c2_satisfacao', 'Satisfação'],
  ['c3_campanhas', 'Campanhas'],
  ['c4_nosso_desempenho', 'Nosso desempenho'],
  ['c5_pontos_atencao', 'Pontos de atenção'],
  ['c6_proximos_passos', 'Próximos passos'],
];

const PAUTA_PADRAO = [
  { t: 'Retrospecto da semana', min: 5 },
  { t: 'Gargalos e travas', min: 10 },
  { t: 'Satisfação e NPS', min: 7 },
  { t: 'Próximos passos e Lenhas', min: 8 },
];

type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; onresult: (e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void; onerror: () => void; onend: () => void; start: () => void; stop: () => void };
type Estado = 'idle' | 'gravando' | 'processando' | 'pronto' | 'erro';

function mmss(s: number) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

export function RodaDeFogo({ criaId, nome, area, faseOrdem, faseNome, gestorContas, cliente, proximas, googleConectado }: RodaProps) {
  const [estado, setEstado] = useState<Estado>('idle');
  const [seg, setSeg] = useState(0);
  const [pauta, setPauta] = useState(PAUTA_PADRAO.map((p) => ({ ...p, done: false })));
  const [transcricao, setTranscricao] = useState('');
  const [campos, setCampos] = useState<Campos | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [notaOk, setNotaOk] = useState(false);
  const [salvandoNota, startNota] = useTransition();

  // Agendar a Roda de Fogo no Google Agenda
  const [quando, setQuando] = useState('');
  const [dur, setDur] = useState(30);
  const [agLink, setAgLink] = useState<string | null>(null);
  const [agErro, setAgErro] = useState<string | null>(null);
  const [agendando, startAgendar] = useTransition();

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<SpeechRec | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Sugere um horário padrão (amanhã 10:00) — feito no cliente pra não quebrar
  // a hidratação (datetime-local depende do fuso do navegador).
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setQuando(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }, []);

  function agendarNoGoogle() {
    setAgErro(null); setAgLink(null);
    if (!quando) { setAgErro('escolha a data e a hora'); return; }
    const inicio = new Date(quando);
    const fim = new Date(inicio.getTime() + dur * 60000);
    startAgendar(async () => {
      try {
        const res = await fetch('/api/google/roda', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            titulo: `Roda de Fogo · ${nome}`,
            descricao: `Reunião semanal${faseOrdem ? ` · Fase ${faseOrdem} — ${faseNome}` : ''}`,
            inicioISO: inicio.toISOString(), fimISO: fim.toISOString(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) { setAgErro(data.error ?? 'não deu para agendar'); return; }
        setAgLink(data.htmlLink ?? null);
      } catch {
        setAgErro('não deu para agendar — tenta de novo');
      }
    });
  }

  async function iniciar() {
    setMsg(null); setCampos(null); setTranscricao('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void gerar(new Blob(chunksRef.current, { type: 'audio/webm' }));
      };
      rec.start();
      recRef.current = rec;
      setSeg(0);
      timerRef.current = setInterval(() => setSeg((s) => s + 1), 1000);
      setEstado('gravando');
      ouvirAoVivo();
    } catch {
      setEstado('erro');
      setMsg('Não consegui acessar o microfone — libera o acesso e tenta de novo.');
    }
  }

  // Transcrição ao vivo (best-effort, browser). O texto autoritativo vem do
  // Gemini ao encerrar.
  function ouvirAoVivo() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = true;
    let acc = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) acc += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      setTranscricao((acc + interim).trim());
    };
    rec.onerror = () => {};
    rec.onend = () => {};
    speechRef.current = rec;
    try { rec.start(); } catch { /* ignora */ }
  }

  function encerrar() {
    if (estado !== 'gravando') { setMsg('Grave a reunião antes de gerar o briefing.'); return; }
    if (timerRef.current) clearInterval(timerRef.current);
    try { speechRef.current?.stop(); } catch { /* ignora */ }
    setEstado('processando');
    recRef.current?.stop(); // dispara onstop → gerar()
  }

  async function gerar(blob: Blob) {
    if (!isSupabaseConfigured) {
      setEstado('erro');
      setMsg('Modo demonstração — sem banco pra subir o áudio. Em produção isso grava e a Faísca monta o briefing.');
      return;
    }
    try {
      const supabase = getSupabaseBrowser();
      const path = `${criaId}/${Date.now()}.webm`;
      const up = await supabase.storage.from('briefings').upload(path, blob, { contentType: 'audio/webm' });
      if (up.error) throw up.error;
      const res = await fetch('/api/faisca/briefing', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ criaId, audioPath: path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'falhou');
      setCampos(data.campos as Campos);
      setEstado('pronto');
      setMsg(
        data.ok
          ? `Briefing gerado e anexado à Cria${data.clickup?.enviado ? ' · publicado no ClickUp ✓' : ''}.`
          : 'Briefing gerado (não salvo no banco).',
      );
    } catch (e) {
      setEstado('erro');
      setMsg(String((e as Error).message ?? e));
    }
  }

  function salvarNota() {
    const t = nota.trim();
    if (!t) return;
    startNota(async () => {
      const r = await adicionarComentario(criaId, `[Roda de Fogo] ${t}`);
      if (r.ok) { setNota(''); setNotaOk(true); setTimeout(() => setNotaOk(false), 1800); }
      else setMsg(r.error ?? 'não deu para salvar a nota');
    });
  }

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div className="main">
      <Topbar title={`Roda de Fogo · ${nome}`} sub="reunião semanal" />
      <div className="content grid detalhe-wrap">
        <a className="back" href={`/crias/${criaId}`}>‹ Voltar pra Cria</a>

        {/* hero */}
        <div className="dtop">
          <span className="dav roda-av">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c1.8 3-1 4-.7 6.3.3 1.8 2.2 2 2-.2 1.7 1.3 2.5 3.4 2.2 5.4C16.9 19 14.7 22 12 22c-3.1 0-5.4-2.4-5.4-5.6 0-2.5 1.5-4 2.4-5.2.5 1.7 2.2 1.4 2.1-.4C11 8.5 9.6 6 12 3z" /></svg>
          </span>
          <div className="dinfo">
            <h2>Roda de Fogo · {nome}</h2>
            <p>Reunião semanal · {dataHoje}{faseOrdem ? ` · Fase ${faseOrdem} — ${faseNome}` : ''}</p>
          </div>
          {estado === 'gravando' && (
            <span className="roda-live"><span className="d" />Ao vivo <b className="mono">{mmss(seg)}</b></span>
          )}
        </div>

        {/* participantes */}
        <div className="roda-parts">
          {gestorContas && <span className="rp"><span className="rp-av">{iniciais(gestorContas)}</span>{gestorContas}<small>gestor de contas</small></span>}
          <span className="rp"><span className="rp-av cli">{iniciais(cliente)}</span>{cliente}<small>cliente</small></span>
        </div>

        <div className="grid g-2">
          {/* ── coluna esquerda ── */}
          <div style={{ display: 'grid', gap: 14 }}>
            {/* pauta */}
            <div className="card">
              <div className="c-h"><span className="t">Pauta</span><span className="s">{pauta.length} tópicos · {pauta.reduce((a, p) => a + p.min, 0)} min</span></div>
              <div className="list">
                {pauta.map((p, i) => (
                  <div className={`row roda-pt${p.done ? ' done' : ''}`} key={i} onClick={() => setPauta((ps) => ps.map((x, j) => j === i ? { ...x, done: !x.done } : x))}>
                    <span className={`chk${p.done ? ' done' : ''}`}>{p.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : null}</span>
                    <div className="rmain"><div className="t">{p.t}</div></div>
                    <span className="rside">{p.min} min</span>
                  </div>
                ))}
              </div>
            </div>

            {/* gravação */}
            <div className="card">
              <div className="c-h"><span className="t">Gravação do briefing</span><span className="s">a Faísca ouve e transcreve (Gemini)</span></div>
              <div className="roda-rec">
                <button type="button" className={`rec-btn${estado === 'gravando' ? ' on' : ''}`} onClick={estado === 'gravando' ? encerrar : iniciar} disabled={estado === 'processando'} aria-label={estado === 'gravando' ? 'Parar' : 'Gravar'}>
                  {estado === 'gravando' ? <span className="rec-stop" /> : <span className="rec-dot" />}
                </button>
                <div className="rec-main">
                  <div className="t">{estado === 'gravando' ? 'Gravando o briefing…' : estado === 'processando' ? 'Processando com a Faísca…' : estado === 'pronto' ? 'Briefing pronto' : 'Toque para gravar a reunião'}</div>
                  <div className="s">áudio + transcrição são anexados à Cria ao encerrar</div>
                </div>
                {estado === 'gravando' && <span className="rec-wave"><i /><i /><i /><i /><i /></span>}
                <span className="rec-time mono">{mmss(seg)}</span>
              </div>
              {msg && <div className="s" style={{ color: estado === 'erro' ? 'var(--risk)' : 'var(--ember-hi)', marginTop: 10 }}>{msg}</div>}
              {transcricao && (
                <>
                  <div className="c-h" style={{ margin: '16px 0 6px' }}><span className="t">Transcrição ao vivo</span><span className="chip good">Gemini</span></div>
                  <p className="transc">{transcricao}</p>
                </>
              )}
              {campos && (
                <div className="report" style={{ marginTop: 14 }}>
                  {CAMPO_LABEL.map(([k, label]) => (
                    <div className="rsec" key={k}><div className="rl">{label}</div><div className="rt">{campos[k] || '—'}</div></div>
                  ))}
                </div>
              )}
            </div>

            {/* notas */}
            <div className="card">
              <div className="c-h"><span className="t">Notas</span><span className="s">visíveis pra Brigada (viram comentário na Cria)</span></div>
              <textarea className="roda-nota" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escreva uma nota da Roda de Fogo…" />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <button className="btn" onClick={salvarNota} disabled={salvandoNota || !nota.trim()}>{salvandoNota ? 'Salvando…' : 'Salvar nota'}</button>
                {notaOk && <span className="s" style={{ color: 'var(--ember-hi)' }}>Nota salva ✓</span>}
              </div>
            </div>
          </div>

          {/* ── coluna direita ── */}
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <div className="card">
              <div className="c-h"><span className="t">Detalhes</span></div>
              <div className="dl">
                <div className="drow"><span>Cria</span><b>{nome}</b></div>
                <div className="drow"><span>Área</span><b>{area ?? '—'}</b></div>
                <div className="drow"><span>Tipo</span><b>Reunião semanal</b></div>
                <div className="drow"><span>Fase</span><b>{faseOrdem ? `${faseOrdem} de 7 · ${faseNome}` : 'Backlog'}</b></div>
                <div className="drow"><span>Data</span><b className="mono">{dataHoje}</b></div>
              </div>
            </div>

            {/* agendar no Google Agenda */}
            <div className="card">
              <div className="c-h"><span className="t">Agendar no Google Agenda</span>{googleConectado && <span className="chip good">conectado</span>}</div>
              {googleConectado ? (
                <>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input type="datetime-local" className="txtin" style={{ flex: 1 }} value={quando} onChange={(e) => setQuando(e.target.value)} />
                    <select className="selin" value={dur} onChange={(e) => setDur(Number(e.target.value))}>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>1 h</option>
                    </select>
                  </div>
                  <button className="btn primary" style={{ marginTop: 10 }} onClick={agendarNoGoogle} disabled={agendando}>
                    {agendando ? 'Agendando…' : 'Agendar Roda de Fogo'}
                  </button>
                  {agLink && <div className="s" style={{ marginTop: 8 }}><a href={agLink} target="_blank" rel="noreferrer" style={{ color: 'var(--ember-hi)' }}>Evento criado — abrir no Google ↗</a></div>}
                  {agErro && <div className="s" style={{ color: 'var(--risk)', marginTop: 8 }}>{agErro}</div>}
                </>
              ) : (
                <p className="s" style={{ color: 'var(--muted)' }}>Conecte o Google Agenda em <a href="/forjaria" style={{ color: 'var(--ember-hi)' }}>Configurações</a> pra agendar a reunião direto no seu calendário.</p>
              )}
            </div>

            <div className="card">
              <div className="c-h"><span className="t">Próximos passos</span><span className="s">Lenhas da fase</span></div>
              {proximas.length === 0 ? (
                <div className="s" style={{ color: 'var(--muted)' }}>Sem Lenhas na fase corrente.</div>
              ) : (
                <div className="list">
                  {proximas.map((l) => <LenhaCheck key={l.id} id={l.id} titulo={l.titulo} done={l.done} sub={l.sub} />)}
                </div>
              )}
            </div>

            <div className="card roda-brief">
              <span className="rb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" /></svg></span>
              <p className="s">Ao <b>encerrar a Roda de Fogo</b>, a Faísca transcreve o áudio e monta o <b>briefing semanal</b> (6 campos) no Gemini — automaticamente, anexado à Cria.</p>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="roda-foot">
          <button className="btn" onClick={() => { setMsg('Rascunho salvo localmente.'); }}>Salvar rascunho</button>
          <button className="btn primary" onClick={encerrar} disabled={estado === 'processando' || estado === 'pronto'}>
            {estado === 'processando' ? 'Gerando…' : estado === 'pronto' ? 'Briefing gerado ✓' : 'Encerrar e gerar briefing'}
          </button>
        </div>
      </div>
    </div>
  );
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'SF';
}
