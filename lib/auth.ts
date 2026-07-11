import { getSupabaseServer } from '@/lib/supabase/server';
import type { Membro } from '@/lib/types/database';

// Usuário autenticado (Supabase Auth) ou null.
export async function getUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Membro da squad correspondente ao usuário logado (allowlist por email).
// null = autenticado mas fora da allowlist (não é membro).
export async function getCurrentMembro(): Promise<Membro | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from('membro')
    .select('*')
    .eq('email', user.email)
    .eq('ativo', true)
    .maybeSingle();

  return (data as Membro) ?? null;
}
