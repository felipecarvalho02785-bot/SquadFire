import { Topbar } from '@/components/Topbar';

export const dynamic = 'force-dynamic';

export default function CalendarioPage() {
  return (
    <div className="main">
      <Topbar
        title="Calendário 📅"
        sub="Prazos das fases + reuniões — sincronizado com o Google Agenda."
        action={<span className="badge ok">Google Agenda · a conectar</span>}
      />
      <div className="content grid" style={{ gap: 18 }}>
        <div className="card">
          <div className="eyebrow">Integração Google Calendar (P1)</div>
          <p className="s">
            Aqui vão aparecer as reuniões do dia dos membros (lidas do Google Calendar via OAuth) e
            os prazos previstos de cada fase da Forja. Ao agendar uma <b>Roda de Fogo</b>, o evento é
            criado direto na agenda do Google. Ver <code>docs/roteiro-producao.md § Integrações</code>.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">Legenda</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="badge ember">🔥 Prazo de fase</span>
            <span className="badge">🤝 Reunião de cliente</span>
            <span className="badge ok">📞 Roda de Fogo</span>
            <span className="badge dim">🔁 Ritual da squad</span>
          </div>
        </div>
      </div>
    </div>
  );
}
