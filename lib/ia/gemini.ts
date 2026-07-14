import { GoogleGenerativeAI, type FunctionDeclaration, type Part } from '@google/generative-ai';

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

// ── ingestão de documentos (PDF): contrato + diagnóstico ────────────────────
// Lê o PDF do contrato e extrai o essencial (mensalidade, início, resumo).
export async function extrairContratoGemini(pdf: Buffer): Promise<{ valor: number | null; dataInicio: string | null; resumo: string }> {
  const genAI = new GoogleGenerativeAI(chave());
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { responseMimeType: 'application/json' } });
  const prompt =
    'Você recebe o PDF de um contrato de prestação de serviço (agência de marketing → escritório de advocacia). ' +
    'Extraia e responda APENAS um JSON: {"valor_mensal": número ou null (a mensalidade/fee em reais, só o número, sem R$), ' +
    '"data_inicio": "AAAA-MM-DD" ou null (início da vigência), "resumo": "2-3 frases com o essencial: objeto, prazo e valores"}. ' +
    'Se não achar um campo, use null. Não invente.';
  const result = await comRetry(() => model.generateContent([{ inlineData: { data: pdf.toString('base64'), mimeType: 'application/pdf' } }, { text: prompt }]));
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(result.response.text());
  } catch {
    const raw = result.response.text();
    const a = raw.indexOf('{'); const b = raw.lastIndexOf('}');
    if (a >= 0 && b > a) { try { obj = JSON.parse(raw.slice(a, b + 1)); } catch { /* deixa vazio */ } }
  }
  const bruto = obj.valor_mensal;
  const num = typeof bruto === 'number' ? bruto : bruto ? Number(String(bruto).replace(/[^\d.,]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) : NaN;
  const valor = isFinite(num) && num > 0 ? num : null;
  const di = obj.data_inicio;
  const dataInicio = typeof di === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(di) ? di : null;
  return { valor, dataInicio, resumo: String(obj.resumo ?? '').trim() };
}

// Extrai dados do cliente de textos livres (descrição + comentários do ClickUp,
// ex.: o relatório de onboarding). Devolve só o que achar; null quando não tem.
export async function extrairDadosClienteGemini(texto: string): Promise<{ email: string | null; telefone: string | null; area_atuacao: string | null; closer: string | null }> {
  const vazio = { email: null, telefone: null, area_atuacao: null, closer: null };
  const t = (texto ?? '').trim();
  if (!t) return vazio;
  const genAI = new GoogleGenerativeAI(chave());
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { responseMimeType: 'application/json' } });
  const prompt =
    'Você recebe textos (descrição + comentários) sobre um cliente (escritório de advocacia) de uma agência de marketing. ' +
    'Extraia e responda APENAS um JSON: {"email": string|null, "telefone": string|null (com DDD/DDI se houver), ' +
    '"area_atuacao": string|null (nicho/área de atuação jurídica, ex.: "Direito Previdenciário"), "closer": string|null (nome do closer/vendedor)}. ' +
    'Use null quando não encontrar. NÃO invente.\n\nTEXTO:\n' + t.slice(0, 12000);
  const result = await comRetry(() => model.generateContent(prompt));
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(result.response.text());
  } catch {
    const raw = result.response.text();
    const a = raw.indexOf('{'); const b = raw.lastIndexOf('}');
    if (a >= 0 && b > a) { try { obj = JSON.parse(raw.slice(a, b + 1)); } catch { /* vazio */ } }
  }
  const str = (v: unknown) => { const s = String(v ?? '').trim(); return s && s.toLowerCase() !== 'null' && s.length > 1 ? s : null; };
  return { email: str(obj.email), telefone: str(obj.telefone), area_atuacao: str(obj.area_atuacao), closer: str(obj.closer) };
}

// Lê o PDF do Diagnóstico 360 e devolve um resumo objetivo pra squad/IA.
export async function resumirDiagnosticoGemini(pdf: Buffer): Promise<string> {
  const genAI = new GoogleGenerativeAI(chave());
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const prompt =
    'Você recebe o PDF do Diagnóstico 360 de um cliente (escritório de advocacia), feito pela agência. ' +
    'Faça um resumo objetivo em português do Brasil (5 a 8 linhas) com o que a squad precisa saber pra atender bem: ' +
    'área de atuação, principais dores/gargalos, metas e pontos de atenção. Direto ao ponto, sem enrolação e sem inventar.';
  const result = await comRetry(() => model.generateContent([{ inlineData: { data: pdf.toString('base64'), mimeType: 'application/pdf' } }, { text: prompt }]));
  return result.response.text().trim();
}

// ── chat da Faísca COM ferramentas (function calling) ───────────────────────
const SISTEMA_FAISCA =
  'Você é a Faísca, a assistente de IA do Squad 08 da E3 Digital — uma agência que ' +
  'estrutura escritórios de advocacia. Vocabulário da casa: Cria = cliente, Forja = a ' +
  'Estruturação (projeto de 7 fases × 7 dias), Lenha = tarefa, Roda de Fogo = reunião ' +
  'semanal, Estopim = SLA. Responda SEMPRE em português do Brasil, objetiva, prática e ' +
  'calorosa.\n\nVocê PODE AGIR usando as ferramentas: criar Lenhas (tarefas), buscar ' +
  'Crias e resumir o dia. Quando o usuário PEDIR uma ação (ex.: "cria uma tarefa", ' +
  '"quem é o cliente X", "como está meu dia"), CHAME a ferramenta certa em vez de só ' +
  'responder — depois confirme em uma frase o que você fez. Não invente dados: use o ' +
  'CONTEXTO e o resultado das ferramentas; se faltar informação, diga que não tem.';

// Conversa com function calling: a IA pode chamar ferramentas, que executamos e
// devolvemos, até ela formular a resposta final. `executar` roda no servidor
// (como o membro logado), então a IA respeita RLS e as regras de negócio.
export async function conversarFaiscaComFerramentas(
  mensagens: { role: 'user' | 'assistant'; content: string }[],
  contexto: string,
  ferramentas: FunctionDeclaration[],
  executar: (nome: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<string> {
  if (!mensagens.length) return '';
  const genAI = new GoogleGenerativeAI(chave());
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: `${SISTEMA_FAISCA}\n\nCONTEXTO ATUAL:\n${contexto}`,
    tools: ferramentas.length ? [{ functionDeclarations: ferramentas }] : undefined,
  });

  const history = mensagens.slice(0, -1).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const ultima = mensagens[mensagens.length - 1].content;
  const chat = model.startChat({ history });

  let result = await comRetry(() => chat.sendMessage(ultima));
  // Laço de ferramentas (teto de 4 rodadas por segurança).
  for (let i = 0; i < 4; i++) {
    const calls = result.response.functionCalls?.() ?? [];
    if (!calls.length) break;
    const respostas: Part[] = [];
    for (const c of calls) {
      let saida: unknown;
      try {
        saida = await executar(c.name, (c.args ?? {}) as Record<string, unknown>);
      } catch (e) {
        saida = { ok: false, erro: (e as Error).message ?? 'falhou' };
      }
      respostas.push({ functionResponse: { name: c.name, response: (saida ?? {}) as object } });
    }
    result = await comRetry(() => chat.sendMessage(respostas));
  }
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
