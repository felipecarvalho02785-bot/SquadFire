import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { syncCrias } from '@/integracao/clickup/sync-crias.js';
import { aplicarCriaNoBanco, recalcularRisco } from '@/lib/clickup/espelho';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Sincroniza as Crias do ClickUp (lista-mestre, Squad 08) → tabela `cria`.
// Protegido por CRON_SECRET (header Authorization: Bearer <segredo>).
// Escreve com service_role (bypassa RLS). O trigger cria a Forja nos inserts.
// GET = Vercel Cron (que injeta o Bearer automaticamente); POST = manual.
export async function GET(request: Request) {
  return runSync(request);
}

export async function POST(request: Request) {
  return runSync(request);
}

async function runSync(request: Request) {
  // Falha FECHADA: sem CRON_SECRET, a rota fica trancada (não roda sync público).
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  if (!process.env.CLICKUP_API_TOKEN) {
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN ausente' }, { status: 400 });
  }

  let resultado;
  try {
    resultado = await syncCrias({ includeClosed: true });
  } catch (e) {
    return NextResponse.json({ error: `falha ao ler ClickUp: ${String(e)}` }, { status: 502 });
  }

  const supabase = getSupabaseAdmin();
  let upserts = 0;
  const erros: string[] = [];

  // Grava cada Cria via o helper compartilhado (mesmo caminho do webhook e do
  // pull-on-view): upsert + cascata (Data inicial → prazos; Semana → fase).
  for (const c of resultado.crias) {
    const r = await aplicarCriaNoBanco(supabase, c);
    if (r.ok) upserts += 1;
    else erros.push(`${c.nome_cliente}: ${r.error}`);
  }

  // Recalcula o em_risco (no Hobby não há slot de cron dedicado pra isso).
  await recalcularRisco(supabase);

  return NextResponse.json({
    ok: erros.length === 0,
    total_tasks: resultado.total_tasks,
    squad08: resultado.squad08_count,
    upserts,
    erros,
  });
}
