import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export interface RelatorioBriefing {
  semana: string;
  campos: { chave: string; label: string; texto: string }[];
}
export interface Relatorio {
  criaNome: string;
  area: string | null;
  briefing: RelatorioBriefing | null;
}

const CAMPOS: { col: string; chave: string; label: string }[] = [
  { col: 'c1_o_que_aconteceu', chave: 'c1', label: 'O que aconteceu na semana' },
  { col: 'c2_satisfacao', chave: 'c2', label: 'Satisfação do cliente' },
  { col: 'c3_campanhas', chave: 'c3', label: 'Campanhas' },
  { col: 'c4_nosso_desempenho', chave: 'c4', label: 'Nosso desempenho' },
  { col: 'c5_pontos_atencao', chave: 'c5', label: 'Pontos de atenção' },
  { col: 'c6_proximos_passos', chave: 'c6', label: 'Próximos passos' },
];

// Dados do relatório semanal (para o cliente) a partir do briefing mais recente
// da Cria — ou de um briefing específico (briefingId).
export async function getRelatorio(criaId: string, briefingId?: string): Promise<Relatorio | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await getSupabaseServer();
  const { data: cria } = await supabase.from('cria').select('nome_cliente, area_atuacao').eq('id', criaId).maybeSingle();
  if (!cria) return null;

  let q = supabase
    .from('briefing')
    .select('semana_referencia, c1_o_que_aconteceu, c2_satisfacao, c3_campanhas, c4_nosso_desempenho, c5_pontos_atencao, c6_proximos_passos')
    .eq('cria_id', criaId);
  if (briefingId) q = q.eq('id', briefingId);
  const { data: b } = await q.order('semana_referencia', { ascending: false }).limit(1).maybeSingle();

  const c = cria as { nome_cliente: string; area_atuacao: string | null };
  const bb = b as Record<string, string | null> | null;
  return {
    criaNome: c.nome_cliente,
    area: c.area_atuacao,
    briefing: bb
      ? {
          semana: String(bb.semana_referencia),
          campos: CAMPOS.map((f) => ({ chave: f.chave, label: f.label, texto: (bb[f.col] ?? '').trim() })).filter((f) => f.texto),
        }
      : null,
  };
}
