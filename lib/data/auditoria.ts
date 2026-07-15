import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export interface AuditoriaRow {
  id: number;
  entidade: string;
  entidade_id: string | null;
  acao: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  membro_email: string | null;
  mudou: string[];
  alvo: string | null; // nome legível do alvo (nome da Cria, quando dá pra resolver)
  created_at: string;
}

type Raw = {
  id: number;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  membro_email: string | null;
  mudou: string[] | null;
  dados: Record<string, unknown> | null;
  created_at: string;
};

// Rastro de alterações (LGPD). A RLS já é admin-only — quem não é admin recebe
// zero linhas. Resolve um nome legível do alvo a partir do snapshot quando dá.
export async function getAuditoria(limit = 200): Promise<AuditoriaRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('auditoria')
    .select('id, entidade, entidade_id, acao, membro_email, mudou, dados, created_at')
    .order('id', { ascending: false })
    .limit(limit);

  return ((data as Raw[]) ?? []).map((r) => ({
    id: r.id,
    entidade: r.entidade,
    entidade_id: r.entidade_id,
    acao: r.acao,
    membro_email: r.membro_email,
    mudou: r.mudou ?? [],
    alvo: (r.dados?.nome_cliente as string) ?? null,
    created_at: r.created_at,
  }));
}
