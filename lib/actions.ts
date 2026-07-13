'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getCurrentMembro } from '@/lib/auth';
import type { PrioridadeLenha } from '@/lib/types/database';

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

// Criar uma Lenha avulsa ("tarefa do dia") e — opcionalmente — delegá-la a
// outro membro da Brigada. Sem responsável → fica com quem criou.
// RLS: avulsa (sem fase) exige apenas app.is_membro() no INSERT.
export async function criarTarefa(input: {
  titulo: string;
  prazo?: string | null;
  responsavelId?: string | null;
  prioridade?: PrioridadeLenha;
}): Promise<ActionResult> {
  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: 'informe um título' };
  const membro = await getCurrentMembro();
  if (!membro) return { ok: false, error: 'membro não identificado' };

  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('lenha').insert({
    tipo: 'avulsa',
    titulo,
    prazo: input.prazo || null,
    responsavel_id: input.responsavelId || membro.id,
    prioridade: input.prioridade ?? 'media',
    data_referencia: new Date().toISOString().slice(0, 10),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/tarefas');
  revalidatePath('/meu-dia');
  return { ok: true };
}

// Delegar (reatribuir) uma Lenha já existente a outro membro.
// RLS de UPDATE: só o responsável atual, Projetos ou Admin conseguem.
export async function delegarTarefa(id: string, responsavelId: string): Promise<ActionResult> {
  if (!responsavelId) return { ok: false, error: 'escolha um responsável' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('lenha').update({ responsavel_id: responsavelId }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/tarefas');
  revalidatePath('/meu-dia');
  return { ok: true };
}

// Editar o investimento em mídia da Cria (verba de campanha). RLS: Contas,
// Tráfego ou Admin. Valor null = "a definir".
export async function atualizarInvestimento(criaId: string, valor: number | null): Promise<ActionResult> {
  const v = valor != null && (!isFinite(valor) || valor < 0) ? null : valor;
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('cria').update({ investimento_midia: v }).eq('id', criaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  revalidatePath('/crias');
  return { ok: true };
}

// Abrir um gargalo na Cria. RLS: Contas/Projetos/Admin.
export async function criarGargalo(criaId: string, descricao: string): Promise<ActionResult> {
  const d = descricao.trim();
  if (!d) return { ok: false, error: 'descreva o gargalo' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('gargalo').insert({ cria_id: criaId, descricao: d });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  return { ok: true };
}

// Mudar o status de um gargalo (aberto → em_resolucao → resolvido).
export async function atualizarStatusGargalo(id: string, status: 'aberto' | 'em_resolucao' | 'resolvido'): Promise<ActionResult> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('gargalo').update({ status }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
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
