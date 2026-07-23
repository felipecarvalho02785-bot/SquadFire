'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleLenha } from '@/lib/actions';
import { Spark } from '@/components/Spark';
import type { LenhaRow } from '@/lib/data/meudia';

// "Minhas Lenhas de hoje" com checkbox de verdade: concluir/reabrir reflete
// aqui e, como o server action revalida /tarefas, também na aba Tarefas.
export function MinhasLenhas({ lenhas: initial }: { lenhas: LenhaRow[] }) {
  const router = useRouter();
  const [lenhas, setLenhas] = useState<LenhaRow[]>(initial);
  const [erro, setErro] = useState<string | null>(null);
  const [spark, setSpark] = useState<string | null>(null);
  const [, start] = useTransition();

  // re-sincroniza quando o servidor revalida
  useEffect(() => setLenhas(initial), [initial]);

  function toggle(id: string) {
    if (!id) return;
    setErro(null);
    let novo = false;
    setLenhas((ls) => ls.map((l) => (l.id === id ? ((novo = !l.done), { ...l, done: novo }) : l)));
    if (novo) { setSpark(id); setTimeout(() => setSpark((s) => (s === id ? null : s)), 720); } // faísca ao concluir
    start(async () => {
      const res = await toggleLenha(id, novo);
      if (!res.ok) {
        setLenhas((ls) => ls.map((l) => (l.id === id ? { ...l, done: !novo } : l)));
        setErro(res.error ?? 'não deu para atualizar');
      } else {
        router.refresh();
      }
    });
  }

  if (lenhas.length === 0) {
    return <div className="s" style={{ color: 'var(--muted)' }}>Nada pendente atribuído a você.</div>;
  }

  return (
    <>
      {erro && <div className="tkn-erro">{erro}</div>}
      <div className="list">
        {lenhas.map((l, i) => (
          <div className={`lrow sf-reveal${l.done ? ' done' : ''}`} key={l.id} style={{ '--i': i } as React.CSSProperties}>
            <button
              type="button"
              className={`chk${l.done ? ' done' : ''}`}
              onClick={() => toggle(l.id)}
              aria-pressed={l.done}
              aria-label={l.done ? 'Reabrir Lenha' : 'Concluir Lenha'}
            >
              {l.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : null}
              {spark === l.id && <Spark />}
            </button>
            <div className="rmain">
              <div className="t" style={{ textDecoration: l.done ? 'line-through' : 'none', color: l.done ? 'var(--muted)' : undefined }}>{l.titulo}</div>
              <div className="s">{l.sub}</div>
            </div>
            {l.pill && <span className={`pill ${l.pill.kind}`}><span className="d" style={{ background: 'var(--risk)' }} />{l.pill.label}</span>}
            {l.repete && <span className="badge dim">{l.repete}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
