import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { getSupabaseServer } from '@/lib/supabase/server';
import { criarTarefa } from '@/lib/actions';
import { faseLabel } from '@/lib/format';
import type { Membro } from '@/lib/types/database';

// Ferramentas que a Faísca pode EXECUTAR (function calling do Gemini). Tudo roda
// como o membro logado (RLS/Server Actions), então a IA nunca escapa das regras.
export const FERRAMENTAS_FAISCA: FunctionDeclaration[] = [
  {
    name: 'criar_lenha',
    description:
      'Cria uma tarefa (Lenha) do dia para a squad. Use quando o usuário pedir pra criar, anotar, agendar ou delegar uma tarefa. Se ele não indicar um responsável, a tarefa fica com ele mesmo.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING, description: 'O que precisa ser feito (frase curta e clara).' },
        prazo: { type: SchemaType.STRING, description: 'Data limite no formato AAAA-MM-DD. Opcional.' },
        responsavel: { type: SchemaType.STRING, description: 'Nome (ou parte) do membro responsável. Opcional.' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'buscar_cria',
    description:
      'Busca uma Cria (cliente) pelo nome e retorna a situação dela: área, status, fase/semana e se está em risco de SLA (Estopim).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { termo: { type: SchemaType.STRING, description: 'Nome ou parte do nome do cliente.' } },
      required: ['termo'],
    },
  },
  {
    name: 'resumo_do_dia',
    description:
      'Resume o dia do usuário: quantas Lenhas em aberto ele tem, quantas Crias estão em risco de SLA e quantos gargalos estão abertos.',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
];

type CriaRow = { id: string; nome_cliente: string; area_atuacao: string | null; status: string; em_risco: boolean; clickup_semana: number | null; diagnostico_resumo: string | null };

// Executa a ferramenta pedida pela Faísca e devolve um objeto simples (a IA
// transforma em resposta natural). Erros viram { ok:false, erro } — nunca lança.
export async function executarFerramentaFaisca(nome: string, args: Record<string, unknown>, membro: Membro): Promise<unknown> {
  const supabase = await getSupabaseServer();

  switch (nome) {
    case 'criar_lenha': {
      const titulo = String(args.titulo ?? '').trim();
      if (!titulo) return { ok: false, erro: 'preciso de um título pra criar a tarefa' };

      let responsavelId: string | null = null;
      let responsavelNome = 'você';
      const alvo = String(args.responsavel ?? '').trim();
      if (alvo) {
        const { data } = await supabase.from('membro').select('id, nome').ilike('nome', `%${alvo}%`).eq('ativo', true).limit(1);
        const m = (data as { id: string; nome: string }[] | null)?.[0];
        if (!m) return { ok: false, erro: `não achei ninguém na Brigada com o nome "${alvo}"` };
        responsavelId = m.id;
        responsavelNome = m.nome;
      }

      const prazo = typeof args.prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.prazo) ? args.prazo : null;
      const res = await criarTarefa({ titulo, prazo, responsavelId });
      return res.ok
        ? { ok: true, criada: titulo, responsavel: responsavelNome, prazo: prazo ?? 'sem prazo definido' }
        : { ok: false, erro: res.error ?? 'não deu pra criar a tarefa' };
    }

    case 'buscar_cria': {
      const termo = String(args.termo ?? '').trim();
      if (!termo) return { encontrada: false, erro: 'me diz o nome do cliente' };
      const { data } = await supabase
        .from('cria')
        .select('id, nome_cliente, area_atuacao, status, em_risco, clickup_semana, diagnostico_resumo')
        .ilike('nome_cliente', `%${termo}%`)
        .limit(3);
      const crias = (data as CriaRow[]) ?? [];
      if (!crias.length) return { encontrada: false, termo };
      return {
        encontrada: true,
        resultados: crias.map((c) => ({
          nome: c.nome_cliente,
          area: c.area_atuacao ?? '—',
          status: c.status,
          fase: c.clickup_semana != null ? faseLabel(c.clickup_semana) : 'sem fase',
          em_risco: c.em_risco,
          diagnostico: c.diagnostico_resumo ?? undefined,
        })),
      };
    }

    case 'resumo_do_dia': {
      const [{ count: minhasLenhas }, { count: emRisco }, { count: gargalos }] = await Promise.all([
        supabase.from('lenha').select('*', { count: 'exact', head: true }).eq('responsavel_id', membro.id).neq('status', 'concluida'),
        supabase.from('cria').select('*', { count: 'exact', head: true }).eq('status', 'ativa').eq('em_risco', true),
        supabase.from('gargalo').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
      ]);
      return {
        suas_lenhas_abertas: minhasLenhas ?? 0,
        crias_em_risco: emRisco ?? 0,
        gargalos_abertos: gargalos ?? 0,
      };
    }

    default:
      return { ok: false, erro: `ferramenta desconhecida: ${nome}` };
  }
}
