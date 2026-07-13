import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Cria, Forja, Fase, FaseDaForja, Lenha } from '@/lib/types/database';

// Todas as leituras respeitam RLS (rodam como o membro logado).

// Crias de demonstração (sem Supabase) — pra ver as telas populadas.
function demoCrias(): Cria[] {
  const base = { email: null, telefone_whatsapp: null, produto: 'estruturacao' as const, closer: null, gestor_contas_id: null, clickup_task_id: null, clickup_squad: '08', sincronizado_em: null, diagnostico_path: null, diagnostico_nome: null, created_at: '', updated_at: '' };
  const mk = (id: string, nome: string, area: string, semana: number | null, status: Cria['status'], risco: boolean, inv: number | null): Cria => ({
    ...base, id, nome_cliente: nome, area_atuacao: area, clickup_semana: semana, status, em_risco: risco, investimento_midia: inv,
  });
  return [
    mk('d1', 'M. Oliveira Sociedade de Advogados', 'Previdenciário', 1, 'ativa', false, 3000),
    mk('d2', 'Edi Carlos Advocacia', 'Trabalhista', 2, 'ativa', false, 2500),
    mk('d3', 'Renato Leo e Advogados Associados', 'Cível', 2, 'ativa', false, 4000),
    mk('d4', 'Letícia Stein Carlos de Souza', 'Família', 3, 'ativa', true, 3500),
    mk('d5', 'Mozini Advocacia', 'Empresarial', 3, 'ativa', false, 5000),
    mk('d6', 'Giancarlo Terezam Advocacia', 'Tributário', 3, 'ativa', false, 2200),
    mk('d7', 'Giuliane Giorgi Torres', 'Previdenciário', 4, 'ativa', false, 2800),
    mk('d8', 'Luzia Barbosa Advocacia', 'Cível', 4, 'ativa', false, 3100),
    mk('d9', 'Mendes Advocacia Previdenciária', 'Previdenciário', 5, 'ativa', true, 6000),
    mk('d10', 'Ribeiro & Advogados Associados', 'Trabalhista', 6, 'ativa', false, 4500),
    mk('d11', 'Cardoso & Martins Advocacia', 'A definir', null, 'ativa', false, null),
    mk('d12', 'Lima & Moraes Advogados', 'A definir', null, 'ativa', false, null),
  ];
}

export async function listCrias(): Promise<Cria[]> {
  if (!isSupabaseConfigured) return demoCrias();
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('cria')
    .select('*')
    .order('nome_cliente', { ascending: true });
  if (error) return [];
  return (data as Cria[]) ?? [];
}

export interface GargaloView {
  id: string;
  descricao: string;
  status: 'aberto' | 'em_resolucao' | 'resolvido';
}

export interface DocRef { url: string | null; nome: string | null }
export interface BriefingView {
  id: string;
  data: string;
  semana: string | null;
  enviadoClickup: boolean;
  campos: { label: string; texto: string }[];
}

export interface CriaDetalhe {
  cria: Cria;
  forja: Forja | null;
  fases: (FaseDaForja & { fase: Fase })[];
  lenhas: Lenha[];
  gestor: { nome: string } | null;
  gargalos: GargaloView[];
  briefingsSemana: number;
  diagnostico: DocRef;
  contrato: (DocRef & { valor: number | null }) | null;
  briefings: BriefingView[];
}

const BRIEFING_CAMPOS: [string, string][] = [
  ['c1_o_que_aconteceu', 'O que aconteceu essa semana'],
  ['c2_satisfacao', 'Satisfação'],
  ['c3_campanhas', 'Campanhas'],
  ['c4_nosso_desempenho', 'Nosso desempenho'],
  ['c5_pontos_atencao', 'Pontos de atenção'],
  ['c6_proximos_passos', 'Próximos passos'],
];

const FASES_NOMES = ['Alinhamento', 'Diagnóstico 360', 'Treinamento', 'Consultoria', 'Implementação CRM + IA', 'Auditoria de Mídia', 'Auditoria Criativa'];

function demoCriaDetalhe(id: string): CriaDetalhe {
  const cria = demoCrias().find((c) => c.id === id) ?? demoCrias()[0];
  const atual = 1; // fase corrente (demo)
  const forjaId = `${cria.id}-forja`;
  const fases = FASES_NOMES.map((nome, i): FaseDaForja & { fase: Fase } => {
    const ordem = i + 1;
    return {
      id: `${cria.id}-f${ordem}`,
      forja_id: forjaId,
      fase_id: `fase-${ordem}`,
      ordem,
      data_prevista_inicio: null,
      data_prevista_fim: null,
      data_realizada_inicio: null,
      data_realizada_fim: null,
      status: ordem < atual ? 'concluida' : ordem === atual ? 'em_andamento' : 'pendente',
      fase: { id: `fase-${ordem}`, ordem, nome, duracao_dias: 7, is_gate: ordem === 2, gate_descricao: null },
    };
  });
  const faseAtualId = fases[atual - 1].id;
  const lenhas: Lenha[] = [
    { id: `${cria.id}-l1`, tipo: 'forja', titulo: 'Revisar entregáveis da fase', descricao: null, status: 'pendente', prioridade: 'alta', prazo: null, responsavel_id: null, fase_da_forja_id: faseAtualId, rotina_id: null, data_referencia: null, concluida_em: null, created_at: '', updated_at: '' },
    { id: `${cria.id}-l2`, tipo: 'forja', titulo: 'Agendar Roda de Fogo semanal', descricao: null, status: 'pendente', prioridade: 'media', prazo: null, responsavel_id: null, fase_da_forja_id: faseAtualId, rotina_id: null, data_referencia: null, concluida_em: null, created_at: '', updated_at: '' },
  ];
  const forja: Forja = {
    id: forjaId, cria_id: cria.id, data_inicio: '2026-07-07', flag_contrato: cria.em_risco ? 'brasa_viva' : 'forja_quente',
    fase_atual_id: faseAtualId, concluida: false, created_at: '', updated_at: '',
  };
  return { cria, forja, fases, lenhas, gestor: { nome: 'Felipe Carvalho' }, gargalos: [], briefingsSemana: 0, diagnostico: { url: null, nome: null }, contrato: null, briefings: [] };
}

