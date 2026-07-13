import { NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server';
import { getCurrentMembro } from '@/lib/auth';
import { estruturarBriefing, iaConfigurada } from '@/lib/ia/anthropic';
import { estruturarBriefingGemini, iaGeminiConfigurada, transcreverAudio, transcricaoConfigurada } from '@/lib/ia/gemini';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Pipeline do briefing por áudio: (Gemini transcreve) → (Claude estrutura os 6
// campos) → grava a `briefing`. Aceita { criaId, audioPath } (áudio no Storage)
// ou { criaId, transcript } (texto já pronto, pula o Gemini).
export async function POST(request: Request) {
  const membro = await getCurrentMembro();
  if (!membro) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  if (!iaGeminiConfigurada() && !iaConfigurada()) {
    return NextResponse.json(
      { error: 'IA não configurada (defina GOOGLE_GENERATIVE_AI_API_KEY)' },
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
    .select('nome_cliente, clickup_semana')
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
      transcricao = await transcreverAudio(buffer, file.type || 'audio/webm');
    } catch (e) {
      return NextResponse.json({ error: `falha na transcrição: ${String(e)}` }, { status: 502 });
    }
  }

  // 2) estruturar os 6 campos com a Faísca (Gemini primário; Claude fallback)
  let campos;
  try {
    const ctx = {
      cliente: (cria as { nome_cliente: string }).nome_cliente,
      fase: (cria as { clickup_semana: number | null }).clickup_semana
        ? `Semana ${(cria as { clickup_semana: number }).clickup_semana}`
        : null,
    };
    campos = iaGeminiConfigurada()
      ? await estruturarBriefingGemini(transcricao, ctx)
      : await estruturarBriefing(transcricao, ctx);
  } catch (e) {
    return NextResponse.json({ error: `falha na estruturação: ${String(e)}` }, { status: 502 });
  }

  // 3) gravar a briefing (a publicação no ClickUp é um passo à parte)
  const semana = new Date().toISOString().slice(0, 10);
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

  return NextResponse.json({ ok: true, campos, briefingId: (inserida as { id: string } | null)?.id });
}
