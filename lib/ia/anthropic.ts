import Anthropic from '@anthropic-ai/sdk';

// Modelo configurável. Default: claude-sonnet-5 (dia a dia de escrita/raciocínio,
// conforme docs/camada-ia.md); use claude-opus-4-8 para os casos mais difíceis.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

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

export function iaConfigurada(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// System prompt do briefing — compartilhado entre provedores (Claude/Gemini).
export function sistemaBriefing(contexto: { cliente: string; fase?: string | null }): string {
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
export function parseCampos(texto: string): BriefingCampos {
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

// Conversa da Faísca (chat drawer). Recebe o histórico + um retrato real do
// estado do Squad e responde em pt-BR, no tom da marca (fogo/forja).
export async function conversarFaisca(
  mensagens: { role: 'user' | 'assistant'; content: string }[],
  contexto: string,
): Promise<string> {
  const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

  const system =
    'Você é a Faísca, a assistente de IA do Squad 08 da E3 Digital — uma agência ' +
    'que estrutura escritórios de advocacia. Vocabulário da casa: Cria = cliente, ' +
    'Forja = a Estruturação (projeto de 7 fases × 7 dias), Lenha = tarefa, ' +
    'Roda de Fogo = reunião semanal, Estopim = SLA. Responda SEMPRE em português ' +
    'do Brasil, de forma objetiva, prática e calorosa — sem enrolação. Use o ' +
    'CONTEXTO real abaixo para responder sobre o estado do squad; se algum dado ' +
    'não estiver no contexto, diga que não tem essa informação em vez de inventar. ' +
    'Não invente números, nomes ou prazos.\n\nCONTEXTO ATUAL:\n' + contexto;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: mensagens.map((m) => ({ role: m.role, content: m.content })),
  });

  const bloco = response.content.find((b) => b.type === 'text');
  return bloco && bloco.type === 'text' ? bloco.text.trim() : '';
}

// Estrutura a transcrição do áudio nos 6 campos do briefing semanal (pt-BR).
export async function estruturarBriefing(
  transcricao: string,
  contexto: { cliente: string; fase?: string | null },
): Promise<BriefingCampos> {
  const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: sistemaBriefing(contexto),
    messages: [
      {
        role: 'user',
        content: `Transcrição do áudio do briefing:\n\n${transcricao}`,
      },
    ],
  });

  const bloco = response.content.find((b) => b.type === 'text');
  const texto = bloco && bloco.type === 'text' ? bloco.text : '{}';
  return parseCampos(texto);
}
