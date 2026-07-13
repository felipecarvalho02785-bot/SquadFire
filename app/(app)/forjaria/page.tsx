import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

interface Integracao { nome: string; nota: string; ok: boolean; p1?: boolean }
interface FaseRow { ordem: number; nome: string; duracao_dias: number; is_gate: boolean }
interface RitualRow { titulo: string; recorrencia: string; escopo: string }

const RECOR: Record<string, string> = { diaria: 'todo dia', semanal: 'toda semana', dias_da_semana: 'dias fixos', mensal: 'todo mês', sprint: 'por sprint' };
const ESCOPO: Record<string, string> = { individual: 'individual', subconjunto: 'subconjunto', coletiva: 'coletiva' };

const FASES_DEMO: FaseRow[] = [
  { ordem: 1, nome: 'Alinhamento / Boas-vindas', duracao_dias: 7, is_gate: false },
  { ordem: 2, nome: 'Diagnóstico 360', duracao_dias: 7, is_gate: true },
  { ordem: 3, nome: 'Treinamento Comercial', duracao_dias: 7, is_gate: false },
  { ordem: 4, nome: 'Consultoria Comercial', duracao_dias: 7, is_gate: false },
  { ordem: 5, nome: 'Implementação CRM + IA', duracao_dias: 7, is_gate: true },
  { ordem: 6, nome: 'Auditoria de Mídia', duracao_dias: 7, is_gate: false },
  { ordem: 7, nome: 'Auditoria Criativa', duracao_dias: 7, is_gate: false },
];
const RITUAIS_DEMO: RitualRow[] = [
  { titulo: 'Check-in com cada Cria', recorrencia: 'toda semana', escopo: 'individual' },
  { titulo: 'Daily (alinhamento interno)', recorrencia: 'todo dia', escopo: 'coletiva' },
  { titulo: 'Planilha BSC', recorrencia: 'toda semana', escopo: 'coletiva' },
  { titulo: 'Relatório diário das tarefas', recorrencia: 'todo dia', escopo: 'individual' },
  { titulo: 'Weekly (alinhamento da squad)', recorrencia: 'toda semana', escopo: 'coletiva' },
  { titulo: 'Medir NPS', recorrencia: 'todo mês', escopo: 'individual' },
];

async function carregar(): Promise<{ integracoes: Integracao[]; fases: FaseRow[]; rituais: RitualRow[] }> {
  const integracoes: Integracao[] = [
    { nome: 'Banco (Supabase)', nota: 'auth, dados e RLS', ok: isSupabaseConfigured },
    { nome: 'ClickUp (sync de Crias)', nota: 'materializa a Squad 08', ok: !!process.env.CLICKUP_API_TOKEN },
    { nome: 'Cron (agendador)', nota: 'recorrência + risco diários', ok: !!process.env.CRON_SECRET },
    { nome: 'Faísca · Claude', nota: 'raciocínio e escrita', ok: !!process.env.ANTHROPIC_API_KEY },
    { nome: 'Faísca · Gemini', nota: 'transcrição de áudio', ok: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) },
    { nome: 'Google Agenda', nota: 'reuniões + Rodas de Fogo', ok: false, p1: true },
  ];

  if (!isSupabaseConfigured) return { integracoes, fases: FASES_DEMO, rituais: RITUAIS_DEMO };

  const supabase = await getSupabaseServer();
  const [{ data: fasesData }, { data: rotData }] = await Promise.all([
    supabase.from('fase').select('ordem, nome, duracao_dias, is_gate').order('ordem'),
    supabase.from('rotina').select('titulo, recorrencia_tipo, escopo').eq('ativo', true).order('titulo').limit(30),
  ]);
  const fases = (fasesData as FaseRow[]) ?? FASES_DEMO;
  const rituais = ((rotData as { titulo: string; recorrencia_tipo: string; escopo: string }[]) ?? []).map((r) => ({
    titulo: r.titulo, recorrencia: RECOR[r.recorrencia_tipo] ?? r.recorrencia_tipo, escopo: ESCOPO[r.escopo] ?? r.escopo,
  }));
  return { integracoes, fases, rituais: rituais.length ? rituais : RITUAIS_DEMO };
}

export default async function ForjariaPage() {
  const { integracoes, fases, rituais } = await carregar();

  return (
    <div className="main">
      <Topbar title="Forjaria" sub="configurações da Forja" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Gestão · Configurações</div>
            <h2>Forjaria</h2>
            <p>A oficina da Forja — integrações, fases, rituais e acesso. Onde a máquina é calibrada.</p>
          </div>
        </div>

        {/* Integrações */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="c-h"><span className="t">Integrações</span><span className="s">status das conexões</span></div>
          <div className="grid cols-3" style={{ marginTop: 4 }}>
            {integracoes.map((i) => (
              <div key={i.nome} style={{ border: '1px solid var(--border)', borderRadius: 11, padding: 14, background: 'color-mix(in srgb, var(--surface) 40%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 620, fontSize: 13 }}>{i.nome}</span>
                  <span className={`badge ${i.ok ? 'ok' : i.p1 ? 'dim' : 'risk'}`}>{i.ok ? 'conectado' : i.p1 ? 'P1' : 'pendente'}</span>
                </div>
                <div className="s" style={{ color: 'var(--muted)', marginTop: 6 }}>{i.nota}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid g-2">
          {/* Fases da Forja */}
          <div className="card">
            <div className="c-h"><span className="t">Fases da Forja</span><span className="s">7 fases · 7 dias cada</span></div>
            <table className="table">
              <thead><tr><th>#</th><th>Fase</th><th>Duração</th><th>Gate</th></tr></thead>
              <tbody>
                {fases.map((f) => (
                  <tr key={f.ordem}>
                    <td className="mono">{f.ordem}</td>
                    <td className="crname">{f.nome}</td>
                    <td className="mono">{f.duracao_dias}d</td>
                    <td>{f.is_gate ? <span className="badge ember">gate</span> : <span className="s" style={{ color: 'var(--faint)' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rituais */}
          <div className="card">
            <div className="c-h"><span className="t">Rituais (Rotinas)</span><span className="s">{rituais.length} ativos</span></div>
            <div className="list">
              {rituais.map((r, i) => (
                <div className="lrow" key={i}>
                  <div className="rmain"><div className="t">{r.titulo}</div><div className="s">{r.recorrencia} · {r.escopo}</div></div>
                  <span className="badge dim">{r.recorrencia}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Acesso */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="c-h"><span className="t">Acesso & Papéis</span><span className="s">allowlist da squad</span></div>
          <p className="s" style={{ color: 'var(--muted)' }}>
            O acesso é por allowlist: só quem está na tabela <code>membro</code> entra (SSO Google). Papéis
            (Contas / Projetos / Tráfego) e a flag de Admin definem o que cada um vê e edita — o Tráfego,
            por exemplo, só mexe em mídia. Gerencie a squad na <Link href="/brigada" className="linkact">Brigada →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
