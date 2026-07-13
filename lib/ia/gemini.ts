import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini é o ÚNICO provedor de IA (tier gratuito, sem depender de crédito pago):
// ingestão (áudio→texto), chat da Faísca e estruturação de briefing.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function chave(): string {
  return (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) as string;
}

export function iaGeminiConfigurada(): boolean {
  return !!chave();
}

// Reexecuta a chamada quando o Gemini devolve limite de uso (429 /
// RESOURCE_EXHAUSTED) ou erro transitório (5xx), com backoff curto. Absorve os
// picos do tier gratuito sem jogar erro na cara do usuário.
async function comRetry<T>(fn: () => Promise<T>, tentativas = 3): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      const raw = (e instanceof Error ? e.message : String(e)).toLowerCase();
      const retryable = /429|quota|rate|resource_exhausted|exhaust|overload|unavailable|503|500|internal/.test(raw);
      if (!retryable || i === tentativas - 1) break;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1) + Math.floor(500 * (i + 1))));
    }
  }
  throw ultimo;
}

export function transcricaoConfigurada(): boolean {
  return iaGeminiConfigurada();
}

// ── briefing: tipos + parsing + system prompt (compartilhados) ──────────────
export interface BriefingCampos {
  c1_o_que_aconteceu: string;
  c2_satisfacao: string;
  c3_campanhas: string;
  c4_nosso_desempenho: string;
  c5_pontos_atencao: string;
  c6_proximos_passos: string;
}

const CAMPOS_KEYS: (keyof BriefingCampos)[] = [
  'c1_o_que_aconteceu',
  'c2_satisfacao',
  'c3_campanhas',
  'c4_nosso_desempenho',
  'c5_pontos_atencao',
  'c6_proximos_passos',
];

function sistemaBriefing(contexto: { cliente: string; fase?: string | null }): string {
  return (
    'Você é a Faísca, a IA do Squad 08 (E3 Digital). Monta o briefing semanal do ' +
    'cliente em português do Brasil, seguindo estritamente o modelo de 6 campos. ' +
    'Seja objetivo, factual e fiel à transcrição — não invente números nem fatos. ' +
    `Cliente (Cria): ${contexto.cliente}.` +
    (contexto.fase ? ` Fase atual da Forja: ${contexto.fase}.` : '') +
    '\n\nResponda APENAS com um objeto JSON válido com exatamente estas chaves ' +
    '(valores em string): c1_o_que_aconteceu, c2_satisfacao, c3_campanhas, ' +
    'c4_nosso_desempenho, c5_pontos_atencao, c6_proximos_passos. Sem comentários fora do JSON.'
  );
}

// Extrai o objeto JSON da resposta (tolera cercas ```json e texto ao redor).
function parseCampos(texto: string): BriefingCampos {
  let raw = texto.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  else {
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    if (a >= 0 && b > a) raw = raw.slice(a, b + 1);
  }
  const obj = JSON.parse(raw) as Partial<BriefingCampos>;
  const out = {} as BriefingCampos;
  for (const k of CAMPOS_KEYS) out[k] = (obj[k] ?? '').toString();
  return out;
}

// ── ingestão: áudio → transcrição (pt-BR) ───────────────────────────────────
export async function transcreverAudio(audio: Buffer, mimeType: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(chave());
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await comRetry(() => model.generateContent([
    { inlineData: { data: audio.toString('base64'), mimeType } },
    {
      text:
        'Transcreva este áudio em português do Brasil. ' +
        'Devolva apenas a transcrição, sem comentários nem formatação extra.',
    },
  ]));

  return result.response.text().trim();
}

// ── chat da Faísca (drawer) ─────────────────────────────────────────────────
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
  const result = await comRetry(() => model.generateContent({ contents }));
  return result.response.text().trim();
}

// ── estruturação do briefing (6 campos, JSON) ───────────────────────────────
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
  const result = await comRetry(() => model.generateContent(`Transcrição do áudio do briefing:\n\n${transcricao}`));
  return parseCampos(result.response.text());
}
