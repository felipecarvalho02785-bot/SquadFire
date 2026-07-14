import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { conversarFaiscaComFerramentas, iaGeminiConfigurada } from '@/lib/ia/gemini';
import { FERRAMENTAS_FAISCA, executarFerramentaFaisca } from '@/lib/ia/faisca-tools';
import { getContextoFaisca } from '@/lib/data/faisca';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

type Turno = { role: 'user' | 'assistant'; content: string };

// Chat da Faísca (drawer). Recebe o histórico e responde com o Gemini, usando um
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
  // Coalesce turnos consecutivos do mesmo papel — o Gemini espera alternância
  // user/model; dois 'user' seguidos podem gerar 400.
  const coal: Turno[] = [];
  for (const m of messages) {
    const ult = coal[coal.length - 1];
    if (ult && ult.role === m.role) ult.content += `\n\n${m.content}`;
    else coal.push({ ...m });
  }
  messages = coal;
  if (!messages.length) return NextResponse.json({ error: 'mensagem vazia' }, { status: 400 });

  if (!iaGeminiConfigurada()) {
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
    // Gemini é o único provedor (tier gratuito). Com ferramentas, a Faísca AGE:
    // cria Lenha, busca Cria e resume o dia — tudo como o membro logado (RLS).
    const reply = await conversarFaiscaComFerramentas(
      messages,
      ctx,
      FERRAMENTAS_FAISCA,
      (nome, args) => executarFerramentaFaisca(nome, args, membro),
    );
    return NextResponse.json({ reply: reply || 'Não consegui formular uma resposta agora — tenta de novo?' });
  } catch (e) {
    // Loga o erro cru pro servidor, mas devolve uma mensagem limpa pro chat
    // (nada de JSON técnico vazando pra tela).
    console.error('[faisca/chat]', e);
    return NextResponse.json({ reply: mensagemAmigavel(e), erro: true });
  }
}

// Traduz erros da API do Gemini em algo que a pessoa entende (e resolve).
function mensagemAmigavel(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (raw.includes('api key') || raw.includes('api_key') || raw.includes('permission') || raw.includes('401') || raw.includes('403')) {
    return 'Minha chave de IA parece inválida — confere a GOOGLE_GENERATIVE_AI_API_KEY nas variáveis da Vercel.';
  }
  if (raw.includes('quota') || raw.includes('rate') || raw.includes('429') || raw.includes('resource_exhausted') || raw.includes('overloaded')) {
    return 'Bati o limite gratuito do Gemini agora há pouco (mesmo tentando de novo). É por minuto/dia e reseta sozinho — espera ~1 minuto e manda de novo. Pra tirar o teto, dá pra ativar o pay-as-you-go do Gemini (bem barato, por uso).';
  }
  return 'Tive um problema ao pensar aqui agora. Tenta de novo daqui a pouco?';
}
