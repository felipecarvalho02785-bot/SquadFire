'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { criarItemBiblioteca, excluirItemBiblioteca } from '@/lib/actions';

export interface BiblioItem {
  id: string; titulo: string; tipo: 'roteiro' | 'criativo'; conteudo: string | null;
  arquivoUrl: string | null; arquivoNome: string | null;
  criaId: string | null; criaNome: string | null; autorId: string | null; criadoEm: string;
  fonte: 'app' | 'drive'; tema: string | null; thumbUrl: string | null; mimeType: string | null;
}
interface CriaOpt { id: string; nome: string }

type Filtro = 'todos' | 'roteiro' | 'criativo';
const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'roteiro', label: 'Roteiros' },
  { key: 'criativo', label: 'Criativos' },
];

export function BibliotecaClient({
  itens, crias, meuId, temas = [], driveConfigurado = false, driveErro = null, driveTruncado = false, ehAdmin = false,
}: {
  itens: BiblioItem[]; crias: CriaOpt[]; meuId: string | null;
  temas?: string[]; driveConfigurado?: boolean; driveErro?: string | null; driveTruncado?: boolean; ehAdmin?: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [temaSel, setTemaSel] = useState('');
  const [abrir, setAbrir] = useState(false);

  // formulário
  const [tipo, setTipo] = useState<'roteiro' | 'criativo'>('roteiro');
  const [titulo, setTitulo] = useState('');
  const [criaId, setCriaId] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const vis = itens.filter((it) => (filtro === 'todos' || it.tipo === filtro) && (temaSel === '' || it.tema === temaSel));

  function limpar() { setTitulo(''); setConteudo(''); setArquivo(null); setCriaId(''); setErro(null); }

  function salvar() {
    setErro(null);
    const t = titulo.trim();
    if (!t) { setErro('informe um título'); return; }
    if (tipo === 'roteiro' && !conteudo.trim()) { setErro('escreva o roteiro'); return; }
    if (tipo === 'criativo' && !arquivo) { setErro('anexe o arquivo do criativo'); return; }

    start(async () => {
      let arquivoPath: string | null = null;
      let arquivoNome: string | null = null;
      if (tipo === 'criativo' && arquivo) {
        if (!isSupabaseConfigured) { setErro('no modo demonstração não dá pra subir arquivo'); return; }
        if (arquivo.size > 25 * 1024 * 1024) { setErro('arquivo muito grande (máx. 25 MB)'); return; }
        try {
          const supabase = getSupabaseBrowser();
          const safe = arquivo.name.replace(/[^\w.\-]+/g, '_');
          arquivoPath = `biblioteca/${Date.now()}-${safe}`;
          const up = await supabase.storage.from('entregaveis').upload(arquivoPath, arquivo, { upsert: true });
          if (up.error) throw up.error;
          arquivoNome = arquivo.name;
        } catch (e) { setErro((e as Error).message ?? 'falha no upload'); return; }
      }
      const r = await criarItemBiblioteca({ titulo: t, tipo, conteudo, arquivoPath, arquivoNome, criaId: criaId || null });
      if (!r.ok) { setErro(r.error ?? 'não deu para salvar'); return; }
      limpar(); setAbrir(false); router.refresh();
    });
  }

  function excluir(id: string) {
    if (!confirm('Remover este item do acervo?')) return;
    start(async () => { const r = await excluirItemBiblioteca(id); if (r.ok) router.refresh(); else setErro(r.error ?? 'falhou'); });
  }

  async function copiar(id: string, texto: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(id); setTimeout(() => setCopiado(null), 1500); } catch { /* ignora */ }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="tkfilter" style={{ margin: 0 }}>
          {FILTROS.map((f) => (
            <button key={f.key} type="button" className={filtro === f.key ? 'on' : ''} onClick={() => setFiltro(f.key)}>{f.label}</button>
          ))}
        </div>
        {temas.length > 0 && (
          <select className="selin" value={temaSel} onChange={(e) => setTemaSel(e.target.value)} style={{ maxWidth: 220 }} aria-label="Filtrar por tema">
            <option value="">Todos os temas</option>
            {temas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <button type="button" className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => setAbrir((v) => !v)}>
          {abrir ? 'Fechar' : '+ Adicionar ao acervo'}
        </button>
      </div>

      {/* Avisos de status do Drive (discretos) */}
      {driveErro && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="s" style={{ color: 'var(--muted)' }}>Google Drive: {driveErro} — mostrando o resto do acervo.</div>
        </div>
      )}
      {driveTruncado && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="s" style={{ color: 'var(--muted)' }}>Acervo grande no Drive — mostrando os primeiros itens.</div>
        </div>
      )}
      {!driveConfigurado && ehAdmin && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="s" style={{ color: 'var(--muted)' }}>
            O Google Drive ainda não está conectado. Conecte a pasta compartilhada para o acervo aparecer aqui (veja <code>docs/biblioteca-drive.md</code>).
          </div>
        </div>
      )}

      {abrir && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="tkfilter" style={{ margin: 0 }}>
            <button type="button" className={tipo === 'roteiro' ? 'on' : ''} onClick={() => setTipo('roteiro')}>Roteiro</button>
            <button type="button" className={tipo === 'criativo' ? 'on' : ''} onClick={() => setTipo('criativo')}>Criativo</button>
          </div>
          <input placeholder="Título (ex.: Roteiro VSL · Previdenciário)" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} />
          <select className="selin" value={criaId} onChange={(e) => setCriaId(e.target.value)}>
            <option value="">— sem Cria (genérico) —</option>
            {crias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          {tipo === 'roteiro' ? (
            <textarea placeholder="Cole ou escreva o roteiro aqui…" value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={6} style={{ resize: 'vertical' }} />
          ) : (
            <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          )}
          {erro && <div className="s" style={{ color: 'var(--risk)' }}>{erro}</div>}
          <div><button type="button" className="btn primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar no acervo'}</button></div>
        </div>
      )}

      {vis.length === 0 ? (
        <div className="card"><div className="s" style={{ color: 'var(--muted)' }}>Acervo vazio neste filtro — adicione o primeiro item ou conecte o Drive.</div></div>
      ) : (
        <div className="grid cols-3">
          {vis.map((it) => (
            <div className="card" key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {it.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.thumbUrl} alt={it.titulo} loading="lazy" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, background: 'var(--panel-2, rgba(255,255,255,.03))' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`ttag ${it.tipo === 'roteiro' ? 'forja' : 'rotina'}`}>{it.tipo === 'roteiro' ? 'Roteiro' : 'Criativo'}</span>
                  {it.fonte === 'drive' && <span className="badge dim" title="Do Google Drive">Drive</span>}
                </div>
                {it.fonte === 'app' && it.autorId && it.autorId === meuId && (
                  <button type="button" className="btn" title="Remover" onClick={() => excluir(it.id)} style={{ padding: '2px 8px', fontSize: 12 }}>×</button>
                )}
              </div>
              <div className="t" style={{ fontSize: 14, wordBreak: 'break-word' }}>{it.titulo}</div>
              {(it.criaNome || it.tema) && <div className="s" style={{ color: 'var(--muted)' }}>{it.criaNome ?? it.tema}</div>}
              {it.tipo === 'roteiro' && it.conteudo && (
                <>
                  <div className="s" style={{ color: 'var(--faint)', whiteSpace: 'pre-wrap', maxHeight: 96, overflow: 'hidden' }}>{it.conteudo}</div>
                  <button type="button" className="btn" style={{ alignSelf: 'flex-start', padding: '3px 10px', fontSize: 12 }} onClick={() => copiar(it.id, it.conteudo ?? '')}>
                    {copiado === it.id ? 'Copiado ✓' : 'Copiar roteiro'}
                  </button>
                </>
              )}
              {it.arquivoUrl && (
                <a className="btn" href={it.arquivoUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start', padding: '3px 10px', fontSize: 12 }}>
                  {it.fonte === 'drive' ? 'Abrir no Drive ↗' : `Abrir ${it.arquivoNome || 'arquivo'} ↗`}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
