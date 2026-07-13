import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { googleConfigurado, urlDeConsentimento } from '@/lib/google/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Inicia o OAuth do Google Agenda: manda o membro para a tela de consentimento.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.redirect(`${origin}/login`);
  if (!googleConfigurado()) return NextResponse.redirect(`${origin}/forjaria?google=config`);
  return NextResponse.redirect(urlDeConsentimento(membro.id));
}
