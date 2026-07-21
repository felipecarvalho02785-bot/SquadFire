import type { FunctionDeclaration } from '@google/generative-ai';
import {
  conversarFaiscaComFerramentas,
  estruturarBriefingGemini,
  iaGeminiConfigurada,
  type BriefingCampos,
} from '@/lib/ia/gemini';
import { conversarFaiscaGroq, estruturarBriefingGroq, iaGroqConfigurada } from '@/lib/ia/groq';

// ── Orquestrador de IA da Faísca (Gemini com fallback pro Groq) ──────────────
// O tier gratuito do Gemini tem teto por minuto/dia; quando estoura, caímos pro
// Groq (grátis, limite mais folgado) pras tarefas de TEXTO. Se nenhum dos dois
// estiver configurado, os chamadores mostram a orientação de "IA não conectada".

export function iaChatConfigurada(): boolean {
  return iaGeminiConfigurada() || iaGroqConfigurada();
}

// Chat com ferramentas + fallback SEGURO: tenta o Gemini; se ele falhar ANTES de
// executar qualquer ferramenta, cai pro Groq. Se o Gemini já AGIU (ex.: criou uma
// Lenha) e só então falhou, NÃO cai pro Groq — repetir re-executaria a ação e
// duplicaria. Nesse caso propaga o erro (vira a mensagem amigável no chat).
export async function conversarFaiscaIA(
  mensagens: { role: 'user' | 'assistant'; content: string }[],
  contexto: string,
  ferramentas: FunctionDeclaration[],
  executar: (nome: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<string> {
  if (iaGeminiConfigurada()) {
    let rodouFerramenta = false;
    const exec = async (nome: string, args: Record<string, unknown>) => {
      rodouFerramenta = true;
      return executar(nome, args);
    };
    try {
      return await conversarFaiscaComFerramentas(mensagens, contexto, ferramentas, exec);
    } catch (e) {
      if (rodouFerramenta || !iaGroqConfigurada()) throw e;
      console.warn('[faisca] Gemini falhou antes de agir — caindo pro Groq:', (e as Error)?.message);
    }
  }
  if (iaGroqConfigurada()) {
    return conversarFaiscaGroq(mensagens, contexto, ferramentas, executar);
  }
  throw new Error('nenhuma IA configurada');
}

// Estruturação de briefing (texto → 6 campos JSON) + fallback. Sem ferramentas,
// então cair pro Groq em qualquer erro do Gemini é seguro (nada re-executa).
export async function estruturarBriefingIA(
  transcricao: string,
  contexto: { cliente: string; fase?: string | null },
): Promise<BriefingCampos> {
  if (iaGeminiConfigurada()) {
    try {
      return await estruturarBriefingGemini(transcricao, contexto);
    } catch (e) {
      if (!iaGroqConfigurada()) throw e;
      console.warn('[faisca] briefing Gemini falhou — caindo pro Groq:', (e as Error)?.message);
    }
  }
  if (iaGroqConfigurada()) {
    return estruturarBriefingGroq(transcricao, contexto);
  }
  throw new Error('nenhuma IA configurada');
}
