import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { getAlertas } from '@/lib/data/alertas';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Alertas do membro logado (pro sino). Sem sessão/banco → lista vazia (200).
export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ itens: [], total: 0, resumo: '' });
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ itens: [], total: 0, resumo: '' });
  const alertas = await getAlertas(membro);
  return NextResponse.json(alertas);
}
