import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { handleWebhook } from '@/integracao/clickup/webhook.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Webhook do ClickUp: reflete em quase-tempo-real mudanças na lista-mestre.
// Verifica HMAC (X-Signature) e aplica a ação no banco (service_role).
// Só `upsert` mexe nos dados; delete/unlink são reconhecidos sem apagar a Cria
// (o doc manda não apagar — o status reflete via sync, não destrutivo aqui).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-signature');

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: 'json inválido' }, { status: 400 });
  }

  const result = await handleWebhook({ rawBody, signature, payload });

  if (result.action === 'upsert' && result.cria) {
    const supabase = getSupabaseAdmin();
    const c = result.cria;
    const { error } = await supabase.from('cria').upsert(
      {
        clickup_task_id: c.clickup_task_id,
        nome_cliente: c.nome_cliente,
        clickup_squad: c.clickup_squad,
        clickup_semana: c.clickup_semana,
        status: c.status,
        sincronizado_em: new Date().toISOString(),
      },
      { onConflict: 'clickup_task_id' },
    );
    if (error) {
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { ok: result.ok, action: result.action ?? null, reason: result.reason ?? null },
    { status: result.status ?? 200 },
  );
}
