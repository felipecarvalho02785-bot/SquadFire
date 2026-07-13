import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Motor de recorrência: gera as Lenhas de Rotina do dia (por papel).
// GET = Vercel Cron (injeta o Bearer). Protegido por CRON_SECRET.
// Idempotente: rodar de novo no mesmo dia não duplica.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('gerar_lenhas_do_dia');
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Recalcula em_risco no mesmo cron (o plano Hobby da Vercel limita crons a 2/dia,
  // então dobramos aqui em vez de manter uma rota separada). Falha aqui não derruba
  // a geração de Lenhas.
  let criasEmRisco: number | null = null;
  const { data: risco, error: erroRisco } = await supabase.rpc('recalcular_em_risco');
  if (!erroRisco) criasEmRisco = risco ?? 0;

  return NextResponse.json({ ok: true, lenhas_criadas: data ?? 0, crias_reavaliadas: criasEmRisco });
}
