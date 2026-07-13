import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Lenha, Papel } from '@/lib/types/database';

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

  return { lenhas: (lenhas as Lenha[]) ?? [], rotinas };
}
