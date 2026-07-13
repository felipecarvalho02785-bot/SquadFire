import { NextResponse } from 'next/server';
import { createWebhook, listWebhooks } from '@/integracao/clickup/client.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Eventos da lista-mestre que refletimos no CRM (mesma lista do webhook handler).
const EVENTOS = ['taskCreated', 'taskUpdated', 'taskMoved', 'taskStatusUpdated', 'taskDeleted'];

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem segredo configurado, não trava (dev)
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// POST — registra (uma vez) o webhook do ClickUp apontando pra /api/clickup/webhook.
// Protegido por CRON_SECRET. Depois de rodar, copie o `secret` retornado pra a
// env CLICKUP_WEBHOOK_SECRET na Vercel e faça redeploy — aí o ClickUp → CRM
// passa a valer em tempo real.
export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ error: 'CLICKUP_API_TOKEN ausente' }, { status: 400 });

  const origin = new URL(request.url).origin;
  const endpoint = `${origin}/api/clickup/webhook`;
  try {
    const criado = (await createWebhook(endpoint, EVENTOS)) as { id?: string; webhook?: { id?: string; secret?: string }; secret?: string };
    const webhookSecret = criado?.webhook?.secret ?? criado?.secret ?? null;
    return NextResponse.json({
      ok: true,
      endpoint,
      webhook_id: criado?.webhook?.id ?? criado?.id ?? null,
      secret: webhookSecret,
      instrucao: 'Copie "secret" para a env CLICKUP_WEBHOOK_SECRET na Vercel e faça redeploy.',
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
  }
}

// GET — lista os webhooks já registrados (diagnóstico).
export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ error: 'CLICKUP_API_TOKEN ausente' }, { status: 400 });
  try {
    const data = (await listWebhooks()) as { webhooks?: unknown[] };
    return NextResponse.json({ ok: true, webhooks: data?.webhooks ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
  }
}
