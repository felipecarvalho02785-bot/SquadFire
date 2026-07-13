import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { conversarFaisca, iaConfigurada } from '@/lib/ia/anthropic';
import { getContextoFaisca } from '@/lib/data/faisca';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

type Turno = { role: 'user' | 'assistant'; content: string };

// Chat da Faísca (drawer). Recebe o histórico e responde com o Claude, usando um
// retrato real do Squad como contexto. Sem chave de IA, devolve 200 com uma
// resposta de orientação (não quebra a UI).
export async function POST(request: Request) {
  // Sem Supabase (modo demonstração) não há sessão para autenticar — responde
  // com uma mensagem de demonstração em vez de barrar.
  if (!isSupabaseConfigured) {
    return NextResponse.json({
      reply:
        'Estou em modo demonstração aqui — sem o banco conectado eu não tenho os números reais do Squad. ' +
        'Na produção (com login), eu respondo com o pulso das Forjas, Crias em risco e o que mais precisar.',
      demo: true,
    });
  }

  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  let body: { messages?: Turno[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'json inválido' }, { status: 400 });
  }

  // sanitiza: só user/assistant, com texto, e começando por um turno de usuário
  let messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .slice(-12);
  while (messages.length && messages[0].role !== 'user') messages = messages.slice(1);
  if (!messages.length) return NextResponse.json({ error: 'mensagem vazia' }, { status: 400 });

  if (!iaConfigurada()) {
    return NextResponse.json({
      reply:
        'Ainda não estou conectada ao Claude aqui — falta a chave ANTHROPIC_API_KEY nas variáveis de ambiente. ' +
        'Assim que ligar, eu respondo de verdade com o contexto do Squad.',
      demo: true,
    });
  }

  try {
    const contexto = await getContextoFaisca();
    const ctx = `${contexto}\n\nQuem fala com você agora: ${membro.nome} (${membro.papel_primario}${membro.is_admin ? ', admin' : ''}).`;
    const reply = await conversarFaisca(messages, ctx);
    return NextResponse.json({ reply: reply || 'Não consegui formular uma resposta agora — tenta de novo?' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido';
    return NextResponse.json({ error: `falha na Faísca: ${msg}` }, { status: 502 });
  }
}
