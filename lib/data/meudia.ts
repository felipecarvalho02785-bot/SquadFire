import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { faseLabel, iniciais } from '@/lib/format';
import { statusGoogle, listarEventos } from '@/lib/google/calendar';
import { hojeBRT, limitesDoDiaBRT } from '@/lib/datas';
import type { Cria, Lenha, Papel } from '@/lib/types/database';

export interface RotinaResumo {
  id: string;
  titulo: string;
  recorrencia_tipo: string;
  ativo: boolean;
}

export interface MeuDia {
  lenhas: Lenha[];
  rotinas: RotinaResumo[];
}

// Cockpit do membro: suas Lenhas em aberto + as rotinas do seu papel.
// O motor de recorrência (P1) é quem vai gerar as Lenhas de rotina do dia;
// por ora exibimos o catálogo de rituais + as Lenhas já atribuídas.
export async function getMeuDia(membroId: string, papel: Papel): Promise<MeuDia> {
  if (!isSupabaseConfigured) return { lenhas: [], rotinas: [] };
  const supabase = await getSupabaseServer();

  const { data: lenhas } = await supabase
    .from('lenha')
    .select('*')
    .eq('responsavel_id', membroId)
    .neq('status', 'concluida')
    .order('prazo', { ascending: true, nullsFirst: false });

  // Rotinas só entram no "hoje" se forem do dia (data_referencia = hoje) — assim
  // rituais antigos não concluídos não acumulam. Forja/avulsa aparecem sempre.
  const hojeStr = hojeBRT();
  const doDia = ((lenhas as Lenha[]) ?? []).filter((l) => l.tipo !== 'rotina' || l.data_referencia === hojeStr);

  const { data: rp } = await supabase
    .from('rotina_papel')
    .select('rotina_id')
    .eq('papel', papel);

  const rotinaIds = (rp ?? []).map((r: { rotina_id: string }) => r.rotina_id);
  let rotinas: RotinaResumo[] = [];
  if (rotinaIds.length) {
    const { data: rot } = await supabase
      .from('rotina')
      .select('id, titulo, recorrencia_tipo, ativo')
      .in('id', rotinaIds)
      .eq('ativo', true)
      .order('titulo');
    rotinas = (rot as RotinaResumo[]) ?? [];
  }

  return { lenhas: doDia, rotinas };
}

// ── Cockpit completo do dia (Meu Dia imersivo) ───────────────────
export interface LenhaRow { id: string; titulo: string; sub: string; repete: string | null; pill: { label: string; kind: 'crit' | 'warn' | 'good' } | null; done: boolean }
export interface AgendaItem { hora: string; titulo: string; tag: string; kind: 'cliente' | 'interna' | 'roda' }
export interface BriefRow { iniciais: string; nome: string; sub: string; acao: string; href: string }
export interface RitualRow { titulo: string; sub: string; status: { label: string; kind: 'good' | 'warn' | 'crit' } | null }

export interface MeuDiaDash {
  demo: boolean;
  nome: string;
  banner: { titulo: string; sub: string } | null;
  kpis: { lenhasHoje: number; deRotina: number; slaQuente: number; briefings: number; checkins: number };
  lenhas: LenhaRow[];
  agenda: AgendaItem[];
  briefings: BriefRow[];
  rituais: RitualRow[];
}

const RECOR: Record<string, string> = { diaria: 'todo dia', semanal: 'toda semana', dias_da_semana: 'dias fixos', mensal: 'todo mês', sprint: 'por sprint' };

function demoMeuDia(): MeuDiaDash {
  return {
    demo: true,
    nome: 'Felipe',
    banner: { titulo: 'Quinta-feira · dia do briefing semanal', sub: 'colete os briefings das suas Crias e publique no ClickUp' },
    kpis: { lenhasHoje: 6, deRotina: 2, slaQuente: 2, briefings: 3, checkins: 4 },
    lenhas: [
      { id: 'x1', titulo: 'Coletar briefing · Letícia', sub: 'Contas · SLA vermelho', repete: null, pill: { label: 'SLA vermelho', kind: 'crit' }, done: false },
      { id: 'x2', titulo: 'Follow-up de NPS · Mozini', sub: 'Contas · Fase 3', repete: null, pill: null, done: false },
      { id: 'x3', titulo: 'Relatório diário das tarefas', sub: 'fim de expediente', repete: 'repete diariamente', pill: null, done: false },
      { id: 'x4', titulo: 'Check-in semanal · Edi Carlos', sub: 'Contas · Fase 2', repete: 'repete semanal', pill: null, done: false },
      { id: 'x5', titulo: 'Enviar conteúdo pra aprovação · Raphael', sub: 'Contas', repete: null, pill: null, done: true },
    ],
    agenda: [
      { hora: '09:00', titulo: 'Daily · Squad', tag: 'Interna', kind: 'interna' },
      { hora: '11:00', titulo: 'Reunião · Letícia Stein', tag: 'Cliente', kind: 'cliente' },
      { hora: '15:00', titulo: 'Roda de Fogo · Letícia', tag: 'Roda', kind: 'roda' },
      { hora: '17:30', titulo: 'Alinhamento de contas', tag: 'Interna', kind: 'interna' },
    ],
    briefings: [
      { iniciais: 'LS', nome: 'Letícia Stein', sub: 'briefing pendente · SLA vermelho', acao: 'Coletar →', href: '/crias' },
      { iniciais: 'MO', nome: 'Mozini Advocacia', sub: 'check-in semanal', acao: 'Check-in →', href: '/crias' },
    ],
    rituais: [
      { titulo: 'Daily (alinhamento)', sub: 'todo dia · 09:00', status: { label: 'feito', kind: 'good' } },
      { titulo: 'Briefing semanal', sub: 'quinta · hoje', status: { label: 'hoje', kind: 'warn' } },
      { titulo: 'Weekly + BSC', sub: 'sexta', status: { label: 'amanhã', kind: 'good' } },
      { titulo: 'Medir NPS', sub: 'mensal', status: { label: 'dia 30', kind: 'good' } },
    ],
  };
}

