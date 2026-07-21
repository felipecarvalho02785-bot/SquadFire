import type { FunctionDeclaration } from '@google/generative-ai';
import { SISTEMA_FAISCA, sistemaBriefing, parseCampos, type BriefingCampos } from '@/lib/ia/gemini';

// Provedor de IA ALTERNATIVO (fallback grátis do Gemini): Groq roda Llama 3.3 70B
// pela API compatível com OpenAI, é rápido e tem limite gratuito bem mais folgado.
// Cobre só as tarefas de TEXTO (chat com ferramentas + estruturação de briefing);
// áudio e PDF continuam no Gemini (o Groq não lê esses). Sem GROQ_API_KEY, dorme.
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function chaveGroq(): string | undefined {
  return process.env.GROQ_API_KEY;
}

export function iaGroqConfigurada(): boolean {
  return !!chaveGroq();
}

interface GroqToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
interface GroqMsg { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: GroqToolCall[]; tool_call_id?: string }
interface GroqResp { choices?: { message?: { content: string | null; tool_calls?: GroqToolCall[] } }[] }

// POST único ao Groq, com timeout próprio (o fetch não tem) e erro estruturado
// (status preservado, pra o orquestrador saber se foi limite/transitório).
async function groqChat(body: Record<string, unknown>, timeoutMs = 22000): Promise<GroqResp> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chaveGroq()}` },
      body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.5, ...body }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw Object.assign(new Error(`Groq ${res.status}: ${txt.slice(0, 300)}`), { status: res.status });
    }
    return (await res.json()) as GroqResp;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw Object.assign(new Error('A Faísca (Groq) demorou demais.'), { timeout: true });
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Ferramentas do Gemini (FunctionDeclaration) → formato de tools da OpenAI/Groq.
// O `parameters` do Gemini já usa tipos JSON-Schema (string/object/...), então
// passa quase direto.
function paraToolsOpenAI(ferramentas: FunctionDeclaration[]) {
  return ferramentas.map((f) => ({
    type: 'function' as const,
    function: { name: f.name, description: f.description, parameters: (f.parameters as unknown) ?? { type: 'object', properties: {} } },
  }));
}

// Chat com function calling no Groq — mesmo laço do Gemini: a IA chama ferramentas,
// executamos (como o membro logado, RLS) e devolvemos, até ela formular a resposta.
export async function conversarFaiscaGroq(
  mensagens: { role: 'user' | 'assistant'; content: string }[],
  contexto: string,
  ferramentas: FunctionDeclaration[],
  executar: (nome: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<string> {
  if (!mensagens.length) return '';
  const tools = ferramentas.length ? paraToolsOpenAI(ferramentas) : undefined;
  const msgs: GroqMsg[] = [
    { role: 'system', content: `${SISTEMA_FAISCA}\n\nCONTEXTO ATUAL:\n${contexto}` },
    ...mensagens.map((m) => ({ role: m.role, content: m.content })),
  ];

  let agiu = false;
  for (let i = 0; i < 4; i++) {
    const res = await groqChat({ messages: msgs, ...(tools ? { tools, tool_choice: 'auto' } : {}) });
    const msg = res.choices?.[0]?.message;
    if (!msg) break;
    const calls = msg.tool_calls ?? [];
    if (!calls.length) return (msg.content ?? '').trim();

    msgs.push({ role: 'assistant', content: msg.content ?? '', tool_calls: calls });
    for (const c of calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch { args = {}; }
      let saida: unknown;
      try {
        saida = await executar(c.function.name, args);
        if ((saida as { ok?: boolean })?.ok !== false) agiu = true;
      } catch (e) {
        saida = { ok: false, erro: (e as Error).message ?? 'falhou' };
      }
      msgs.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(saida ?? {}) });
    }
  }
  // Agiu mas parou sem texto: não minta dizendo que não deu — confirma a ação.
  return agiu ? 'Feito! ✅' : '';
}

// Estruturação do briefing (6 campos, JSON) no Groq — mesmo prompt do Gemini.
export async function estruturarBriefingGroq(
  transcricao: string,
  contexto: { cliente: string; fase?: string | null },
): Promise<BriefingCampos> {
  const res = await groqChat({
    messages: [
      { role: 'system', content: sistemaBriefing(contexto) },
      { role: 'user', content: `Transcrição do áudio do briefing:\n\n${transcricao}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });
  return parseCampos(res.choices?.[0]?.message?.content ?? '');
}
