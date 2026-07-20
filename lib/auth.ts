import { cache } from 'react';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Membro } from '@/lib/types/database';

// Usuário autenticado (Supabase Auth) ou null.
// cache(): dedup por request — várias chamadas no mesmo render fazem UM getUser
// (que é uma ida à rede pro Supabase Auth), não N.
export const getUser = cache(async () => {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Membro da squad correspondente ao usuário logado (allowlist por email).
// null = autenticado mas fora da allowlist (não é membro).
// cache(): o layout + a página + as funções de dados chamam isto no mesmo
// render — sem memoização era 1 getUser + 1 query CADA; agora é uma vez só.
export const getCurrentMembro = cache(async (): Promise<Membro | null> => {
  const user = await getUser();
  if (!user?.email) return null;

  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('membro')
    .select('*')
    .eq('email', user.email)
    .eq('ativo', true)
    .maybeSingle();

  return (data as Membro) ?? null;
});
