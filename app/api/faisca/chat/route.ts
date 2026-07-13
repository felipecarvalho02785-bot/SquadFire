import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { conversarFaisca, iaConfigurada } from '@/lib/ia/anthropic';
import { conversarFaiscaGemini, iaGeminiConfigurada } from '@/lib/ia/gemini';
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

  if (!iaGeminiConfigurada() && !iaConfigurada()) {
    return NextResponse.json({
      reply:
        'Ainda não tenho uma IA conectada aqui — falta a chave GOOGLE_GENERATIVE_AI_API_KEY (Gemini) nas variáveis de ambiente. ' +
        'Assim que ligar, eu respondo de verdade com o contexto do Squad.',
      demo: true,
    });
  }

  try {
    const contexto = await getContextoFaisca();
    const ctx = `${contexto}\n\nQuem fala com você agora: ${membro.nome} (${membro.papel_primario}${membro.is_admin ? ', admin' : ''}).`;
    // Gemini é o provedor primário (tier gratuito); Claude é fallback.
    const reply = iaGeminiConfigurada()
      ? await conversarFaiscaGemini(messages, ctx)
      : await conversarFaisca(messages, ctx);
    return NextResponse.json({ reply: reply || 'Não consegui formular uma resposta agora — tenta de novo?' });
  } catch (e) {
    // Loga o erro cru pro servidor, mas devolve uma mensagem limpa pro chat
    // (nada de JSON técnico vazando pra tela).
    console.error('[faisca/chat]', e);
    return NextResponse.json({ reply: mensagemAmigavel(e), erro: true });
  }
}

// Traduz erros da API de IA em algo que a pessoa entende (e resolve).
function mensagemAmigavel(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (raw.includes('credit balance') || raw.includes('plans & billing') || raw.includes('billing')) {
    return 'Estou sem créditos na conta de IA (Anthropic). Peça pro admin adicionar saldo em console.anthropic.com → Plans & Billing, que eu volto a responder na hora.';
  }
  if (raw.includes('invalid x-api-key') || raw.includes('authentication') || raw.includes('401')) {
    return 'Minha chave de IA parece inválida — confere a ANTHROPIC_API_KEY nas variáveis da Vercel.';
  }
  if (raw.includes('rate limit') || raw.includes('429') || raw.includes('overloaded') || raw.includes('529')) {
    return 'A IA está sobrecarregada neste instante. Tenta de novo em alguns segundos.';
  }
  return 'Tive um problema ao pensar aqui agora. Tenta de novo daqui a pouco?';
}
