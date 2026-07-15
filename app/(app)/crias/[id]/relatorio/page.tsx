import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRelatorio } from '@/lib/data/relatorio';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rel = await getRelatorio(id);
  if (!rel) notFound();

  const dataFmt = rel.briefing
    ? new Date(rel.briefing.semana + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="main">
      <style>{`
        @media print {
          .sidebar, .topbar, .rail-toggle, .faisca-card, .rel-noprint { display: none !important; }
          .main, .content { margin: 0 !important; padding: 0 !important; }
          body { background: #fff !important; }
          .rel-sheet { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
        }
        .rel-sheet { background:#fff; color:#1a1a1a; max-width: 820px; margin: 0 auto; padding: 48px 56px; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,.28); }
        .rel-brand { display:flex; align-items:center; gap:10px; color:#c2410c; font-weight:800; letter-spacing:.09em; text-transform:uppercase; font-size:12px; }
        .rel-sheet h1 { font-size: 26px; margin: 6px 0 2px; color:#111; letter-spacing:-.01em; }
        .rel-meta { color:#666; font-size:13px; }
        .rel-rule { height:3px; background: linear-gradient(90deg,#f97316,#dc2626); border:0; margin:16px 0 0; border-radius:2px; }
        .rel-sec { margin-top: 22px; }
        .rel-sec h2 { font-size: 12.5px; text-transform: uppercase; letter-spacing:.06em; color:#c2410c; margin:0 0 6px; }
        .rel-sec p { margin:0; font-size:14.5px; line-height:1.62; white-space:pre-wrap; color:#222; }
        .rel-foot { margin-top:32px; padding-top:14px; border-top:1px solid #eee; color:#999; font-size:11px; }
      `}</style>

      <div className="content" style={{ padding: '24px 0' }}>
        <div className="rel-noprint" style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: 820, margin: '0 auto 16px', padding: '0 12px' }}>
          <Link className="btn" href={`/crias/${id}`}>← Voltar à Cria</Link>
          <PrintButton />
          <span className="s" style={{ color: 'var(--muted)', marginLeft: 'auto' }}>Dica: em &quot;Imprimir&quot; escolha &quot;Salvar como PDF&quot;.</span>
        </div>

        <div className="rel-sheet">
          <div className="rel-brand"><span>SquadFire · E3 Digital</span></div>
          <h1>Relatório Semanal</h1>
          <div className="rel-meta">{rel.criaNome}{rel.area ? ` · ${rel.area}` : ''}{dataFmt ? ` · semana de ${dataFmt}` : ''}</div>
          <hr className="rel-rule" />

          {rel.briefing && rel.briefing.campos.length ? (
            rel.briefing.campos.map((c) => (
              <div className="rel-sec" key={c.chave}>
                <h2>{c.label}</h2>
                <p>{c.texto}</p>
              </div>
            ))
          ) : (
            <div className="rel-sec">
              <p style={{ color: '#888' }}>Ainda não há briefing registrado para esta Cria. Faça uma Roda de Fogo para gerar o relatório da semana.</p>
            </div>
          )}

          <div className="rel-foot">Gerado pelo SquadFire · {rel.criaNome}</div>
        </div>
      </div>
    </div>
  );
}
