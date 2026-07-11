import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Cria, Forja, Fase, FaseDaForja, Lenha } from '@/lib/types/database';

// Todas as leituras respeitam RLS (rodam como o membro logado).

export async function listCrias(): Promise<Cria[]> {
  if (!isSupabaseConfigured) return [];
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
