import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Cria, Forja, Fase, FaseDaForja, Lenha } from '@/lib/types/database';

// Todas as leituras respeitam RLS (rodam como o membro logado).

// Crias de demonstração (sem Supabase) — pra ver as telas populadas.
function demoCrias(): Cria[] {
  const base = { email: null, telefone_whatsapp: null, produto: 'estruturacao' as const, closer: null, gestor_contas_id: null, clickup_task_id: null, clickup_squad: '08', sincronizado_em: null, created_at: '', updated_at: '' };
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

export interface CriaDetalhe {
  cria: Cria;
  forja: Forja | null;
  fases: (FaseDaForja & { fase: Fase })[];
  lenhas: Lenha[];
  gestor: { nome: string } | null;
}

export async function getCriaDetalhe(id: string): Promise<CriaDetalhe | null> {
  if (!isSupabaseConfigured) return null;
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

  return { cria: cria as Cria, forja: (forja as Forja) ?? null, fases, lenhas, gestor };
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
