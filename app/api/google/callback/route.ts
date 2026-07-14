import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { emailDaConta, trocarCodigo } from '@/lib/google/oauth';
import { salvarTokens } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Callback do OAuth: troca o code por tokens e guarda para o membro logado.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.redirect(`${origin}/login`);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const erro = url.searchParams.get('error');
  if (erro || !code) return NextResponse.redirect(`${origin}/forjaria?google=erro`);
  // state = id do membro que iniciou. EXIGE presença + igualdade: antes, sem
  // state a checagem era pulada (o && curto-circuitava), abrindo brecha pra
  // vincular a conta Google de um atacante à sessão da vítima.
  if (!state || state !== membro.id) return NextResponse.redirect(`${origin}/forjaria?google=erro`);

  try {
    const tok = await trocarCodigo(code);
    const email = await emailDaConta(tok.access_token);
    await salvarTokens(membro.id, tok, email);
    return NextResponse.redirect(`${origin}/forjaria?google=ok`);
  } catch {
    return NextResponse.redirect(`${origin}/forjaria?google=erro`);
  }
}
