'use client';

import { useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';

type Campos = {
  c1_o_que_aconteceu: string;
  c2_satisfacao: string;
  c3_campanhas: string;
  c4_nosso_desempenho: string;
  c5_pontos_atencao: string;
  c6_proximos_passos: string;
};

const LABELS: [keyof Campos, string][] = [
  ['c1_o_que_aconteceu', '1 · O que aconteceu'],
  ['c2_satisfacao', '2 · Satisfação'],
  ['c3_campanhas', '3 · Campanhas'],
  ['c4_nosso_desempenho', '4 · Nosso desempenho'],
  ['c5_pontos_atencao', '5 · Pontos de atenção'],
  ['c6_proximos_passos', '6 · Próximos passos'],
];

type Estado = 'idle' | 'gravando' | 'processando' | 'pronto' | 'erro';

export function AudioRecorder({ criaId }: { criaId: string }) {
  const [estado, setEstado] = useState<Estado>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [campos, setCampos] = useState<Campos | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function iniciar() {
    setMsg(null);
    setCampos(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void enviar(new Blob(chunksRef.current, { type: 'audio/webm' }));
      };
      rec.start();
      recRef.current = rec;
      setEstado('gravando');
    } catch {
      setEstado('erro');
      setMsg('Não foi possível acessar o microfone.');
    }
  }

  function parar() {
    recRef.current?.stop();
    setEstado('processando');
  }

  async function enviar(blob: Blob) {
    if (!isSupabaseConfigured) {
      setEstado('erro');
      setMsg('Supabase não configurado — grava, mas não há onde subir o áudio.');
      return;
    }
    try {
      const supabase = getSupabaseBrowser();
      const path = `${criaId}/${Date.now()}.webm`;
      const up = await supabase.storage.from('briefings').upload(path, blob, {
        contentType: 'audio/webm',
      });
      if (up.error) throw up.error;

      const res = await fetch('/api/faisca/briefing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ criaId, audioPath: path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'falhou');
      setCampos(data.campos as Campos);
      setEstado('pronto');
      setMsg(data.ok ? 'Briefing gerado e salvo.' : 'Briefing gerado (não salvo).');
    } catch (e) {
      setEstado('erro');
      setMsg(String((e as Error).message ?? e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {estado !== 'gravando' ? (
          <button className="btn primary" onClick={iniciar} disabled={estado === 'processando'}>
            {estado === 'processando' ? 'Processando…' : 'Gravar briefing'}
          </button>
        ) : (
          <button className="btn" onClick={parar}>
            Parar e gerar
          </button>
        )}
        {estado === 'gravando' && <span className="badge risk">● gravando</span>}
        {msg && (
          <span className="s" style={{ color: estado === 'erro' ? 'var(--risk)' : 'var(--muted)' }}>
            {msg}
          </span>
        )}
      </div>

      {campos && (
        <div style={{ marginTop: 14 }}>
          {LABELS.map(([key, label]) => (
            <div className="row" key={key}>
              <div className="grow">
                <div className="s">{label}</div>
                <div className="t" style={{ fontWeight: 500 }}>
                  {campos[key] || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
