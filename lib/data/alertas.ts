import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Papel } from '@/lib/types/database';

export interface AlertaItem {
  tipo: 'sla' | 'briefing' | 'lenha';
  titulo: string;
  sub: string;
  kind: 'crit' | 'warn' | 'info';
  href: string;
}

export interface Alertas {
  itens: AlertaItem[];
  total: number;
  resumo: string; // frase natural pro "resumo do dia" (Faísca proativa)
}

const VAZIO: Alertas = { itens: [], total: 0, resumo: '' };

// Alertas derivados do estado atual (sem tabela nem cron — sempre frescos):
// Crias apagando (SLA), briefings pendentes da semana e Lenhas atrasadas do
// membro. Alimenta o sino (#3) e o resumo do dia da Faísca (#4).
export async function getAlertas(membro: { id: string; nome: string; papel_primario: Papel } | null): Promise<Alertas> {
  if (!isSupabaseConfigured || !membro) return VAZIO;
  const supabase = await getSupabaseServer();
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - 7);

  const [{ data: risco }, { data: ativas }, { data: lenhasAtr }] = await Promise.all([
    supabase.from('cria').select('id, nome_cliente').eq('status', 'ativa').eq('em_risco', true).order('nome_cliente').limit(20),
    supabase.from('cria').select('id, nome_cliente').eq('status', 'ativa'),
    supabase.from('lenha').select('id, titulo, prazo').eq('responsavel_id', membro.id).neq('status', 'concluida').not('prazo', 'is', null).lt('prazo', hojeStr).order('prazo').limit(20),
  ]);

  const criasAtivas = (ativas as { id: string; nome_cliente: string }[]) ?? [];
  let briefadas = new Set<string>();
  if (criasAtivas.length) {
    const { data: bs } = await supabase.from('briefing').select('cria_id').in('cria_id', criasAtivas.map((c) => c.id)).gte('created_at', inicioSemana.toISOString());
    briefadas = new Set(((bs as { cria_id: string }[]) ?? []).map((b) => b.cria_id));
  }
  const pendentes = criasAtivas.filter((c) => !briefadas.has(c.id));

  const itens: AlertaItem[] = [];
  for (const c of (risco as { id: string; nome_cliente: string }[]) ?? []) {
    itens.push({ tipo: 'sla', titulo: `${c.nome_cliente} está apagando`, sub: 'Estopim estourando — SLA em risco', kind: 'crit', href: `/crias/${c.id}` });
  }
  for (const l of (lenhasAtr as { id: string; titulo: string; prazo: string }[]) ?? []) {
    itens.push({ tipo: 'lenha', titulo: l.titulo, sub: `Lenha atrasada · prazo ${new Date(l.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}`, kind: 'crit', href: '/tarefas' });
  }
  for (const c of pendentes.slice(0, 12)) {
    itens.push({ tipo: 'briefing', titulo: `Briefing pendente · ${c.nome_cliente}`, sub: 'sem briefing nesta semana', kind: 'warn', href: `/crias/${c.id}/roda` });
  }

  const nSla = (risco as unknown[])?.length ?? 0;
  const nBrief = pendentes.length;
  const nLenha = (lenhasAtr as unknown[])?.length ?? 0;

  const partes: string[] = [];
  if (nSla) partes.push(`${nSla} Cria${nSla > 1 ? 's' : ''} apagando`);
  if (nLenha) partes.push(`${nLenha} Lenha${nLenha > 1 ? 's' : ''} atrasada${nLenha > 1 ? 's' : ''}`);
  if (nBrief) partes.push(`${nBrief} briefing${nBrief > 1 ? 's' : ''} pendente${nBrief > 1 ? 's' : ''}`);
  const resumo = partes.length
    ? `Hoje pega fogo: ${partes.join(', ')}.`
    : 'Tudo sob controle — nada pegando fogo agora. 🔥';

  return { itens, total: itens.length, resumo };
}
