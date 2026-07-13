import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { desconectarGoogle } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Desconecta o Google Agenda do membro (apaga os tokens).
export async function POST() {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  await desconectarGoogle(membro.id);
  return NextResponse.json({ ok: true });
}
