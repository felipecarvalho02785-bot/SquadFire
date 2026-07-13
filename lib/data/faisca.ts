import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

// Retrato compacto e real do Squad para alimentar a Faísca. Tudo respeita RLS
// (roda como o membro logado). Sem Supabase, devolve um aviso de demonstração.
export async function getContextoFaisca(): Promise<string> {
  if (!isSupabaseConfigured) {
    return 'Modo demonstração — sem banco conectado. Você pode explicar como o Squad funciona, mas não tem números reais agora.';
  }
  const supabase = await getSupabaseServer();
  const [{ data: risco }, { count: ativas }, { count: lenhasAbertas }, { count: gargalos }] = await Promise.all([
    supabase.from('cria').select('nome_cliente, area_atuacao, clickup_semana').eq('em_risco', true).limit(30),
    supabase.from('cria').select('*', { count: 'exact', head: true }).eq('status', 'ativa'),
    supabase.from('lenha').select('*', { count: 'exact', head: true }).neq('status', 'concluida'),
    supabase.from('gargalo').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
  ]);

  const emRisco = (risco as { nome_cliente: string; area_atuacao: string | null; clickup_semana: number | null }[]) ?? [];
  const listaRisco = emRisco.length
    ? emRisco.map((c) => `${c.nome_cliente}${c.area_atuacao ? ` (${c.area_atuacao})` : ''}${c.clickup_semana != null ? ` · semana ${c.clickup_semana}` : ''}`).join('; ')
    : 'nenhuma';

  return [
    `Crias ativas: ${ativas ?? 0}.`,
    `Lenhas (tarefas) abertas na squad: ${lenhasAbertas ?? 0}.`,
    `Gargalos abertos: ${gargalos ?? 0}.`,
    `Crias em risco de SLA (Estopim estourando): ${listaRisco}.`,
  ].join('\n');
}
