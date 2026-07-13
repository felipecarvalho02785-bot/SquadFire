import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { criarEvento } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Agenda a Roda de Fogo no Google Agenda do membro logado.
// Body: { titulo, inicioISO, fimISO, descricao? }
export async function POST(request: Request) {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 });

  let body: { titulo?: string; inicioISO?: string; fimISO?: string; descricao?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'payload inválido' }, { status: 400 });
  }

  const { titulo, inicioISO, fimISO, descricao } = body;
  if (!titulo || !inicioISO || !fimISO) {
    return NextResponse.json({ ok: false, error: 'informe título e horário' }, { status: 400 });
  }

  const r = await criarEvento(membro.id, { titulo, descricao, inicioISO, fimISO });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, htmlLink: r.htmlLink });
}
