'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

// Cliente Supabase para Client Components (login com Google, realtime, etc.).
export function getSupabaseBrowser() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
