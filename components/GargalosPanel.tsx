'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { criarGargalo, atualizarStatusGargalo } from '@/lib/actions';
import type { GargaloView } from '@/lib/data/crias';

const COR: Record<GargaloView['status'], string> = { aberto: 'risk', em_resolucao: 'warn', resolvido: 'ember-hi' };
const LABEL: Record<GargaloView['status'], string> = { aberto: 'Aberto', em_resolucao: 'Em resolução', resolvido: 'Resolvido' };

// Gerencia os gargalos da Cria: cria, avança status e resolve. RLS garante o
// gate de papel (Contas/Projetos/Admin).
export function GargalosPanel({ criaId, gargalos }: { criaId: string; gargalos: GargaloView[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const d = draft.trim();
    if (!d) return;
    setErro(null);
    start(async () => {
      const r = await criarGargalo(criaId, d);
      if (r.ok) { setDraft(''); router.refresh(); }
      else setErro(r.error ?? 'não deu para abrir o gargalo');
    });
  }

  function mudar(id: string, status: GargaloView['status']) {
    setErro(null);
    start(async () => {
      const r = await atualizarStatusGargalo(id, status);
      if (r.ok) router.refresh();
      else setErro(r.error ?? 'não deu para atualizar');
    });
  }

  return (
    <div className="garg">
      <form className="garg-new" onSubmit={adicionar}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Descreva um novo gargalo…" maxLength={280} />
        <button className="btn primary" type="submit" disabled={pending || !draft.trim()}>Abrir gargalo</button>
      </form>
      {erro && <div className="garg-erro">{erro}</div>}

      {gargalos.length === 0 ? (
        <div className="s" style={{ color: 'var(--muted)', paddingTop: 6 }}>Nenhum gargalo aberto — Forja fluindo.</div>
      ) : (
        <div className="garg-list">
          {gargalos.map((g) => (
            <div className={`garg-row${g.status === 'resolvido' ? ' done' : ''}`} key={g.id} style={{ borderLeftColor: `var(--${COR[g.status]})` }}>
              <div className="rmain">
                <div className="t">{g.descricao}</div>
                <div className="s"><span className={`stbadge ${g.status === 'resolvido' ? 'on' : 'off'}`}>{LABEL[g.status]}</span></div>
              </div>
              <div className="garg-acts">
                {g.status === 'aberto' && <button className="btn" onClick={() => mudar(g.id, 'em_resolucao')} disabled={pending}>Em resolução</button>}
                {g.status !== 'resolvido' && <button className="btn" onClick={() => mudar(g.id, 'resolvido')} disabled={pending}>Resolver</button>}
                {g.status === 'resolvido' && <button className="btn" onClick={() => mudar(g.id, 'aberto')} disabled={pending}>Reabrir</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
