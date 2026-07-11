import { Topbar } from '@/components/Topbar';
import { LenhaCheck } from '@/components/LenhaCheck';
import { getCurrentMembro } from '@/lib/auth';
import { getMeuDia } from '@/lib/data/meudia';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

const RECOR: Record<string, string> = {
  diaria: 'todo dia',
  semanal: 'toda semana',
  dias_da_semana: 'dias fixos',
  mensal: 'todo mês',
  sprint: 'por sprint',
};

export default async function MeuDiaPage() {
  const membro = isSupabaseConfigured ? await getCurrentMembro() : null;
  const dia = membro ? await getMeuDia(membro.id, membro.papel_primario) : { lenhas: [], rotinas: [] };
  const primeiroNome = membro?.nome?.split(' ')[0] ?? 'squad';

  return (
    <div className="main">
      <Topbar
        title={`Salve, ${primeiroNome} 🔥`}
        sub="Seu cockpit do dia — o que pega fogo agora."
      />
      <div className="content grid" style={{ gap: 18 }}>
        <div className="grid cols-4">
          <div className="card kpi">
            <div className="n ember">{dia.lenhas.length}</div>
            <div className="l">Lenhas em aberto</div>
          </div>
          <div className="card kpi">
            <div className="n">{dia.rotinas.length}</div>
            <div className="l">Rituais do seu papel</div>
          </div>
          <div className="card kpi">
            <div className="n">
              {dia.lenhas.filter((l) => l.prioridade === 'alta').length}
            </div>
            <div className="l">Prioridade alta</div>
          </div>
          <div className="card kpi">
            <div className="n">0</div>
            <div className="l">Reuniões hoje (Google Agenda)</div>
          </div>
        </div>

        <div className="grid cols-2">
          <div className="card">
            <div className="eyebrow">🪵 Minhas Lenhas de hoje</div>
            {dia.lenhas.length === 0 ? (
              <div className="s">Nada pendente atribuído a você. 🎯</div>
            ) : (
              dia.lenhas.map((l) => (
                <LenhaCheck
                  key={l.id}
                  id={l.id}
                  titulo={l.titulo}
                  done={false}
                  sub={[l.tipo === 'forja' ? 'Forja' : 'Rotina', l.prazo ? `prazo ${l.prazo}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))
            )}
          </div>

          <div className="card">
            <div className="eyebrow">🔁 Rituais da semana</div>
            {dia.rotinas.length === 0 ? (
              <div className="s">Sem rituais ativos para o seu papel.</div>
            ) : (
              dia.rotinas.map((r) => (
                <div className="row" key={r.id}>
                  <div className="grow">
                    <div className="t">{r.titulo}</div>
                    <div className="s">{RECOR[r.recorrencia_tipo] ?? r.recorrencia_tipo}</div>
                  </div>
                  <span className="badge">repete</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">📅 Agenda de hoje · Google Agenda</div>
          <div className="s">
            Conecte o Google Calendar (P1) para ver aqui as reuniões do dia. As Rodas de Fogo
            agendadas também vão aparecer.
          </div>
        </div>
      </div>
    </div>
  );
}
