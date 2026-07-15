// Acesso central às variáveis de ambiente. Fallbacks de placeholder evitam
// que o build quebre quando as envs ainda não estão setadas; em runtime, se
// faltarem de verdade, as chamadas ao Supabase é que vão falhar claramente.
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

// Só valores PÚBLICOS aqui — este objeto é importado tanto no server quanto no
// cliente. A SERVICE ROLE KEY NÃO entra: fica só no server (getSupabaseAdmin lê
// direto de process.env), pra um refactor não conseguir vazá-la no bundle.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
};

// True quando as envs reais do Supabase estão presentes (não os placeholders).
export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
