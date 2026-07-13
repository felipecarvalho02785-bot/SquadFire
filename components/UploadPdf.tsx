'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { vincularContrato, vincularDiagnostico } from '@/lib/actions';

// Vincula um PDF à Cria: sobe pro Storage (bucket privado) e grava o caminho
// via server action. Diagnóstico 360 → bucket entregaveis; Contrato → contratos.
export function UploadPdf({ criaId, kind, atual }: {
  criaId: string;
  kind: 'diagnostico' | 'contrato';
  atual: { url: string | null; nome: string | null };
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [iaMsg, setIaMsg] = useState<string | null>(null);
  const [enviando, start] = useTransition();

  const bucket = kind === 'contrato' ? 'contratos' : 'entregaveis';

  function escolher() { inputRef.current?.click(); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErro(null);
    if (file.type !== 'application/pdf') { setErro('envie um arquivo PDF'); return; }
    if (file.size > 20 * 1024 * 1024) { setErro('PDF muito grande (máx. 20 MB)'); return; }
    if (!isSupabaseConfigured) { setErro('no modo demonstração não dá pra subir arquivo'); return; }

    start(async () => {
      try {
        const supabase = getSupabaseBrowser();
        const path = `${criaId}/${kind}-${Date.now()}.pdf`;
        const up = await supabase.storage.from(bucket).upload(path, file, { contentType: 'application/pdf', upsert: true });
        if (up.error) throw up.error;
        const res = kind === 'contrato'
          ? await vincularContrato(criaId, path)
          : await vincularDiagnostico(criaId, path, file.name);
        if (!res.ok) throw new Error(res.error ?? 'não deu para vincular');
        router.refresh();

        // Faísca lê o PDF (extrai contrato / resume diagnóstico).
        setIaMsg('Faísca lendo o PDF…');
        try {
          const r = await fetch('/api/faisca/documento', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ criaId, kind, path }),
          });
          const data = await r.json().catch(() => ({}));
          if (data.ok) {
            setIaMsg(kind === 'contrato'
              ? `Faísca leu ✓${data.valor ? ` · valor ${Number(data.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}`
              : 'Diagnóstico resumido pela Faísca ✓');
            router.refresh();
          } else if (!data.skipped) {
            setIaMsg('PDF vinculado (a Faísca não conseguiu ler agora)');
          } else {
            setIaMsg(null);
          }
        } catch {
          setIaMsg('PDF vinculado (a Faísca não conseguiu ler agora)');
        }
      } catch (err) {
        setErro((err as Error).message ?? 'falha no upload');
      }
    });
  }

  return (
    <div className="pdfbox">
      {atual.url ? (
        <a className="pdflink" href={atual.url} target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
          {atual.nome || 'Abrir PDF'} ↗
        </a>
      ) : (
        <span className="s" style={{ color: 'var(--muted)' }}>Nenhum PDF vinculado ainda.</span>
      )}
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={onFile} />
      <button className="btn" type="button" onClick={escolher} disabled={enviando}>
        {enviando ? 'Enviando…' : atual.url ? 'Trocar PDF' : 'Vincular PDF'}
      </button>
      {iaMsg && <div className="s" style={{ color: 'var(--ember-hi)', marginTop: 6, flexBasis: '100%' }}>{iaMsg}</div>}
      {erro && <div className="s" style={{ color: 'var(--risk)', marginTop: 6, flexBasis: '100%' }}>{erro}</div>}
    </div>
  );
}
