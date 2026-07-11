// Acesso central às variáveis de ambiente. Fallbacks de placeholder evitam
// que o build quebre quando as envs ainda não estão setadas; em runtime, se
// faltarem de verdade, as chamadas ao Supabase é que vão falhar claramente.
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
};

// True quando as envs reais do Supabase estão presentes (não os placeholders).
export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
