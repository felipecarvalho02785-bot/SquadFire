import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Cliente Supabase para Server Components / Route Handlers / Server Actions.
// Lê a sessão do usuário via cookies → RLS aplica o papel do membro logado.
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // chamado de um Server Component: ignorável, o middleware renova a sessão.
        }
      },
    },
  });
}

// Cliente com service_role (bypassa RLS) — SÓ server-side, para jobs/sync.
// Nunca expor a service key ao browser.
export function getSupabaseAdmin() {
  if (!env.supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — necessário para operações de sistema.');
  }
  return createServerClient(env.supabaseUrl, env.supabaseServiceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
