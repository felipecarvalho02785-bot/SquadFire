import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Membro, Papel } from '@/lib/types/database';

export interface MembroView {
  id: string;
  nome: string;
  email: string;
  is_admin: boolean;
  papel_primario: Papel;
  papeis: Papel[];
  lenhas_abertas: number;
}

// Brigada: membros ativos + papéis + carga de Lenhas em aberto.
export async function getBrigada(): Promise<MembroView[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await getSupabaseServer();

  const { data: membros } = await supabase
    .from('membro')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  const lista = (membros as Membro[]) ?? [];
  if (lista.length === 0) return [];

  const { data: papeisData } = await supabase.from('membro_papel').select('membro_id, papel');
  const { data: lenhasData } = await supabase
    .from('lenha')
    .select('responsavel_id')
    .neq('status', 'concluida');

  const papeisPor = new Map<string, Papel[]>();
  for (const p of (papeisData as { membro_id: string; papel: Papel }[]) ?? []) {
    papeisPor.set(p.membro_id, [...(papeisPor.get(p.membro_id) ?? []), p.papel]);
  }
  const cargaPor = new Map<string, number>();
  for (const l of (lenhasData as { responsavel_id: string | null }[]) ?? []) {
    if (l.responsavel_id) cargaPor.set(l.responsavel_id, (cargaPor.get(l.responsavel_id) ?? 0) + 1);
  }

  return lista.map((m) => ({
    id: m.id,
    nome: m.nome,
    email: m.email,
    is_admin: m.is_admin,
    papel_primario: m.papel_primario,
    papeis: papeisPor.get(m.id) ?? [m.papel_primario],
    lenhas_abertas: cargaPor.get(m.id) ?? 0,
  }));
}
