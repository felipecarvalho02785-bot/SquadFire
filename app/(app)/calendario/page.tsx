import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { CalendarioMes } from '@/components/CalendarioMes';
import { getForjasTimeline, getRituaisDoMes, type SlaStatus } from '@/lib/data/agenda';
import { getCurrentMembro } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { listarEventos, statusGoogle } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';

const SLA_LABEL: Record<SlaStatus, string> = { atrasada: 'Atrasada', no_prazo: 'No prazo', sem_inicio: 'Sem início', concluida: 'Concluída' };
const SLA_KIND: Record<SlaStatus, string> = { atrasada: 'crit', no_prazo: 'good', sem_inicio: 'dim', concluida: 'dim' };

function nomeCurto(n: string) { return n.length > 22 ? n.slice(0, 20) + '…' : n; }

export default async function CalendarioPage() {
  const now = new Date();
  const [timeline, rituais] = await Promise.all([getForjasTimeline(), getRituaisDoMes(now.getFullYear(), now.getMonth())]);
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const atrasadas = timeline.filter((t) => t.sla === 'atrasada').length;
  const ativas = timeline.filter((t) => t.sla !== 'concluida').length;

  // Eventos do mês = prazos das fases (data prevista de fim) + agenda do Google.
  const eventos: Record<number, { label: string; kind: string; hora?: string }[]> = {};
  for (const t of timeline) {
    if (!t.prazoFaseAtual) continue;
    const d = new Date(t.prazoFaseAtual + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      (eventos[d.getDate()] ??= []).push({ label: `Fase ${t.faseAtualOrdem} · ${nomeCurto(t.nome)}`, kind: t.sla === 'atrasada' ? 'fase-crit' : 'fase' });
    }
  }

  // Rituais recorrentes pontuados no dia (cada um no seu dia da semana).
  for (const [dia, titulos] of Object.entries(rituais.porDia)) {
    for (const tt of titulos) (eventos[Number(dia)] ??= []).push({ label: nomeCurto(tt), kind: 'ritual' });
  }

  // Overlay do Google Agenda (se o membro conectou).
  let googleConectado = false;
  if (isSupabaseConfigured) {
    const membro = await getCurrentMembro();
    if (membro) {
      const st = await statusGoogle(membro.id);
      googleConectado = st.conectado;
      if (st.conectado) {
        const ini = new Date(year, month, 1).toISOString();
        const fim = new Date(year, month + 1, 0, 23, 59).toISOString();
        for (const ev of await listarEventos(membro.id, ini, fim)) {
          if (!ev.inicio) continue;
          const d = new Date(ev.inicio);
          if (d.getFullYear() === year && d.getMonth() === month) {
            const hora = ev.allDay ? undefined : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            (eventos[d.getDate()] ??= []).push({ label: nomeCurto(ev.titulo), kind: 'gcal', hora });
          }
        }
      }
    }
  }

  return (
    <div className="main">
      <Topbar title="Calendário" sub="fases da Forja + SLA" action={<span className={`badge ${googleConectado ? 'ok' : 'dim'}`}>Google Agenda · {googleConectado ? 'conectado' : 'a conectar'}</span>} />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Operação · Agenda</div>
            <h2>Calendário</h2>
            <p>Em que fase e dia cada Cria está — calculado da data de início da Forja. {ativas} Forjas ativas{atrasadas > 0 ? `, ${atrasadas} com Estopim estourado` : ''}.</p>
          </div>
        </div>

        {/* Linha do tempo das Forjas (SLA por Cria) */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="c-h"><span className="t">Linha do tempo das Forjas</span><span className="s">SLA · fase esperada × fase real</span></div>
          {timeline.length === 0 ? (
            <div className="s" style={{ color: 'var(--muted)' }}>Nenhuma Forja ativa. Defina a data de início na Cria pra ligar o SLA.</div>
          ) : (
            <div className="fll">
              {timeline.map((t) => (
                <Link className="fl-row" href={`/crias/${t.criaId}`} key={t.criaId}>
                  <div className="fl-main">
                    <div className="fl-name">{t.nome}</div>
                    <div className="fl-sub">
                      {t.dataInicio ? `Dia ${t.diaAtual}/49 · Fase ${t.faseAtualOrdem} de 7 — ${t.faseAtualNome}` : 'Sem data de início — defina na Cria'}
                    </div>
                  </div>
                  <div className="fl-bar" aria-hidden>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const ord = i + 1;
                      const cls = ord < t.faseAtualOrdem ? 'done' : ord === t.faseAtualOrdem ? 'cur' : t.faseEsperadaOrdem && ord <= t.faseEsperadaOrdem ? 'late' : '';
                      return <span className={`fl-seg ${cls}`} key={ord} />;
                    })}
                  </div>
                  <span className={`pill ${SLA_KIND[t.sla]}`}><span className="d" />{SLA_LABEL[t.sla]}</span>
                </Link>
              ))}
            </div>
          )}
          <p className="fl-legenda"><span className="fl-seg done inline" /> concluída · <span className="fl-seg cur inline" /> atual · <span className="fl-seg late inline" /> atraso (já deveria estar aqui) · <span className="fl-seg inline" /> a fazer.</p>
        </div>

        {/* Mês — prazos das fases */}
        <div className="card">
          <div className="cal-nav"><span className="mo">{mesLabel}</span><span className="s" style={{ color: 'var(--faint)' }}>clique num dia pra ver os compromissos</span></div>
          <CalendarioMes year={year} month={month} today={today} eventos={eventos} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <span className="badge ember">Prazo de fase (no prazo)</span>
            <span className="badge risk">Prazo de fase (atrasada)</span>
            <span className="badge" style={{ color: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 15%, transparent)' }}>Ritual recorrente</span>
            {googleConectado && <span className="badge" style={{ color: 'var(--plasma)', background: 'var(--plasma-soft)' }}>Google Agenda</span>}
          </div>
          {rituais.diarios.length > 0 && (
            <p className="fl-legenda" style={{ marginTop: 10 }}>
              <b style={{ color: 'var(--muted)' }}>Rituais diários</b> (todo dia útil): {rituais.diarios.join(' · ')}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
