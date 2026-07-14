// Cliente fininho da Evolution API (WhatsApp) — só o envio de texto, que é o
// que os "disparos" do CRM precisam. Config 100% via env (nunca hardcoded).
// Assume Evolution API v2 (endpoint /message/sendText/{instance}, header apikey).

export function whatsappConfigurado(): boolean {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
}

// Envia uma mensagem de texto. `destino` = número com DDI (ex.: 5511999998888)
// ou o JID de um grupo (…@g.us). Retorna erro amigável, nunca lança.
export async function enviarWhatsapp(destino: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const base = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  const inst = process.env.EVOLUTION_INSTANCE;
  if (!base || !key || !inst) return { ok: false, error: 'WhatsApp (Evolution API) não configurado' };

  let number = destino.includes('@') ? destino : destino.replace(/\D/g, '');
  if (!number) return { ok: false, error: 'destino sem número válido' };
  // Sem DDI (número BR de 10–11 dígitos: DDD + número) → assume Brasil (55),
  // senão a Evolution manda pro destinatário errado.
  if (!destino.includes('@') && (number.length === 10 || number.length === 11)) number = `55${number}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/message/sendText/${inst}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: key },
      body: JSON.stringify({ number, text: texto }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      return { ok: false, error: `Evolution recusou (${res.status})${corpo ? `: ${corpo.slice(0, 140)}` : ''}` };
    }
    return { ok: true };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { ok: false, error: 'WhatsApp demorou demais para responder' };
    return { ok: false, error: 'não consegui falar com o WhatsApp agora' };
  } finally {
    clearTimeout(timer);
  }
}
