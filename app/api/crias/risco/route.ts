import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Recalcula cria.em_risco por SLA de fase vencida. GET = Vercel Cron.
export async function GET(request: Request) {
  // Falha FECHADA: sem CRON_SECRET, a rota fica trancada.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('recalcular_em_risco');
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, crias_atualizadas: data ?? 0 });
}
