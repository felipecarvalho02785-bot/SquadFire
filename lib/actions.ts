'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getCurrentMembro } from '@/lib/auth';

export type ActionResult = { ok: boolean; error?: string };

// Adicionar comentário à Cria (registro contínuo). Autor = membro logado;
// RLS exige que autor_id seja o próprio membro e o papel permita comentar.
export async function adicionarComentario(criaId: string, corpo: string): Promise<ActionResult> {
  const texto = corpo.trim();
  if (!texto) return { ok: false, error: 'comentário vazio' };
  const membro = await getCurrentMembro();
  if (!membro) return { ok: false, error: 'membro não identificado' };

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('comentario')
    .insert({ cria_id: criaId, autor_id: membro.id, corpo: texto });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  return { ok: true };
}

// Concluir / reabrir a própria Lenha. RLS garante a autorização (dono ou
// Projetos/Admin); aqui só disparamos o update e revalidamos a tela.
export async function toggleLenha(id: string, concluir: boolean): Promise<ActionResult> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('lenha')
    .update({
      status: concluir ? 'concluida' : 'pendente',
      concluida_em: concluir ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  revalidatePath('/meu-dia');
  revalidatePath('/tarefas');
  return { ok: true };
}

// Avançar a fase da Forja (checklist + gate de papel validados no banco).
export async function avancarFase(forjaId: string): Promise<ActionResult> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('avancar_fase', { p_forja_id: forjaId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  return { ok: true };
}
