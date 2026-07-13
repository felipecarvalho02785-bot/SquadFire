'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { criarTarefa, toggleLenha } from '@/lib/actions';
import type { PrioridadeLenha } from '@/lib/types/database';

export interface TaskRow {
  id: string;
  titulo: string;
  sub: string;
  tipo: 'forja' | 'rotina' | 'avulsa';
  who: string;
  whoNome: string;
  due: string;
  dueKind: '' | 'crit' | 'warn';
  done: boolean;
}
export interface MembroOpt {
  id: string;
  nome: string;
}

type Filtro = 'todas' | 'avulsa' | 'forja' | 'rotina' | 'atrasadas' | 'concluidas';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'avulsa', label: 'Do dia' },
  { key: 'forja', label: 'Lenha de Forja' },
  { key: 'rotina', label: 'Lenha de Rotina' },
  { key: 'atrasadas', label: 'Atrasadas' },
  { key: 'concluidas', label: 'Concluídas' },
];

const GRUPOS: { tipo: TaskRow['tipo']; titulo: string }[] = [
  { tipo: 'avulsa', titulo: 'Tarefas do dia' },
  { tipo: 'forja', titulo: 'Lenha de Forja' },
  { tipo: 'rotina', titulo: 'Lenha de Rotina' },
];

const TTAG: Record<TaskRow['tipo'], string> = { forja: 'Forja', rotina: 'Rotina', avulsa: 'Do dia' };

export function TarefasClient({ rows: initial, membros, meuId }: { rows: TaskRow[]; membros: MembroOpt[]; meuId: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<TaskRow[]>(initial);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [erro, setErro] = useState<string | null>(null);
  const [, startToggle] = useTransition();
  const [criando, startCriar] = useTransition();

  // formulário de nova tarefa
  const [titulo, setTitulo] = useState('');
  const [responsavel, setResponsavel] = useState(meuId ?? '');
  const [prazo, setPrazo] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeLenha>('media');

  // re-sincroniza quando o servidor revalida (após criar/refresh)
  useEffect(() => setRows(initial), [initial]);

  const filtradas = useMemo(() => {
    return rows.filter((r) => {
      switch (filtro) {
        case 'forja': return r.tipo === 'forja';
        case 'rotina': return r.tipo === 'rotina';
        case 'avulsa': return r.tipo === 'avulsa';
        case 'atrasadas': return r.dueKind === 'crit' && !r.done;
        case 'concluidas': return r.done;
        default: return true;
      }
    });
  }, [rows, filtro]);

  function toggle(id: string) {
    setErro(null);
    let novo = false;
    setRows((rs) => rs.map((r) => (r.id === id ? ((novo = !r.done), { ...r, done: novo }) : r)));
    startToggle(async () => {
      const res = await toggleLenha(id, novo);
      if (!res.ok) {
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, done: !novo } : r)));
        setErro(res.error ?? 'não deu para atualizar');
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = titulo.trim();
    if (!t) return;
    setErro(null);
    startCriar(async () => {
      const res = await criarTarefa({
        titulo: t,
        prazo: prazo || null,
        responsavelId: responsavel || null,
        prioridade,
      });
      if (!res.ok) {
        setErro(res.error ?? 'não deu para criar a tarefa');
        return;
      }
      setTitulo('');
      setPrazo('');
      setPrioridade('media');
      router.refresh();
    });
  }

  const grupos = GRUPOS.map((g) => ({ ...g, itens: filtradas.filter((r) => r.tipo === g.tipo) })).filter((g) => g.itens.length > 0);

  return (
    <>
      {/* criar / delegar tarefa do dia */}
      <form className="card tk-new" onSubmit={submit}>
        <input
          className="tkn-titulo"
          placeholder="Nova tarefa do dia…"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={160}
        />
        <label className="tkn-field">
          <span>Delegar a</span>
          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            <option value={meuId ?? ''}>Comigo</option>
            {membros
              .filter((m) => m.id !== meuId)
              .map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
          </select>
        </label>
        <label className="tkn-field">
          <span>Prazo</span>
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </label>
        <label className="tkn-field">
          <span>Prioridade</span>
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeLenha)}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </label>
        <button className="btn primary" type="submit" disabled={criando || !titulo.trim()}>
          {criando ? 'Adicionando…' : 'Adicionar'}
        </button>
      </form>

      {erro && <div className="tkn-erro">{erro}</div>}

      <div className="tkfilter">
        {FILTROS.map((f) => (
          <button key={f.key} className={filtro === f.key ? 'on' : ''} onClick={() => setFiltro(f.key)} type="button">
            {f.label}
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <div className="card"><div className="s" style={{ color: 'var(--muted)' }}>Nenhuma tarefa neste filtro.</div></div>
      ) : (
        grupos.map((g) => (
          <div className="card tkgroup" key={g.tipo}>
            <div className="tkg-h"><span className="tt">{g.titulo}</span><span className="ct">{g.itens.length}</span></div>
            {g.itens.map((t) => (
              <div className={`tk${t.done ? ' done' : ''}`} key={t.id}>
                <button
                  type="button"
                  className={`chk${t.done ? ' done' : ''}`}
                  onClick={() => toggle(t.id)}
                  aria-pressed={t.done}
                  aria-label={t.done ? 'Reabrir tarefa' : 'Concluir tarefa'}
                >
                  {t.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : null}
                </button>
                <span className={`ttag ${t.tipo}`}>{TTAG[t.tipo]}</span>
                <div className="rmain">
                  <div className="t">{t.titulo}</div>
                  <div className="s">{t.sub}</div>
                </div>
                {t.who && <span className="who" title={t.whoNome}>{t.who}</span>}
                <span className={`due ${t.dueKind}`}>{t.due}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </>
  );
}
