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
  // Pendentes = ativas com task no ClickUp, ainda não puxadas e com menos de 3
  // tentativas falhas (senão o lote nunca convergiria se uma falhasse sempre).
  const base = () => admin.from('cria').select('id', { count: 'exact' }).eq('status', 'ativa').not('clickup_task_id', 'is', null).is('clickup_puxado_em', null).lt('clickup_puxa_tentativas', 3);

  const { data: pend } = await base().order('nome_cliente').limit(LOTE);
  const ids = ((pend as { id: string }[]) ?? []).map((p) => p.id);

  let atualizados = 0;
  for (const id of ids) {
    let ok = false;
    try { const r = await puxarCriaDoClickup(id); ok = r.ok; if (ok) atualizados += 1; } catch { /* segue */ }
    if (ok) {
      await admin.from('cria').update({ clickup_puxado_em: new Date().toISOString() }).eq('id', id);
      // Gestor de Contas = quem puxou, pras Crias que ainda não têm gestor.
      await admin.from('cria').update({ gestor_contas_id: membro.id }).eq('id', id).is('gestor_contas_id', null);
    } else {
      // Falhou: conta a tentativa (após 3, sai do lote — sem marcar sucesso falso).
      const { data: cur } = await admin.from('cria').select('clickup_puxa_tentativas').eq('id', id).maybeSingle();
      const t = ((cur as { clickup_puxa_tentativas: number } | null)?.clickup_puxa_tentativas ?? 0) + 1;
      await admin.from('cria').update({ clickup_puxa_tentativas: t }).eq('id', id);
    }
  }

  // Recontagem real dos pendentes (sucessos saíram; falhas <3 ainda contam).
  const { count: restantes } = await base().limit(0);
  return NextResponse.json({ ok: true, processados: ids.length, atualizados, restantes: restantes ?? 0 });
}
