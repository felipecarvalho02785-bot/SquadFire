import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { puxarCriaDoClickup } from '@/lib/clickup/pull';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Quantas Crias por chamada — a extração pela Faísca é pesada, então o cliente
// chama de novo até zerar (mostra o progresso).
const LOTE = 5;

// Puxa TODAS as Crias ativas do ClickUp, em lotes. Cada chamada processa até
// LOTE Crias ainda não puxadas e devolve o que falta. Só admin.
export async function POST() {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 });
  if (!membro.is_admin) return NextResponse.json({ ok: false, error: 'só admin pode puxar todos' }, { status: 403 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ ok: false, error: 'ClickUp não configurado' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const base = () => admin.from('cria').select('id', { count: 'exact' }).eq('status', 'ativa').not('clickup_task_id', 'is', null).is('clickup_puxado_em', null);

  const { count: total } = await base().limit(0);
  const { data: pend } = await base().order('nome_cliente').limit(LOTE);
  const ids = ((pend as { id: string }[]) ?? []).map((p) => p.id);

  let atualizados = 0;
  for (const id of ids) {
    try { const r = await puxarCriaDoClickup(id); if (r.ok) atualizados += 1; } catch { /* segue */ }
    await admin.from('cria').update({ clickup_puxado_em: new Date().toISOString() }).eq('id', id);
  }

  return NextResponse.json({ ok: true, processados: ids.length, atualizados, restantes: Math.max(0, (total ?? 0) - ids.length) });
}
