import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { LenhaCheck } from '@/components/LenhaCheck';
import { AvancarFaseBtn } from '@/components/AvancarFaseBtn';
import { ComentarioForm } from '@/components/ComentarioForm';
import { AudioRecorder } from '@/components/AudioRecorder';
import { getCriaDetalhe, getComentarios } from '@/lib/data/crias';
import { brl, statusLabel, iniciais } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CriaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const det = await getCriaDetalhe(id);
  if (!det) notFound();
  const comentarios = await getComentarios(id);

  const { cria, forja, fases, lenhas, gestor } = det;
  const faseAtual = fases.find((f) => f.id === forja?.fase_atual_id);
  const concluidas = fases.filter((f) => f.status === 'concluida').length;

  return (
    <div className="main">
      <Topbar
        title={cria.nome_cliente}
        sub={cria.area_atuacao ?? 'Estruturação · Squad 08'}
        action={
          <Link className="btn" href="/crias">
            ← Crias
          </Link>
        }
      />
      <div className="content grid" style={{ gap: 18 }}>
        {/* header badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge ember">
            <span className={`dot ${cria.status}`} /> {statusLabel(cria.status)}
          </span>
          {forja?.flag_contrato && (
            <span className="badge">{forja.flag_contrato === 'forja_quente' ? 'Forja Quente' : 'Brasa Viva'}</span>
          )}
          {cria.em_risco && <span className="badge risk">em risco</span>}
          {gestor && <span className="badge dim">Contas: {gestor.nome}</span>}
          {cria.clickup_task_id && <span className="badge dim">ClickUp: {cria.clickup_task_id}</span>}
        </div>

        {/* progress da Forja */}
        <div className="card">
          <div className="eyebrow">A Forja · {concluidas}/7 fases concluídas</div>
          <div className="steps" style={{ marginBottom: 14 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const f = fases.find((x) => x.ordem === i + 1);
              const cls = f?.status === 'concluida' ? 'done' : f?.id === faseAtual?.id ? 'cur' : '';
              return <div key={i} className={`st ${cls}`} />;
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div className="grow">
              <div className="t">
                {faseAtual ? `Fase ${faseAtual.ordem} · ${faseAtual.fase?.nome}` : 'Backlog — sem fase corrente'}
              </div>
              <div className="s">
                {forja?.data_inicio
                  ? `Início: ${forja.data_inicio}`
                  : 'Sem contrato confirmado — prazos ainda não calculados.'}
              </div>
            </div>
            {forja && !forja.concluida && faseAtual && (
              <AvancarFaseBtn forjaId={forja.id} />
            )}
            {forja?.concluida && <span className="badge ok">Forja concluída</span>}
          </div>
        </div>

        <div className="grid cols-3">
          <div className="card kpi">
            <div className="n ember">{brl(cria.investimento_midia)}</div>
            <div className="l">Investimento em mídia (verba de campanha)</div>
          </div>
          <div className="card kpi">
            <div className="n">{concluidas}/7</div>
            <div className="l">Fases concluídas</div>
          </div>
          <div className="card kpi">
            <div className="n">{lenhas.filter((l) => l.status !== 'concluida').length}</div>
            <div className="l">Lenhas de Forja pendentes</div>
          </div>
        </div>

        {/* checklist da fase atual */}
        <div className="card">
          <div className="eyebrow">Lenhas de Forja</div>
          {lenhas.length === 0 ? (
            <div className="s">Nenhuma Lenha de Forja gerada.</div>
          ) : (
            fases.map((f) => {
              const ls = lenhas.filter((l) => l.fase_da_forja_id === f.id);
              if (!ls.length) return null;
              return (
                <div key={f.id} style={{ marginBottom: 14 }}>
                  <div className="s" style={{ marginBottom: 4 }}>
                    Fase {f.ordem} · {f.fase?.nome}
                  </div>
                  {ls.map((l) => (
                    <LenhaCheck
                      key={l.id}
                      id={l.id}
                      titulo={l.titulo}
                      done={l.status === 'concluida'}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* dados */}
        <div className="card">
          <div className="eyebrow">Dados da Cria</div>
          <div className="row">
            <div className="grow">
              <div className="s">Contato</div>
              <div className="t">{cria.email ?? '—'} · {cria.telefone_whatsapp ?? 'sem WhatsApp'}</div>
            </div>
            <div className="avatar">{iniciais(cria.nome_cliente)}</div>
          </div>
          <div className="row">
            <div className="grow">
              <div className="s">Closer</div>
              <div className="t">{cria.closer ?? '—'}</div>
            </div>
          </div>
          <div className="row">
            <div className="grow">
              <div className="s">Sincronizado do ClickUp</div>
              <div className="t">{cria.sincronizado_em ?? 'nunca'}</div>
            </div>
          </div>
        </div>

        {/* briefing por áudio → Faísca estrutura os 6 campos */}
        <div className="card">
          <div className="eyebrow">Briefing por áudio · Faísca</div>
          <p className="s" style={{ marginBottom: 10 }}>
            Grave o áudio da Roda de Fogo — a Faísca transcreve (Gemini) e estrutura os 6 campos
            (Claude). Requer as chaves de IA configuradas.
          </p>
          <AudioRecorder criaId={cria.id} />
        </div>

        {/* comentários (registro contínuo) */}
        <div className="card">
          <div className="eyebrow">Comentários</div>
          <ComentarioForm criaId={cria.id} />
          <div style={{ marginTop: 14 }}>
            {comentarios.length === 0 ? (
              <div className="s">Nenhum comentário ainda.</div>
            ) : (
              comentarios.map((c) => (
                <div className="row" key={c.id}>
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                    {iniciais(c.autor_nome)}
                  </div>
                  <div className="grow">
                    <div className="t" style={{ fontWeight: 500 }}>{c.corpo}</div>
                    <div className="s">
                      {c.autor_nome} · {new Date(c.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
