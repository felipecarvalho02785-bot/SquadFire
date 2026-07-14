import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LenhaCheck } from '@/components/LenhaCheck';
import { AvancarFaseBtn } from '@/components/AvancarFaseBtn';
import { ComentarioForm } from '@/components/ComentarioForm';
import { AudioRecorder } from '@/components/AudioRecorder';
import { CriaTabs, type TabDef } from '@/components/CriaTabs';
import { EditInvestimento } from '@/components/EditInvestimento';
import { EditInicioForja } from '@/components/EditInicioForja';
import { GargalosPanel } from '@/components/GargalosPanel';
import { UploadPdf } from '@/components/UploadPdf';
import { ImportarDiagnostico } from '@/components/ImportarDiagnostico';
import { AvisarWhatsapp } from '@/components/AvisarWhatsapp';
import { EditCampoCria } from '@/components/EditCampoCria';
import { EditGestorContas } from '@/components/EditGestorContas';
import { getCriaDetalhe, getComentarios } from '@/lib/data/crias';
import { getBrigada } from '@/lib/data/brigada';
import { iniciais } from '@/lib/format';

export const dynamic = 'force-dynamic';

const DUR = ['Dia 1–7', 'Dia 8–14', 'Dia 15–21', 'Dia 22–28', 'Dia 29–35', 'Dia 36–42', 'Dia 43–49'];

