import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini faz a ingestão (multimodal, barato): áudio → texto. Ver docs/camada-ia.md.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export function transcricaoConfigurada(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
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
