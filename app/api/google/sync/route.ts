import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { sincronizarFasesGoogle, statusGoogle } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Empurra os prazos das fases das Forjas ativas pro Google Agenda do membro
// (CRM → Google). Idempotente — re-rodar atualiza em vez de duplicar.
export async function POST() {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 });

  const st = await statusGoogle(membro.id);
  if (!st.conectado) return NextResponse.json({ ok: false, error: 'Google Agenda não conectado' }, { status: 400 });

  const r = await sincronizarFasesGoogle(membro.id);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
