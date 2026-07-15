import { getSupabaseAdmin } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { hojeBRT } from '@/lib/datas';
import { syncCrias, mapTaskToCria } from '@/integracao/clickup/sync-crias.js';
import { getTask } from '@/integracao/clickup/client.js';

// ── Engine de sincronização do espelho ClickUp → CRM ────────────────────────
// Fonte ÚNICA da gravação (usada pelo cron, pelo webhook e pelo pull-on-view):
// upsert por clickup_task_id + cascata (Data inicial → prazos das 7 fases;
// Semana → fase atual) + recálculo do em_risco. Nunca lança pra fora: em erro,
// a página só mostra o espelho atual.

interface CriaSync {
  clickup_task_id: string;
  nome_cliente: string;
  clickup_squad: string | null;
  clickup_semana: number | null;
  status: string;
  data_inicio?: string | null;
  dados?: { email?: string | null; telefone_whatsapp?: string | null; area_atuacao?: string | null; closer?: string | null };
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

// Aplica UMA Cria no banco. Só grava os campos do cliente que vierem preenchidos
// (não sobrescreve o CRM com vazio). Depois cascateia início/fase via RPC.
export async function aplicarCriaNoBanco(admin: Admin, c: CriaSync): Promise<{ ok: boolean; id?: string; error?: string }> {
  const patch: Record<string, unknown> = {
    clickup_task_id: c.clickup_task_id,
    nome_cliente: c.nome_cliente,
    clickup_squad: c.clickup_squad,
    clickup_semana: c.clickup_semana == null ? null : Math.min(7, Math.max(1, c.clickup_semana)),
    status: c.status,
    sincronizado_em: new Date().toISOString(),
  };
  for (const k of ['email', 'telefone_whatsapp', 'area_atuacao', 'closer'] as const) {
    const v = c.dados?.[k];
    if (v) patch[k] = v;
  }
  const { data: up, error } = await admin.from('cria').upsert(patch, { onConflict: 'clickup_task_id' }).select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  const id = (up as { id: string } | null)?.id;
  if (id) {
    if (c.data_inicio) await admin.rpc('definir_inicio_forja_sync', { p_cria_id: id, p_data: c.data_inicio });
    if (c.clickup_semana) await admin.rpc('definir_fase_forja_sync', { p_cria_id: id, p_semana: c.clickup_semana });
  }
  return { ok: true, id };
}

// Aplica várias Crias com concorrência limitada (mantém o pull-on-view rápido).
async function aplicarEmLotes(admin: Admin, crias: CriaSync[], limite = 8): Promise<number> {
  let ok = 0;
  for (let i = 0; i < crias.length; i += limite) {
    const res = await Promise.all(
      crias.slice(i, i + limite).map((c) => aplicarCriaNoBanco(admin, c).then((r) => r.ok).catch(() => false)),
    );
    ok += res.filter(Boolean).length;
  }
  return ok;
}

// Recalcula o em_risco (SLA de fase vencida) de TODAS as Crias — no plano Hobby
// não sobra slot de cron pra isso, então o sync da lista é quem mantém o flag em
// dia. Idempotente. Usado no cron, no webhook e no pull-on-view da LISTA.
export async function recalcularRisco(admin: Admin): Promise<void> {
  try {
    await admin.rpc('recalcular_em_risco');
  } catch {
    /* best-effort */
  }
}

// Recalcula o em_risco de UMA Cria só (mesma regra da RPC global, no fuso BRT).
// Abrir a página de uma Cria não deve disparar um UPDATE na tabela inteira.
async function recalcularRiscoDaCria(admin: Admin, criaId: string): Promise<void> {
  try {
    const { data: forja } = await admin.from('forja').select('id').eq('cria_id', criaId).maybeSingle();
    const fid = (forja as { id: string } | null)?.id;
    if (!fid) return;
    const { data: fases } = await admin
      .from('fase_da_forja')
      .select('data_prevista_fim')
      .eq('forja_id', fid)
      .neq('status', 'concluida');
    const hoje = hojeBRT();
    // em risco = alguma fase não-concluída com prazo ESTRITAMENTE antes de hoje.
    const emRisco = ((fases as { data_prevista_fim: string | null }[]) ?? []).some(
      (f) => !!f.data_prevista_fim && f.data_prevista_fim < hoje,
    );
    await admin.from('cria').update({ em_risco: emRisco }).eq('id', criaId);
  } catch {
    /* best-effort */
  }
}

function clickupPronto(): boolean {
  return isSupabaseConfigured && !!process.env.CLICKUP_API_TOKEN;
}

// Throttle em memória por instância — reduz corrida/redisparo no mesmo lambda.
let ultimoSyncListaMs = 0;

async function idadeEspelhoMs(admin: Admin): Promise<number> {
  const { data } = await admin
    .from('cria')
    .select('sincronizado_em')
    .order('sincronizado_em', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const ultimo = (data as { sincronizado_em: string | null } | null)?.sincronizado_em;
  if (!ultimo) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(ultimo).getTime();
}

// Sincroniza o espelho INTEIRO se estiver mais velho que maxIdadeMs. Chamado ao
// abrir a lista de Crias (pull-on-view). Throttled pra não martelar o ClickUp.
export async function sincronizarEspelhoSeVelho(
  { maxIdadeMs = 120_000 }: { maxIdadeMs?: number } = {},
): Promise<{ status: 'pulado' | 'ok' | 'erro'; upserts?: number }> {
  if (!clickupPronto()) return { status: 'pulado' };
  if (Date.now() - ultimoSyncListaMs < maxIdadeMs) return { status: 'pulado' };
  try {
    const admin = getSupabaseAdmin();
    if ((await idadeEspelhoMs(admin)) < maxIdadeMs) {
      ultimoSyncListaMs = Date.now();
      return { status: 'pulado' };
    }
    ultimoSyncListaMs = Date.now(); // trava otimista (mesmo em erro, não re-tenta na janela)
    // Deadline: o sync roda dentro do render (streamado) — se o ClickUp estiver
    // lento/em 429, não deixa a lista de Crias pendurar. Estoura → cai no catch,
    // a página mostra o espelho atual e o próximo acesso tenta de novo.
    const trabalho = (async () => {
      const { crias } = (await syncCrias({ includeClosed: true })) as { crias: CriaSync[] };
      const n = await aplicarEmLotes(admin, crias);
      await recalcularRisco(admin);
      return n;
    })();
    const upserts = (await Promise.race([
      trabalho,
      new Promise<number>((_, rej) => setTimeout(() => rej(new Error('deadline')), 15_000)),
    ])) as number;
    return { status: 'ok', upserts };
  } catch {
    return { status: 'erro' };
  }
}

// Sincroniza UMA Cria (pela task do ClickUp) se estiver velha. Barato (1 getTask)
// — chamado ao abrir a página individual da Cria.
export async function sincronizarCriaSeVelho(
  criaId: string,
  { maxIdadeMs = 60_000 }: { maxIdadeMs?: number } = {},
): Promise<{ status: 'pulado' | 'ok' | 'erro' }> {
  if (!clickupPronto()) return { status: 'pulado' };
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('cria').select('clickup_task_id, sincronizado_em').eq('id', criaId).maybeSingle();
    const row = data as { clickup_task_id: string | null; sincronizado_em: string | null } | null;
    if (!row?.clickup_task_id) return { status: 'pulado' };
    const idade = row.sincronizado_em ? Date.now() - new Date(row.sincronizado_em).getTime() : Number.POSITIVE_INFINITY;
    if (idade < maxIdadeMs) return { status: 'pulado' };
    const task = await getTask(row.clickup_task_id);
    await aplicarCriaNoBanco(admin, mapTaskToCria(task) as CriaSync);
    await recalcularRiscoDaCria(admin, criaId); // só esta Cria, não a tabela toda
    return { status: 'ok' };
  } catch {
    return { status: 'erro' };
  }
}
