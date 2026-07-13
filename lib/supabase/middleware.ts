import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env, isSupabaseConfigured } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Renova a sessão do Supabase a cada request e protege as rotas do app.
// Rotas públicas: /login e /auth/*. Todo o resto exige sessão.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/auth') ||
    path.startsWith('/_next') ||
    // Endpoints máquina-a-máquina: autenticam por CRON_SECRET / assinatura do
    // webhook — não podem passar pela trava de sessão (senão redirecionam).
    path.startsWith('/api/clickup') ||
    path.startsWith('/api/rotinas') ||
    path.startsWith('/api/crias') ||
    path === '/favicon.ico';

  // Sem Supabase configurado, não há como autenticar: libera para o app
  // renderizar seus estados vazios/onboarding em vez de travar em redirect.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/meu-dia';
    return NextResponse.redirect(url);
  }

  return response;
}
