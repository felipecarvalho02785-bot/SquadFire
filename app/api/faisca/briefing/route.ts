import { NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server';
import { getCurrentMembro } from '@/lib/auth';
import { transcreverAudio, transcricaoConfigurada } from '@/lib/ia/gemini';
import { estruturarBriefingIA, iaChatConfigurada } from '@/lib/ia/faisca';
import { pushBriefing } from '@/integracao/clickup/push-briefing.js';
import { hojeBRT } from '@/lib/datas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Pipeline do briefing por áudio: (Gemini transcreve) → (Gemini estrutura os 6
// campos) → grava a `briefing`. Aceita { criaId, audioPath } (áudio no Storage)
// ou { criaId, transcript } (texto já pronto, pula a transcrição).
export async function POST(request: Request) {
  const membro = await getCurrentMembro();
  if (!membro) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  if (!iaChatConfigurada()) {
    return NextResponse.json(
      { error: 'IA não configurada (defina GEMINI_API_KEY ou GROQ_API_KEY)' },
      { status: 501 },
    );
  }

  let body: { criaId?: string; audioPath?: string; transcript?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'json inválido' }, { status: 400 });
  }
  const { criaId, audioPath, transcript } = body;
  if (!criaId) {
    return NextResponse.json({ error: 'criaId obrigatório' }, { status: 400 });
  }

  // contexto do cliente (nome + fase) para o prompt
  const supabase = await getSupabaseServer();
  const { data: cria } = await supabase
    .from('cria')
    .select('nome_cliente, clickup_semana, clickup_task_id')
    .eq('id', criaId)
    .maybeSingle();
  if (!cria) {
    return NextResponse.json({ error: 'cria não encontrada' }, { status: 404 });
  }

  // 1) obter a transcrição
  let transcricao = (transcript ?? '').trim();
  if (!transcricao) {
    if (!audioPath) {
      return NextResponse.json({ error: 'audioPath ou transcript obrigatório' }, { status: 400 });
    }
    // Guarda de caminho: nada de path traversal / caminho absoluto (o áudio é
    // baixado via service_role, que ignora RLS).
    if (audioPath.includes('..') || audioPath.startsWith('/')) {
      return NextResponse.json({ error: 'caminho de áudio inválido' }, { status: 400 });
    }
    if (!transcricaoConfigurada()) {
      return NextResponse.json(
        { error: 'transcrição não configurada (defina GOOGLE_GENERATIVE_AI_API_KEY)' },
        { status: 501 },
      );
    }
    try {
      const admin = getSupabaseAdmin();
      const { data: file, error } = await admin.storage.from('briefings').download(audioPath);
      if (error || !file) throw error ?? new Error('áudio não encontrado');
      const buffer = Buffer.from(await file.arrayBuffer());
      // Guarda de tamanho: áudio muito longo estoura os 60s da função (504) e o
      // usuário perde o trabalho. Limita e orienta a gravar em blocos.
      if (buffer.length > 15 * 1024 * 1024) {
        return NextResponse.json({ error: 'áudio muito grande (máx. ~15 MB). Grave a Roda em blocos menores.' }, { status: 413 });
      }
      transcricao = await transcreverAudio(buffer, file.type || 'audio/webm');
    } catch (e) {
      console.error('[faisca/briefing] transcrição', e);
      return NextResponse.json({ error: 'não consegui transcrever o áudio agora' }, { status: 502 });
    }
  }

  // 2) estruturar os 6 campos com a Faísca (Gemini)
  let campos;
  try {
    const ctx = {
      cliente: (cria as { nome_cliente: string }).nome_cliente,
      fase: (cria as { clickup_semana: number | null }).clickup_semana
        ? `Semana ${(cria as { clickup_semana: number }).clickup_semana}`
        : null,
    };
    campos = await estruturarBriefingIA(transcricao, ctx);
  } catch (e) {
    console.error('[faisca/briefing] estruturação', e);
    return NextResponse.json({ error: 'a Faísca não conseguiu estruturar o briefing agora' }, { status: 502 });
  }

  // 3) gravar a briefing (a publicação no ClickUp é um passo à parte)
  const semana = hojeBRT();
  const { data: inserida, error: insErr } = await supabase
    .from('briefing')
    .insert({
      cria_id: criaId,
      semana_referencia: semana,
      origem: audioPath ? 'audio' : 'manual',
      autor_id: membro.id,
      audio_url: audioPath ?? null,
      ...campos,
    })
    .select('id')
    .maybeSingle();

  if (insErr) {
    // devolve os campos mesmo se a gravação falhar (usuário não perde o trabalho)
    return NextResponse.json({ ok: false, campos, error: insErr.message }, { status: 200 });
  }

  const briefingId = (inserida as { id: string } | null)?.id ?? null;

  // 4) publicar como COMENTÁRIO na task-mestre do cliente no ClickUp. É o único
  //    fluxo de escrita CRM → ClickUp. Falha aqui não perde o briefing (já salvo).
  const clickupTaskId = (cria as { clickup_task_id: string | null }).clickup_task_id;
  let clickup: { enviado: boolean; erro?: string } = { enviado: false };
  if (briefingId && process.env.CLICKUP_API_TOKEN && clickupTaskId) {
    try {
      const { clickup_comment_id } = await pushBriefing(
        { clickup_task_id: clickupTaskId },
        { ...campos, semana_referencia: semana },
      );
      await getSupabaseAdmin()
        .from('briefing')
        .update({ enviado_clickup: true, clickup_task_id: clickupTaskId, clickup_comment_id })
        .eq('id', briefingId);
      clickup = { enviado: true };
    } catch (e) {
      console.error('[faisca/briefing] push ClickUp', e);
      clickup = { enviado: false, erro: 'não consegui publicar no ClickUp agora' };
    }
  }

  return NextResponse.json({ ok: true, campos, briefingId, clickup });
}
