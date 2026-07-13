import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { listCrias } from '@/lib/data/crias';
import { isSupabaseConfigured } from '@/lib/env';
import { brl, faseLabel, saudeDaCria } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface CriaRow {
  id: string;
  nome_cliente: string;
  area_atuacao: string | null;
  clickup_semana: number | null;
  status: 'ativa' | 'pausada' | 'encerrada';
  em_risco: boolean;
  investimento_midia: number | null;
}

const DEMO: CriaRow[] = [
  { id: 'd1', nome_cliente: 'M. Oliveira Sociedade de Advogados', area_atuacao: 'Previdenciário', clickup_semana: 1, status: 'ativa', em_risco: false, investimento_midia: 3000 },
  { id: 'd2', nome_cliente: 'Edi Carlos Advocacia', area_atuacao: 'Trabalhista', clickup_semana: 2, status: 'ativa', em_risco: false, investimento_midia: 2500 },
  { id: 'd3', nome_cliente: 'Renato Leo e Advogados Associados', area_atuacao: 'Cível', clickup_semana: 2, status: 'ativa', em_risco: false, investimento_midia: 4000 },
  { id: 'd4', nome_cliente: 'Letícia Stein Carlos de Souza', area_atuacao: 'Família', clickup_semana: 3, status: 'ativa', em_risco: true, investimento_midia: 3500 },
  { id: 'd5', nome_cliente: 'Mozini Advocacia', area_atuacao: 'Empresarial', clickup_semana: 3, status: 'ativa', em_risco: false, investimento_midia: 5000 },
  { id: 'd6', nome_cliente: 'Giuliane Giorgi Torres', area_atuacao: 'Previdenciário', clickup_semana: 4, status: 'ativa', em_risco: false, investimento_midia: 2800 },
  { id: 'd7', nome_cliente: 'Mendes Advocacia Previdenciária', area_atuacao: 'Previdenciário', clickup_semana: 5, status: 'ativa', em_risco: true, investimento_midia: 6000 },
  { id: 'd8', nome_cliente: 'Cardoso & Martins Advocacia', area_atuacao: 'A definir', clickup_semana: null, status: 'ativa', em_risco: false, investimento_midia: null },
];

export default async function CriasPage() {
  const crias: CriaRow[] = isSupabaseConfigured ? await listCrias() : DEMO;
  const emForja = crias.filter((c) => c.clickup_semana != null).length;
  const backlog = crias.length - emForja;

  return (
    <div className="main">
      <Topbar title="Crias" sub="espelho do ClickUp · Squad 08" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Carteira · {crias.length} Crias</div>
            <h2>Crias</h2>
            <p>Squad 08 · espelho do ClickUp (Estruturação): {emForja} em execução + {backlog} no backlog. Clique numa Cria pra abrir a Forja.</p>
          </div>
        </div>

        {crias.length === 0 ? (
          <div className="empty">
            <div className="big">⚒️</div>
            <b>Nenhuma Cria ainda</b>
            <p>As Crias entram pelo sync do ClickUp (lista-mestre, Squad 08) ou pelo cadastro do Gestor de Contas. Rode a sincronização para materializar os clientes.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 6, overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cria</th>
                  <th>Fase</th>
                  <th>Saúde</th>
                  <th>Investimento</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {crias.map((c) => {
                  const s = saudeDaCria(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="crname">{c.nome_cliente}</div>
                        <div className="s">{c.area_atuacao ?? 'Área a definir'}</div>
                      </td>
                      <td className="mono" style={{ color: c.clickup_semana ? undefined : 'var(--faint)' }}>
                        {c.clickup_semana ? faseLabel(c.clickup_semana) : '—'}
                      </td>
                      <td>
                        <span className={`pill ${s.kind}`}>
                          <span className="d" style={{ background: s.kind === 'crit' ? 'var(--risk)' : s.kind === 'warn' ? 'var(--warn)' : s.kind === 'good' ? 'var(--ember-hi)' : 'var(--faint)' }} />
                          {s.label}
                        </span>
                      </td>
                      <td className="mono">{brl(c.investimento_midia)}</td>
                      <td>
                        {c.clickup_semana == null ? (
                          <span className="chip dim">Backlog</span>
                        ) : (
                          <span className="s" style={{ color: 'var(--faint)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link className="btn" href={`/crias/${c.id}`}>abrir →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
