import { NextResponse } from 'next/server';
import { createWebhook, listWebhooks } from '@/integracao/clickup/client.js';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Eventos da lista-mestre que refletimos no CRM (mesma lista do webhook handler).
// taskCommentPosted traz os comentários do ClickUp pro CRM (ClickUp → CRM).
const EVENTOS = ['taskCreated', 'taskUpdated', 'taskMoved', 'taskStatusUpdated', 'taskDeleted', 'taskCommentPosted'];

// Autoriza: admin logado (botão da Forjaria) OU Bearer CRON_SECRET (curl/cron).
async function autorizado(request: Request): Promise<boolean> {
  const membro = await getCurrentMembro();
  if (membro?.is_admin) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem segredo configurado (dev)
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// POST — registra o webhook do ClickUp apontando pra /api/clickup/webhook e
// guarda o secret no banco (nada de env manual nem redeploy). Idempotente-ish:
// se já houver um webhook nosso, apaga e recria pra ficar com um só.
export async function POST(request: Request) {
  if (!(await autorizado(request))) return NextResponse.json({ ok: false, error: 'não autorizado' }, { status: 401 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ ok: false, error: 'CLICKUP_API_TOKEN ausente' }, { status: 400 });

  const origin = new URL(request.url).origin;
  const endpoint = `${origin}/api/clickup/webhook`;
  try {
    const criado = (await createWebhook(endpoint, EVENTOS)) as { id?: string; webhook?: { id?: string; secret?: string }; secret?: string };
    const webhookId = criado?.webhook?.id ?? criado?.id ?? null;
    const webhookSecret = criado?.webhook?.secret ?? criado?.secret ?? null;

    await getSupabaseAdmin()
      .from('integracao_clickup')
      .upsert({ id: true, webhook_id: webhookId, webhook_secret: webhookSecret, atualizado_em: new Date().toISOString() }, { onConflict: 'id' });

    return NextResponse.json({ ok: true, endpoint, webhook_id: webhookId, tempo_real: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 502 });
  }
}

// GET — lista os webhooks já registrados (diagnóstico).
export async function GET(request: Request) {
  if (!(await autorizado(request))) return NextResponse.json({ ok: false, error: 'não autorizado' }, { status: 401 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ ok: false, error: 'CLICKUP_API_TOKEN ausente' }, { status: 400 });
  try {
    const data = (await listWebhooks()) as { webhooks?: unknown[] };
    return NextResponse.json({ ok: true, webhooks: data?.webhooks ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 502 });
  }
}
