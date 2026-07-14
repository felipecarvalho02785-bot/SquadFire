import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTaskComments, baixarAnexoUrl } from '@/integracao/clickup/client.js';
import { resumirDiagnosticoGemini, iaGeminiConfigurada } from '@/lib/ia/gemini';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type Anexo = { url: string; nome: string };
type Bloco = { attachment?: { extension?: string; mimetype?: string; title?: string; url?: string } };
type Comentario = { comment?: Bloco[] };

// Acha o PDF do Diagnóstico nos comentários: primeiro por nome (diagnóstico/360),
// senão qualquer PDF anexado.
function acharDiagnostico(comments: Comentario[]): Anexo | null {
  const pdfs: Anexo[] = [];
  for (const cm of comments ?? []) {
    for (const b of cm.comment ?? []) {
      const a = b.attachment;
      if (a?.url && (a.extension === 'pdf' || a.mimetype === 'application/pdf')) {
        pdfs.push({ url: a.url, nome: a.title ?? 'diagnostico.pdf' });
      }
    }
  }
  return pdfs.find((p) => /diagn|360/i.test(p.nome)) ?? pdfs[0] ?? null;
}

// Puxa o PDF do Diagnóstico 360 do comentário da task do cliente no ClickUp,
// anexa no CRM (Storage) e a Faísca resume. Body: { criaId }.
export async function POST(request: Request) {
  const membro = await getCurrentMembro();
  if (!membro) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ ok: false, error: 'ClickUp não configurado' }, { status: 400 });

  let body: { criaId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'json inválido' }, { status: 400 }); }
  if (!body.criaId) return NextResponse.json({ ok: false, error: 'criaId obrigatório' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: cria } = await admin.from('cria').select('clickup_task_id').eq('id', body.criaId).maybeSingle();
  const taskId = (cria as { clickup_task_id: string | null } | null)?.clickup_task_id;
  if (!taskId) return NextResponse.json({ ok: false, error: 'esta Cria não tem task no ClickUp' });

  let anexo: Anexo | null;
  try {
    const cm = (await getTaskComments(taskId)) as { comments?: Comentario[] };
    anexo = acharDiagnostico(cm.comments ?? []);
  } catch {
    return NextResponse.json({ ok: false, error: 'não consegui ler os comentários do ClickUp' }, { status: 502 });
  }
  if (!anexo) return NextResponse.json({ ok: false, error: 'nenhum PDF de diagnóstico encontrado nos comentários do ClickUp' });

  let buffer: Buffer;
  try { buffer = await baixarAnexoUrl(anexo.url); } catch { return NextResponse.json({ ok: false, error: 'não consegui baixar o PDF do ClickUp' }, { status: 502 }); }

  const path = `${body.criaId}/diagnostico-clickup-${Date.now()}.pdf`;
  const up = await admin.storage.from('entregaveis').upload(path, buffer, { contentType: 'application/pdf', upsert: true });
  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  await admin.from('cria').update({ diagnostico_path: path, diagnostico_nome: anexo.nome }).eq('id', body.criaId);

  let resumido = false;
  if (iaGeminiConfigurada()) {
    try {
      const resumo = await resumirDiagnosticoGemini(buffer);
      await admin.from('cria').update({ diagnostico_resumo: resumo }).eq('id', body.criaId);
      resumido = true;
    } catch { /* fica sem resumo */ }
  }
  return NextResponse.json({ ok: true, nome: anexo.nome, resumido });
}