export async function getCriaDetalhe(id: string): Promise<CriaDetalhe | null> {
  if (!isSupabaseConfigured) return demoCriaDetalhe(id);
  const supabase = await getSupabaseServer();

  const { data: cria } = await supabase.from('cria').select('*').eq('id', id).maybeSingle();
  if (!cria) return null;

  const { data: forja } = await supabase
    .from('forja')
    .select('*')
    .eq('cria_id', id)
    .maybeSingle();

  let fases: (FaseDaForja & { fase: Fase })[] = [];
  let lenhas: Lenha[] = [];
  if (forja) {
    const { data: fasesData } = await supabase
      .from('fase_da_forja')
      .select('*, fase:fase_id(*)')
      .eq('forja_id', (forja as Forja).id)
      .order('ordem', { ascending: true });
    fases = (fasesData as (FaseDaForja & { fase: Fase })[]) ?? [];

    const faseIds = fases.map((f) => f.id);
    if (faseIds.length) {
      const { data: lenhasData } = await supabase
        .from('lenha')
        .select('*')
        .in('fase_da_forja_id', faseIds);
      lenhas = (lenhasData as Lenha[]) ?? [];
    }
  }

  let gestor: { nome: string } | null = null;
  if ((cria as Cria).gestor_contas_id) {
    const { data: g } = await supabase
      .from('membro')
      .select('nome')
      .eq('id', (cria as Cria).gestor_contas_id!)
      .maybeSingle();
    gestor = (g as { nome: string }) ?? null;
  }

  // gargalos abertos + briefings desta semana (KPIs) + contrato + histórico de briefings
  const seteDias = new Date();
  seteDias.setDate(seteDias.getDate() - 7);
  const [{ data: gargData }, { count: briefCount }, { data: contratoRow }, { data: briefingsData }] = await Promise.all([
    supabase.from('gargalo').select('id, descricao, status').eq('cria_id', id).order('created_at', { ascending: false }),
    supabase.from('briefing').select('*', { count: 'exact', head: true }).eq('cria_id', id).gte('created_at', seteDias.toISOString()),
    supabase.from('contrato').select('arquivo_url, valor_contrato').eq('cria_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('briefing').select('id, semana_referencia, created_at, enviado_clickup, c1_o_que_aconteceu, c2_satisfacao, c3_campanhas, c4_nosso_desempenho, c5_pontos_atencao, c6_proximos_passos').eq('cria_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  const gargalos = (gargData as GargaloView[]) ?? [];

  // URL assinada (buckets privados) — válida por 1h, gerada ao exibir.
  async function assinar(bucket: string, path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  const c = cria as Cria;
  const contratoR = contratoRow as { arquivo_url: string | null; valor_contrato: number | null } | null;
  const [diagUrl, contratoUrl] = await Promise.all([
    assinar('entregaveis', c.diagnostico_path),
    assinar('contratos', contratoR?.arquivo_url),
  ]);

  const briefings: BriefingView[] = ((briefingsData as Record<string, unknown>[]) ?? []).map((b) => ({
    id: String(b.id),
    data: String(b.created_at),
    semana: (b.semana_referencia as string | null) ?? null,
    enviadoClickup: !!b.enviado_clickup,
    campos: BRIEFING_CAMPOS.map(([k, label]) => ({ label, texto: String(b[k] ?? '').trim() })).filter((x) => x.texto),
  }));

  return {
    cria: c,
    forja: (forja as Forja) ?? null,
    fases,
    lenhas,
    gestor,
    gargalos,
    briefingsSemana: briefCount ?? 0,
    diagnostico: { url: diagUrl, nome: c.diagnostico_nome },
    contrato: contratoR ? { url: contratoUrl, nome: null, valor: contratoR.valor_contrato } : null,
    briefings,
  };
}

export interface ComentarioView {
  id: string;
  corpo: string;
  created_at: string;
  autor_nome: string;
}

export async function getComentarios(criaId: string): Promise<ComentarioView[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('comentario')
    .select('id, corpo, created_at, autor:autor_id(nome)')
    .eq('cria_id', criaId)
    .order('created_at', { ascending: false })
    .limit(50);
  return ((data as unknown as { id: string; corpo: string; created_at: string; autor: { nome: string } | null }[]) ?? []).map(
    (c) => ({ id: c.id, corpo: c.corpo, created_at: c.created_at, autor_nome: c.autor?.nome ?? '—' }),
  );
}

// KPIs simples do panorama (Covil).
export async function getCovilResumo() {
  const crias = await listCrias();
  return {
    total: crias.length,
    ativas: crias.filter((c) => c.status === 'ativa').length,
    emRisco: crias.filter((c) => c.em_risco).length,
    backlog: crias.filter((c) => c.clickup_semana == null && c.status === 'ativa').length,
  };
}