function fmtData(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d + (d.length <= 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('pt-BR');
}

export default async function CriaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const det = await getCriaDetalhe(id);
  if (!det) notFound();
  const [comentarios, brigada] = await Promise.all([getComentarios(id), getBrigada()]);
  const membros = brigada.map((m) => ({ id: m.id, nome: m.nome }));

  const { cria, forja, fases, lenhas, gestor, gargalos, briefingsSemana, diagnostico, contrato, briefings } = det;
  const faseAtual = fases.find((f) => f.id === forja?.fase_atual_id) ?? fases.find((f) => f.status === 'em_andamento');
  const ordemAtual = faseAtual?.ordem ?? 0;
  const concluidas = fases.filter((f) => f.status === 'concluida').length;

  // Dia da Forja (1..49) a partir do início
  const diaForja = forja?.data_inicio
    ? Math.min(49, Math.max(1, Math.floor((Date.now() - new Date(forja.data_inicio).getTime()) / 86400000) + 1))
    : null;

  // Lenhas da fase corrente (checklist da Visão geral)
  const lenhasFase = faseAtual ? lenhas.filter((l) => l.fase_da_forja_id === faseAtual.id) : [];
  const lenhasPend = lenhas.filter((l) => l.status !== 'concluida').length;

  const statusPill =
    cria.status !== 'ativa'
      ? { cls: 'warn', txt: cria.status === 'pausada' ? 'Pausada' : 'Encerrada' }
      : cria.em_risco
        ? { cls: 'crit', txt: 'Apagando' }
        : { cls: 'good', txt: 'Em Chamas' };

  // ── painéis das abas ────────────────────────────────────────
  const panelGeral = (
    <>
    <div className="grid g-2">
      <div>
        <div className="c-h" style={{ marginBottom: 6 }}><span className="t">Dados</span></div>
        <div className="dl">
          <div className="drow"><span>E-mail</span><EditCampoCria criaId={cria.id} campo="email" valor={cria.email} tipo="email" placeholder="email@cliente.com" /></div>
          <div className="drow"><span>Área</span><EditCampoCria criaId={cria.id} campo="area_atuacao" valor={cria.area_atuacao} placeholder="ex.: Direito Previdenciário" /></div>
          <div className="drow"><span>Produto</span><b>Estruturação</b></div>
          <div className="drow"><span>Investimento em mídia</span><EditInvestimento criaId={cria.id} valor={cria.investimento_midia} /></div>
          <div className="drow"><span>Closer</span><EditCampoCria criaId={cria.id} campo="closer" valor={cria.closer} placeholder="quem fechou" /></div>
          <div className="drow"><span>Gestor de Contas</span><EditGestorContas criaId={cria.id} atual={cria.gestor_contas_id} membros={membros} /></div>
          {cria.clickup_semana != null && <div className="drow"><span>Semana (Squad)</span><b className="mono">S{cria.clickup_semana}</b></div>}
          <div className="drow">
            <span>Grupo (WhatsApp)</span>
            {cria.telefone_whatsapp ? (
              <b><a href={`https://wa.me/${cria.telefone_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--ember)' }}>abrir grupo</a></b>
            ) : (
              <b>—</b>
            )}
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--faint)', margin: '9px 2px 0', lineHeight: 1.45 }}>
          <b style={{ color: 'var(--muted)' }}>Investimento em mídia</b> = verba de campanha do cliente (editável). É diferente do <b style={{ color: 'var(--muted)' }}>valor do contrato</b> — esse fica na aba Contrato.
        </p>
        {cria.telefone_whatsapp && <div style={{ marginTop: 12 }}><AvisarWhatsapp criaId={cria.id} /></div>}
      </div>
      <div>
        <div className="c-h" style={{ marginBottom: 6 }}>
          <span className="t">Rotina / próximas Lenhas</span>
          {forja && !forja.concluida && faseAtual && <AvancarFaseBtn forjaId={forja.id} />}
        </div>
        {lenhasFase.length === 0 ? (
          <div className="s" style={{ color: 'var(--muted)' }}>Sem Lenhas na fase corrente.</div>
        ) : (
          <div className="list">
            {lenhasFase.map((l) => (
              <LenhaCheck key={l.id} id={l.id} titulo={l.titulo} done={l.status === 'concluida'} sub={faseAtual?.fase?.nome} />
            ))}
          </div>
        )}
      </div>
    </div>
    <div className="c-h" style={{ margin: '18px 0 8px' }}><span className="t">Diagnóstico 360</span><span className="s">PDF com todas as informações do cliente</span></div>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <UploadPdf criaId={cria.id} kind="diagnostico" atual={diagnostico} />
      {cria.clickup_task_id && <ImportarDiagnostico criaId={cria.id} />}
    </div>
    {diagnostico.resumo && (
      <div className="ia-resumo">
        <div className="s" style={{ marginBottom: 4 }}><b style={{ color: 'var(--ember-hi)' }}>Resumo da Faísca</b> · lido do Diagnóstico 360</div>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>{diagnostico.resumo}</p>
      </div>
    )}
    </>
  );

  const panelContrato = (
    <>
      <div className="dl" style={{ maxWidth: 540 }}>
        <div className="drow"><span>Plano</span><b>Estruturação · 7 fases × 7 dias</b></div>
        <div className="drow"><span>Início da Forja</span><EditInicioForja criaId={cria.id} data={forja?.data_inicio ?? null} /></div>
        <div className="drow"><span>Flag do contrato</span><b>{forja?.flag_contrato === 'brasa_viva' ? 'Brasa Viva' : 'Forja Quente'}</b></div>
        <div className="drow"><span>Valor do contrato</span><b>{contrato?.valor != null ? contrato.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</b></div>
        {contrato?.dataInicio && <div className="drow"><span>Início sugerido (IA)</span><b className="mono">{new Date(contrato.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}</b></div>}
        <div className="drow"><span>Status</span><b>{forja?.data_inicio ? 'Assinado' : 'Pré-Forja'}</b></div>
      </div>
      <div className="c-h" style={{ margin: '16px 0 8px' }}><span className="t">Contrato (PDF)</span><span className="s">arquivo assinado do cliente</span></div>
      <UploadPdf criaId={cria.id} kind="contrato" atual={{ url: contrato?.url ?? null, nome: contrato?.nome ?? null }} />
      <p style={{ fontSize: 11, color: 'var(--faint)', margin: '10px 2px 0', lineHeight: 1.45, maxWidth: 540 }}>
        <b style={{ color: 'var(--muted)' }}>Valor do contrato</b> = a mensalidade que o cliente paga pela Estruturação. Não confundir com o <b style={{ color: 'var(--muted)' }}>investimento em mídia</b> da Visão geral.
      </p>
    </>
  );

  const panelComent = (
    <>
      <ComentarioForm criaId={cria.id} />
      <div style={{ marginTop: 14 }}>
        {comentarios.length === 0 ? (
          <div className="s" style={{ color: 'var(--muted)' }}>Nenhum comentário ainda. Seja o primeiro.</div>
        ) : (
          comentarios.map((c) => (
            <div className="cmt" key={c.id}>
              <span className="av avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{iniciais(c.autor_nome)}</span>
              <div>
                <div className="cn">{c.autor_nome}{c.origem === 'clickup' && <span className="badge" style={{ marginLeft: 6, color: 'var(--plasma)', background: 'var(--plasma-soft)' }}>ClickUp</span>}<small>{new Date(c.created_at).toLocaleString('pt-BR')}</small></div>
                <div className="ct" style={{ whiteSpace: 'pre-wrap' }}>{c.corpo}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  const panelGarg = <GargalosPanel criaId={cria.id} gargalos={gargalos} />;

  const panelBrief = (
    <div>
      <p className="s" style={{ marginBottom: 10, color: 'var(--muted)' }}>
        Grave o áudio da Roda de Fogo — a Faísca (Gemini) transcreve e estrutura os 6 campos do briefing. Depois publica como comentário na task do ClickUp.
        {briefingsSemana > 0 && <> · <b style={{ color: 'var(--ember-hi)' }}>{briefingsSemana} briefing(s) nesta semana.</b></>}
      </p>
      <AudioRecorder criaId={cria.id} />

      <div className="c-h" style={{ margin: '18px 0 8px' }}><span className="t">Briefings salvos</span><span className="s">{briefings.length} no histórico</span></div>
      {briefings.length === 0 ? (
        <div className="s" style={{ color: 'var(--muted)' }}>Nenhum briefing ainda. Grave a primeira Roda de Fogo — ele fica salvo aqui e vai pro ClickUp.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {briefings.map((b) => (
            <details className="card briefcard" key={b.id}>
              <summary>
                <span className="bc-data">{new Date(b.data).toLocaleDateString('pt-BR')}</span>
                <span className="bc-sem">{b.semana ? `semana de ${new Date(b.semana + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'briefing'}</span>
                <span className={`badge ${b.enviadoClickup ? 'ok' : 'dim'}`}>{b.enviadoClickup ? 'no ClickUp ✓' : 'só no CRM'}</span>
              </summary>
              <div className="report" style={{ marginTop: 10 }}>
                {b.campos.length === 0 ? (
                  <div className="s" style={{ color: 'var(--muted)' }}>Sem conteúdo estruturado.</div>
                ) : b.campos.map((c) => (
                  <div className="rsec" key={c.label}><div className="rl">{c.label}</div><div className="rt">{c.texto}</div></div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );

  const tabs: TabDef[] = [
    { key: 'geral', label: 'Visão geral', content: panelGeral },
    { key: 'contrato', label: 'Contrato', content: panelContrato },
    { key: 'coment', label: 'Comentários', content: panelComent },
    { key: 'garg', label: `Gargalos${gargalos.length ? ` (${gargalos.length})` : ''}`, content: panelGarg },
    { key: 'brief', label: 'Briefing por áudio', content: panelBrief },
  ];

  return (
    <div className="main">
      <div className="content grid detalhe-wrap">
        <Link className="back" href="/crias">‹ Voltar pra Crias</Link>

        {/* hero */}
        <div className="dtop">
          <span className="dav">{iniciais(cria.nome_cliente)}</span>
          <div className="dinfo">
            <h2>{cria.nome_cliente}</h2>
            <p>{cria.area_atuacao ?? 'Estruturação'} · Squad 08{forja?.data_inicio ? ` · Início ${fmtData(forja.data_inicio)}` : ''}</p>
          </div>
          <div className="dbadges">
            <span className={`pill ${statusPill.cls}`}><span className="d" />{statusPill.txt}</span>
            {forja?.flag_contrato && <span className={`chip ${cria.em_risco ? 'crit' : ''}`}>{forja.flag_contrato === 'brasa_viva' ? 'Brasa Viva' : 'Forja Quente'}</span>}
          </div>
          <Link className="fog-open" href={`/crias/${cria.id}/roda`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3c1.8 3-1 4-.7 6.3.3 1.8 2.2 2 2-.2 1.7 1.3 2.5 3.4 2.2 5.4C16.9 19 14.7 22 12 22c-3.1 0-5.4-2.4-5.4-5.6 0-2.5 1.5-4 2.4-5.2.5 1.7 2.2 1.4 2.1-.4C11 8.5 9.6 6 12 3z" /></svg>
            Abrir Roda de Fogo
          </Link>
        </div>

        {/* KPIs */}
        <div className="kpis">
          <div className="kpi"><div className="k-top"><span className="k-label">Fase atual</span></div><div className="k-val" style={{ fontSize: 24 }}>{faseAtual ? `Fase ${faseAtual.ordem}` : 'Backlog'}</div><span className="k-delta neu">{faseAtual?.fase?.nome ?? 'sem fase'}</span></div>
          <div className="kpi"><div className="k-top"><span className="k-label">Dia da Forja</span></div><div className="k-val">{diaForja ?? '—'}<span style={{ fontSize: 16, color: 'var(--muted)' }}>/49</span></div><span className="k-delta neu">Estruturação</span></div>
          <div className="kpi"><div className="k-top"><span className="k-label">Lenhas pendentes</span></div><div className="k-val">{lenhasPend}</div><span className="k-delta neu">na Forja</span></div>
          <div className={`kpi${briefingsSemana === 0 ? ' flag-warn' : ''}`}><div className="k-top"><span className="k-label">Briefing</span>{briefingsSemana === 0 && <span className="chip warn">esta semana</span>}</div><div className="k-val">{briefingsSemana}</div><span className="k-delta neu">{briefingsSemana === 0 ? 'pendente' : 'em dia'}</span></div>
        </div>

        {/* Termômetro da Forja */}
        <div className="card">
          <div className="c-h"><span className="t">Termômetro da Forja</span><span className="now">{faseAtual ? `fase ${faseAtual.ordem} de 7` : `${concluidas}/7 concluídas`}</span></div>
          <div className="funnel">
            {Array.from({ length: 7 }).map((_, i) => {
              const ordem = i + 1;
              const f = fases.find((x) => x.ordem === ordem);
              const cls = f?.status === 'concluida' ? 'done' : ordem === ordemAtual ? 'now' : '';
              return (
                <div key={ordem} className={`ph ${cls}`}>
                  {cls === 'now' && <span className="nowtag">AGORA</span>}
                  <div className="bar" />
                  <div className="n">FASE {ordem}</div>
                  <div className="nm">{f?.fase?.nome ?? '—'}</div>
                  <div className="dd">{DUR[i]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* abas */}
        <CriaTabs tabs={tabs} />
      </div>
    </div>
  );
}
