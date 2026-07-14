import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { puxarCriaDoClickup } from '@/lib/clickup/pull';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// "Puxar do ClickUp" de UMA Cria: dados + Data inicial + Semana/fase +
// comentários do ClickUp + PDF do diagnóstico. Body: { criaId }.
export async function POST(request: Request) {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ ok: false, error: 'ClickUp não configurado' }, { status: 400 });

  let body: { criaId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'json inválido' }, { status: 400 }); }
  if (!body.criaId) return NextResponse.json({ ok: false, error: 'criaId obrigatório' }, { status: 400 });

  const r = await puxarCriaDoClickup(body.criaId);
  if (r.ok) await getSupabaseAdmin().from('cria').update({ clickup_puxado_em: new Date().toISOString() }).eq('id', body.criaId);
  return NextResponse.json({ ...r, error: r.ok ? undefined : (r.error ?? 'nada novo pra puxar') });
}
