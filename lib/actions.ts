'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server';
import { getCurrentMembro } from '@/lib/auth';
import { enviarWhatsapp } from '@/lib/whatsapp/evolution';
import { recalcularRisco } from '@/lib/clickup/espelho';
import { hojeBRT } from '@/lib/datas';
import type { Papel, PrioridadeLenha } from '@/lib/types/database';

export type ActionResult = { ok: boolean; error?: string };

// Adicionar comentário à Cria (registro contínuo). Autor = membro logado;
// RLS exige que autor_id seja o próprio membro e o papel permita comentar.
export async function adicionarComentario(criaId: string, corpo: string): Promise<ActionResult> {
  const texto = corpo.trim();
  if (!texto) return { ok: false, error: 'comentário vazio' };
  const membro = await getCurrentMembro();
  if (!membro) return { ok: false, error: 'membro não identificado' };

  const supabase = await getSupabaseServer();
  const { data: inserido, error } = await supabase
    .from('comentario')
    .insert({ cria_id: criaId, autor_id: membro.id, corpo: texto })
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');

  // Espelha no ClickUp (CRM → ClickUp): comentário do sistema vira comentário
  // na task-mestre do cliente. Best-effort — falha aqui não perde o comentário.
  const comentarioId = (inserido as { id: string } | null)?.id;
  if (comentarioId && process.env.CLICKUP_API_TOKEN) {
    try {
      const { data: cria } = await supabase.from('cria').select('clickup_task_id').eq('id', criaId).maybeSingle();
      const taskId = (cria as { clickup_task_id: string | null } | null)?.clickup_task_id;
      if (taskId) {
        const { createTaskComment } = await import('@/integracao/clickup/client.js');
        const res = await createTaskComment(taskId, `💬 ${membro.nome}: ${texto}`);
        await getSupabaseAdmin().from('comentario').update({ clickup_comment_id: res?.id ?? null }).eq('id', comentarioId);
      }
    } catch (e) {
      console.error('[comentario] push ClickUp', e);
    }
  }
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
    data_referencia: hojeBRT(),
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

// Vincular o PDF do Diagnóstico 360 à Cria (o arquivo já foi subido pro
// Storage; aqui só gravamos o caminho + nome). RLS de cria: Contas/Admin.
export async function vincularDiagnostico(criaId: string, path: string, nome: string): Promise<ActionResult> {
  if (!path) return { ok: false, error: 'arquivo ausente' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('cria').update({ diagnostico_path: path, diagnostico_nome: nome || null }).eq('id', criaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  return { ok: true };
}

// Vincular o PDF do Contrato à Cria (registra uma linha em `contrato`; a mais
// recente é a que aparece). RLS de contrato: Contas/Admin.
export async function vincularContrato(criaId: string, path: string): Promise<ActionResult> {
  if (!path) return { ok: false, error: 'arquivo ausente' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('contrato').insert({ cria_id: criaId, arquivo_url: path });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  return { ok: true };
}

// Disparar uma mensagem no WhatsApp da Cria (grupo/contato) via Evolution API.
// Registra a mensagem como comentário na Cria pra ficar o rastro. RLS de
// comentário: Contas/Projetos/Admin.
export async function avisarCriaWhatsapp(criaId: string, texto: string): Promise<ActionResult> {
  const t = texto.trim();
  if (!t) return { ok: false, error: 'escreva a mensagem' };
  const membro = await getCurrentMembro();
  if (!membro) return { ok: false, error: 'membro não identificado' };

  const supabase = await getSupabaseServer();
  // Gate de papel: só Contas/Projetos/Admin disparam WhatsApp (Tráfego não) —
  // antes qualquer membro que enxergasse a Cria conseguia disparar.
  const { data: mp } = await supabase.from('membro_papel').select('papel').eq('membro_id', membro.id);
  const papeis = new Set<string>([membro.papel_primario, ...(((mp as { papel: string }[]) ?? []).map((r) => r.papel))]);
  if (!(membro.is_admin || papeis.has('gestor_contas') || papeis.has('gestor_projetos'))) {
    return { ok: false, error: 'sem permissão para disparar WhatsApp' };
  }

  const { data: cria } = await supabase.from('cria').select('telefone_whatsapp').eq('id', criaId).maybeSingle();
  const destino = (cria as { telefone_whatsapp: string | null } | null)?.telefone_whatsapp;
  if (!destino) return { ok: false, error: 'esta Cria não tem WhatsApp cadastrado' };

  const r = await enviarWhatsapp(destino, t);
  if (!r.ok) return { ok: false, error: r.error ?? 'não deu para enviar' };

  // Registra o rastro (a mensagem já foi enviada); se o insert falhar, loga —
  // antes o erro era engolido, deixando um envio sem rastro.
  const { error: insErr } = await supabase.from('comentario').insert({ cria_id: criaId, autor_id: membro.id, corpo: `📲 [WhatsApp] ${t}` });
  if (insErr) console.error('[avisarCriaWhatsapp] registro do comentário', insErr);
  revalidatePath('/crias/[id]', 'page');
  return { ok: true };
}

// Editar um campo de texto da Cria (e-mail, área, closer). Whitelist de
// colunas. RLS: Contas/Admin (o trigger de coluna barra Tráfego nesses campos).
export async function atualizarCampoCria(criaId: string, campo: 'email' | 'area_atuacao' | 'closer', valor: string): Promise<ActionResult> {
  const permitidos = ['email', 'area_atuacao', 'closer'];
  if (!permitidos.includes(campo)) return { ok: false, error: 'campo inválido' };
  const v = valor.trim() || null;
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('cria').update({ [campo]: v }).eq('id', criaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  revalidatePath('/crias');
  return { ok: true };
}

// Definir o Gestor de Contas da Cria (ou limpar). RLS: Contas/Admin.
export async function definirGestorContas(criaId: string, membroId: string | null): Promise<ActionResult> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('cria').update({ gestor_contas_id: membroId || null }).eq('id', criaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/crias/[id]', 'page');
  revalidatePath('/crias');
  return { ok: true };
}

// Editar o investimento em mídia da Cria (verba de campanha). RLS: Contas,
// Tráfego ou Admin. Valor null = "a definir".
export async function atualizarInvestimento(criaId: string, valor: number | null): Promise<ActionResult> {
  // valor inválido é REJEITADO (antes virava null e apagava o investimento por
  // engano). null explícito = "a definir".
  if (valor != null && (!Number.isFinite(valor) || valor < 0)) return { ok: false, error: 'informe um valor válido (≥ 0)' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('cria').update({ investimento_midia: valor }).eq('id', criaId);
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

// Definir a data de início da Forja (projeto). Dispara a cascata de prazos das
// 7 fases (app.aplicar_data_inicio) — base do SLA e do Calendário. RLS/guard:
// Projetos/Admin (checado dentro do RPC).
export async function iniciarForja(criaId: string, data: string): Promise<ActionResult> {
  if (!data) return { ok: false, error: 'informe a data de início' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('iniciar_forja', { p_cria_id: criaId, p_data: data });
  if (error) return { ok: false, error: error.message };
  // A cascata de prazos muda o SLA → recalcula o em_risco na hora (não espera o
  // sync do ClickUp, que pode nem rodar hoje). recalcular_em_risco é service_role.
  await recalcularRisco(getSupabaseAdmin());
  revalidatePath('/crias/[id]', 'page');
  revalidatePath('/crias');
  revalidatePath('/calendario');
  revalidatePath('/covil');
  return { ok: true };
}

// Avançar a fase da Forja (checklist + gate de papel validados no banco).
export async function avancarFase(forjaId: string): Promise<ActionResult> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('avancar_fase', { p_forja_id: forjaId });
  if (error) return { ok: false, error: error.message };
  await recalcularRisco(getSupabaseAdmin()); // avançar fase pode tirar do risco
  revalidatePath('/crias/[id]', 'page');
  revalidatePath('/covil');
  return { ok: true };
}

// Persistir as preferências da Forjaria (bloco jsonb) do membro logado.
// RLS: cada membro só grava a própria linha (policy p_pref_self).
export async function salvarPreferencias(dados: Record<string, unknown>): Promise<ActionResult> {
  const membro = await getCurrentMembro();
  if (!membro) return { ok: false, error: 'membro não identificado' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('preferencia')
    .upsert({ membro_id: membro.id, dados }, { onConflict: 'membro_id' });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/forjaria');
  return { ok: true };
}

// Adicionar item ao acervo da Biblioteca (roteiro em texto ou criativo com
// arquivo). Autor = membro logado. RLS: qualquer membro cria.
export async function criarItemBiblioteca(input: {
  titulo: string;
  tipo: 'roteiro' | 'criativo';
  conteudo?: string | null;
  arquivoPath?: string | null;
  arquivoNome?: string | null;
  criaId?: string | null;
}): Promise<ActionResult> {
  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: 'informe um título' };
  if (input.tipo !== 'roteiro' && input.tipo !== 'criativo') return { ok: false, error: 'tipo inválido' };
  if (input.tipo === 'roteiro' && !(input.conteudo ?? '').trim()) return { ok: false, error: 'escreva o roteiro' };
  if (input.tipo === 'criativo' && !input.arquivoPath) return { ok: false, error: 'anexe o arquivo do criativo' };
  const membro = await getCurrentMembro();
  if (!membro) return { ok: false, error: 'membro não identificado' };

  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('biblioteca_item').insert({
    titulo,
    tipo: input.tipo,
    conteudo: input.tipo === 'roteiro' ? (input.conteudo?.trim() || null) : null,
    arquivo_path: input.tipo === 'criativo' ? (input.arquivoPath || null) : null,
    arquivo_nome: input.tipo === 'criativo' ? (input.arquivoNome || null) : null,
    cria_id: input.criaId || null,
    autor_id: membro.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/biblioteca');
  return { ok: true };
}

// Remover item do acervo. RLS: só o autor ou Admin.
export async function excluirItemBiblioteca(id: string): Promise<ActionResult> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from('biblioteca_item').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/biblioteca');
  return { ok: true };
}

// Exporta os dados do próprio membro (LGPD/portabilidade): perfil, preferências,
// e as Lenhas/Comentários/Briefings de sua autoria. Só o próprio membro (RLS).
export async function exportarMeusDados(): Promise<{ ok: boolean; json?: string; error?: string }> {
  const membro = await getCurrentMembro();
  if (!membro) return { ok: false, error: 'membro não identificado' };
  const supabase = await getSupabaseServer();
  const [pref, lenhas, comentarios, briefings] = await Promise.all([
    supabase.from('preferencia').select('dados, updated_at').eq('membro_id', membro.id).maybeSingle(),
    supabase.from('lenha').select('*').eq('responsavel_id', membro.id),
    supabase.from('comentario').select('*').eq('autor_id', membro.id),
    supabase.from('briefing').select('*').eq('autor_id', membro.id),
  ]);
  const dump = {
    exportado_em: new Date().toISOString(),
    membro: { id: membro.id, nome: membro.nome, email: membro.email, papel_primario: membro.papel_primario, is_admin: membro.is_admin },
    preferencias: (pref.data as { dados: unknown } | null)?.dados ?? null,
    lenhas: lenhas.data ?? [],
    comentarios: comentarios.data ?? [],
    briefings: briefings.data ?? [],
  };
  return { ok: true, json: JSON.stringify(dump, null, 2) };
}

// Editar a própria Conta (nome + papel primário) via RPC SECURITY DEFINER
// (a tabela membro é admin-only na RLS). Trocar o papel muda a tela-casa.
export async function salvarConta(input: { nome: string; papel: Papel }): Promise<ActionResult> {
  const nome = input.nome.trim();
  if (!nome) return { ok: false, error: 'informe o nome' };
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('atualizar_minha_conta', { p_nome: nome, p_papel: input.papel });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/forjaria');
  revalidatePath('/covil');
  return { ok: true };
}
