import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { syncCrias } from '@/integracao/clickup/sync-crias.js';

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
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
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
  const agora = new Date().toISOString();
  let upserts = 0;
  const erros: string[] = [];

  for (const c of resultado.crias) {
    // dados do cliente lidos da descrição — só os campos preenchidos entram
    // (não sobrescreve o que já existe no CRM com vazio).
    const patch: Record<string, unknown> = {
      clickup_task_id: c.clickup_task_id,
      nome_cliente: c.nome_cliente,
      clickup_squad: c.clickup_squad,
      clickup_semana: c.clickup_semana,
      status: c.status,
      sincronizado_em: agora,
    };
    for (const k of ['email', 'telefone_whatsapp', 'area_atuacao', 'closer'] as const) {
      if (c.dados?.[k]) patch[k] = c.dados[k];
    }

    const { data: up, error } = await supabase.from('cria').upsert(patch, { onConflict: 'clickup_task_id' }).select('id').maybeSingle();
    if (error) { erros.push(`${c.nome_cliente}: ${error.message}`); continue; }
    upserts += 1;

    const criaId = (up as { id: string } | null)?.id;
    if (!criaId) continue;
    // "Data inicial" → início da Forja (cascateia prazos); "Semana" → fase atual.
    if (c.data_inicio) {
      const { error: e2 } = await supabase.rpc('definir_inicio_forja_sync', { p_cria_id: criaId, p_data: c.data_inicio });
      if (e2) erros.push(`${c.nome_cliente} (data inicial): ${e2.message}`);
    }
    if (c.clickup_semana) {
      const { error: e3 } = await supabase.rpc('definir_fase_forja_sync', { p_cria_id: criaId, p_semana: c.clickup_semana });
      if (e3) erros.push(`${c.nome_cliente} (fase): ${e3.message}`);
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    total_tasks: resultado.total_tasks,
    squad08: resultado.squad08_count,
    upserts,
    erros,
  });
}
