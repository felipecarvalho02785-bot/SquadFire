import { getAgendaHoje } from '@/lib/data/meudia';

const tagKind: Record<string, string> = { cliente: 'ember', roda: 'ok', interna: 'dim' };

// Server component assíncrono — renderizado dentro de <Suspense> no Meu Dia.
// Busca a agenda do Google (chamada externa) e STREAMA: a página aparece na
// hora e a agenda preenche quando o Google responde (não trava o resto).
export async function AgendaHojeStream({ membroId }: { membroId: string | null }) {
  const agenda = membroId ? await getAgendaHoje(membroId) : [];

  if (agenda.length === 0) {
    return <div className="s" style={{ color: 'var(--muted)' }}>Sem reuniões no Google Agenda hoje. Conecte em Configurações se ainda não conectou — as Rodas de Fogo agendadas aparecem aqui.</div>;
  }

  return (
    <div className="list agn">
      {agenda.map((a, i) => (
        <div className="lrow" key={i}>
          <span className="time">{a.hora}</span>
          <div className="rmain"><div className="t">{a.titulo}</div></div>
          <span className={`badge ${tagKind[a.kind] ?? 'dim'}`}>{a.tag}</span>
        </div>
      ))}
    </div>
  );
}
