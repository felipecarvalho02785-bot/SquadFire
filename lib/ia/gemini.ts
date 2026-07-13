import { GoogleGenerativeAI } from '@google/generative-ai';
import { type BriefingCampos, parseCampos, sistemaBriefing } from './anthropic';

// Gemini é o provedor primário de IA (tier gratuito): ingestão (áudio→texto),
// chat da Faísca e estruturação de briefing. Ver docs/camada-ia.md.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function chave(): string {
  return (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) as string;
}

export function iaGeminiConfigurada(): boolean {
  return !!chave();
}

export function transcricaoConfigurada(): boolean {
  return iaGeminiConfigurada();
}

// Chat da Faísca via Gemini. Recebe histórico (user/assistant) + contexto real.
export async function conversarFaiscaGemini(
  mensagens: { role: 'user' | 'assistant'; content: string }[],
  contexto: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(chave());
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction:
      'Você é a Faísca, a assistente de IA do Squad 08 da E3 Digital — uma agência ' +
      'que estrutura escritórios de advocacia. Vocabulário da casa: Cria = cliente, ' +
      'Forja = a Estruturação (projeto de 7 fases × 7 dias), Lenha = tarefa, ' +
      'Roda de Fogo = reunião semanal, Estopim = SLA. Responda SEMPRE em português ' +
      'do Brasil, objetiva, prática e calorosa. Use o CONTEXTO real abaixo; se um ' +
      'dado não estiver nele, diga que não tem essa informação em vez de inventar. ' +
      'Não invente números, nomes ou prazos.\n\nCONTEXTO ATUAL:\n' + contexto,
  });
  const contents = mensagens.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const result = await model.generateContent({ contents });
  return result.response.text().trim();
}

// Estrutura a transcrição nos 6 campos do briefing via Gemini (JSON mode).
export async function estruturarBriefingGemini(
  transcricao: string,
  contexto: { cliente: string; fase?: string | null },
): Promise<BriefingCampos> {
  const genAI = new GoogleGenerativeAI(chave());
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: sistemaBriefing(contexto),
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(`Transcrição do áudio do briefing:\n\n${transcricao}`);
  return parseCampos(result.response.text());
}

// Transcreve o áudio do briefing em pt-BR. Recebe os bytes + o mime type.
export async function transcreverAudio(audio: Buffer, mimeType: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY as string);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent([
    { inlineData: { data: audio.toString('base64'), mimeType } },
    {
      text:
        'Transcreva este áudio em português do Brasil. ' +
        'Devolva apenas a transcrição, sem comentários nem formatação extra.',
    },
  ]);

  return result.response.text().trim();
}
