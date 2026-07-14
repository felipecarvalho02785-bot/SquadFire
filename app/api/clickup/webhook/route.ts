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

  // Secret do webhook: preferimos o guardado no banco (setado pelo botão
  // "Ativar tempo real"); se não houver, o handler cai na env.
  let secret: string | undefined;
  try {
    const { data } = await getSupabaseAdmin().from('integracao_clickup').select('webhook_secret').eq('id', true).maybeSingle();
    secret = (data as { webhook_secret: string | null } | null)?.webhook_secret ?? undefined;
  } catch {
    /* sem tabela/serviço — usa a env */
  }

  const result = await handleWebhook({ rawBody, signature, payload, secret });

  // Comentário do ClickUp → comentário no CRM (com anti-eco pelo id).
  if (result.action === 'comment' && result.comment && result.clickup_task_id) {
    const r = await importarComentario(result.clickup_task_id, result.comment);
    return NextResponse.json({ ok: r.ok, action: 'comment', reason: r.reason ?? null }, { status: r.status });
  }

  if (result.action === 'upsert' && result.cria) {
    const supabase = getSupabaseAdmin();
    const c = result.cria;
    const patch: Record<string, unknown> = {
      clickup_task_id: c.clickup_task_id,
      nome_cliente: c.nome_cliente,
      clickup_squad: c.clickup_squad,
      clickup_semana: c.clickup_semana == null ? null : Math.min(7, Math.max(1, c.clickup_semana)),
      status: c.status,
      sincronizado_em: new Date().toISOString(),
    };
    for (const k of ['email', 'telefone_whatsapp', 'area_atuacao', 'closer'] as const) {
      if (c.dados?.[k]) patch[k] = c.dados[k];
    }
    const { data: up, error } = await supabase.from('cria').upsert(patch, { onConflict: 'clickup_task_id' }).select('id').maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    }
    const criaId = (up as { id: string } | null)?.id;
    if (criaId) {
      // "Data inicial" → início da Forja (cascateia); "Semana" → fase atual.
      if (c.data_inicio) await supabase.rpc('definir_inicio_forja_sync', { p_cria_id: criaId, p_data: c.data_inicio });
      if (c.clickup_semana) await supabase.rpc('definir_fase_forja_sync', { p_cria_id: criaId, p_semana: c.clickup_semana });
    }
  }

  return NextResponse.json(
    { ok: result.ok, action: result.action ?? null, reason: result.reason ?? null },
    { status: result.status ?? 200 },
  );
}

// Importa um comentário do ClickUp como comentário do CRM na Cria dona da task.
// Anti-eco: se já existe um comentário com esse clickup_comment_id (inclusive os
// que o próprio CRM enviou), ignora. Autor = membro pelo e-mail; se o autor não
// estiver na allowlist, cai num admin e o nome dele vai no corpo pra não perder.
type ComentarioCU = { id: string; texto: string; autor_email: string | null; autor_nome: string };

async function importarComentario(taskId: string, c: ComentarioCU): Promise<{ ok: boolean; status: number; reason?: string }> {
  const supabase = getSupabaseAdmin();
  if (!c.texto) return { ok: true, status: 200, reason: 'comentário vazio' };

  if (c.id) {
    // Anti-eco: comentário nosso já importado OU eco de um briefing que enviamos
    // (o id fica em briefing.clickup_comment_id) — nos dois casos, ignora.
    const [{ data: existente }, { data: exBrief }] = await Promise.all([
      supabase.from('comentario').select('id').eq('clickup_comment_id', c.id).maybeSingle(),
      supabase.from('briefing').select('id').eq('clickup_comment_id', c.id).maybeSingle(),
    ]);
    if (existente || exBrief) return { ok: true, status: 200, reason: 'já importado (anti-eco)' };
  }

  const { data: cria } = await supabase.from('cria').select('id').eq('clickup_task_id', taskId).maybeSingle();
  if (!cria) return { ok: true, status: 202, reason: 'task não é Cria' };

  let autorId: string | null = null;
  if (c.autor_email) {
    const { data: m } = await supabase.from('membro').select('id').eq('email', c.autor_email).maybeSingle();
    autorId = (m as { id: string } | null)?.id ?? null;
  }
  let corpo = c.texto;
  if (!autorId) {
    const { data: adm } = await supabase.from('membro').select('id').eq('ativo', true).order('is_admin', { ascending: false }).limit(1).maybeSingle();
    autorId = (adm as { id: string } | null)?.id ?? null;
    corpo = `${c.autor_nome}: ${c.texto}`; // preserva quem escreveu no ClickUp
  }
  if (!autorId) return { ok: false, status: 200, reason: 'sem membro pra atribuir' };

  const { error } = await supabase.from('comentario').insert({
    cria_id: (cria as { id: string }).id,
    autor_id: autorId,
    corpo,
    origem: 'clickup',
    clickup_comment_id: c.id || null,
  });
  if (error) return { ok: false, status: 500, reason: error.message };
  return { ok: true, status: 200 };
}