export async function getMeuDiaDashboard(membro: { id: string; nome: string; papel_primario: Papel } | null): Promise<MeuDiaDash> {
  if (!isSupabaseConfigured) return demoMeuDia();
  if (!membro) {
    return { demo: false, nome: 'squad', banner: null, kpis: { lenhasHoje: 0, deRotina: 0, slaQuente: 0, briefings: 0, checkins: 0 }, lenhas: [], agenda: [], briefings: [], rituais: [] };
  }
  const supabase = await getSupabaseServer();
  const base = await getMeuDia(membro.id, membro.papel_primario);
  const hoje = new Date();
  const hojeStr = hojeBRT();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - 7);

  // Todos os membros conectados fazem parte do projeto de cada Cria — então o
  // dia de todo mundo enxerga TODAS as Crias ativas (não só as que gerencia).
  const { data: minhasData } = await supabase.from('cria').select('*').eq('status', 'ativa').order('nome_cliente');
  const minhas = (minhasData as Cria[]) ?? [];
  const minhasAtivas = minhas;
  const slaQuente = minhasAtivas.filter((c) => c.em_risco).length;

  // Briefings desta semana → quantas Crias ainda faltam
  let briefadas = new Set<string>();
  if (minhas.length) {
    const { data: bs } = await supabase
      .from('briefing')
      .select('cria_id')
      .in('cria_id', minhas.map((c) => c.id))
      .gte('created_at', inicioSemana.toISOString());
    briefadas = new Set(((bs as { cria_id: string }[]) ?? []).map((b) => b.cria_id));
  }
  const briefings = minhasAtivas.filter((c) => !briefadas.has(c.id)).length;

  const lenhas: LenhaRow[] = base.lenhas.map((l) => {
    // Atrasada só se o prazo é ESTRITAMENTE antes de hoje (BRT). Prazo = hoje
    // não é atraso (antes pintava vermelho ~3h cedo, contradizendo o sino).
    const atrasada = l.prazo ? l.prazo < hojeStr && l.status !== 'concluida' : false;
    const tipoLabel = l.tipo === 'forja' ? 'Forja' : l.tipo === 'rotina' ? 'Rotina' : 'Do dia';
    return {
      id: l.id,
      titulo: l.titulo,
      sub: [tipoLabel, l.prazo ? `prazo ${l.prazo}` : null].filter(Boolean).join(' · '),
      repete: null,
      pill: atrasada ? { label: 'SLA vermelho', kind: 'crit' } : null,
      done: l.status === 'concluida',
    };
  });

  const rituais: RitualRow[] = base.rotinas.map((r) => ({
    titulo: r.titulo,
    sub: RECOR[r.recorrencia_tipo] ?? r.recorrencia_tipo,
    status: null,
  }));

  const briefingsList: BriefRow[] = minhasAtivas.slice(0, 6).map((c) => ({
    iniciais: iniciais(c.nome_cliente),
    nome: c.nome_cliente,
    sub: briefadas.has(c.id) ? 'briefing coletado' : faseLabel(c.clickup_semana),
    acao: briefadas.has(c.id) ? 'Ver →' : 'Coletar →',
    href: `/crias/${c.id}/roda`,
  }));

  // Agenda de hoje: reuniões do Google Agenda do membro (inclui as Rodas de
  // Fogo agendadas). Só aparece se ele conectou o Google.
  const agenda: AgendaItem[] = [];
  const g = await statusGoogle(membro.id);
  if (g.conectado) {
    // Janela = o dia de hoje em Brasília (não o dia UTC do servidor, senão os
    // eventos da noite vazam pro "amanhã" e somem da lista).
    const { ini, fim } = limitesDoDiaBRT();
    for (const ev of await listarEventos(membro.id, ini, fim)) {
      const t = ev.titulo.toLowerCase();
      const kind: AgendaItem['kind'] = /roda de fogo/.test(t) ? 'roda' : /daily|weekly|alinhamento|squad|interna/.test(t) ? 'interna' : 'cliente';
      // Horário no fuso de Brasília (o servidor da Vercel roda em UTC — sem isso
      // os horários saíam +3h). É o horário local da squad.
      const hora = ev.allDay || !ev.inicio ? 'dia' : new Date(ev.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      agenda.push({ hora, titulo: ev.titulo, tag: kind === 'roda' ? 'Roda' : kind === 'interna' ? 'Interna' : 'Cliente', kind });
    }
    agenda.sort((a, b) => a.hora.localeCompare(b.hora));
  }

  return {
    demo: false,
    nome: membro.nome.split(' ')[0],
    banner: null,
    kpis: {
      lenhasHoje: base.lenhas.length,
      deRotina: base.lenhas.filter((l) => l.tipo === 'rotina').length,
      slaQuente,
      briefings,
      checkins: minhasAtivas.length,
    },
    lenhas,
    agenda,
    briefings: briefingsList,
    rituais,
  };
}
