// Tipos do banco (espelham supabase/migrations). Fonte de verdade: o schema SQL.
// Mantidos à mão; em produção dá pra gerar com `supabase gen types typescript`.

export type Papel = 'gestor_contas' | 'gestor_projetos' | 'gestor_trafego';
export type StatusCria = 'ativa' | 'pausada' | 'encerrada';
export type FlagContrato = 'forja_quente' | 'brasa_viva';
export type StatusFase = 'pendente' | 'em_andamento' | 'concluida';
export type TipoLenha = 'forja' | 'rotina' | 'avulsa';
export type StatusLenha = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
export type PrioridadeLenha = 'baixa' | 'media' | 'alta';
export type EscopoRotina = 'individual' | 'subconjunto' | 'coletiva';
export type RecorrenciaTipo = 'diaria' | 'dias_da_semana' | 'semanal' | 'mensal' | 'sprint';
export type StatusGargalo = 'aberto' | 'em_resolucao' | 'resolvido';
export type OrigemBriefing = 'audio' | 'grupo_whatsapp' | 'manual';

export interface Membro {
  id: string;
  nome: string;
  email: string;
  papel_primario: Papel;
  is_admin: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cria {
  id: string;
  nome_cliente: string;
  email: string | null;
  telefone_whatsapp: string | null;
  area_atuacao: string | null;
  produto: 'estruturacao';
  investimento_midia: number | null;
  closer: string | null;
  gestor_contas_id: string | null;
  status: StatusCria;
  em_risco: boolean;
  clickup_task_id: string | null;
  clickup_squad: string | null;
  clickup_semana: number | null;
  sincronizado_em: string | null;
  diagnostico_path: string | null;
  diagnostico_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface Forja {
  id: string;
  cria_id: string;
  data_inicio: string | null;
  flag_contrato: FlagContrato;
  fase_atual_id: string | null;
  concluida: boolean;
  created_at: string;
  updated_at: string;
}

export interface Fase {
  id: string;
  ordem: number;
  nome: string;
  duracao_dias: number;
  is_gate: boolean;
  gate_descricao: string | null;
}

export interface FaseDaForja {
  id: string;
  forja_id: string;
  fase_id: string;
  ordem: number;
  data_prevista_inicio: string | null;
  data_prevista_fim: string | null;
  data_realizada_inicio: string | null;
  data_realizada_fim: string | null;
  status: StatusFase;
}

export interface Lenha {
  id: string;
  tipo: TipoLenha;
  titulo: string;
  descricao: string | null;
  status: StatusLenha;
  prioridade: PrioridadeLenha;
  prazo: string | null;
  responsavel_id: string | null;
  fase_da_forja_id: string | null;
  rotina_id: string | null;
  data_referencia: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface Briefing {
  id: string;
  cria_id: string;
  forja_id: string | null;
  semana_referencia: string;
  origem: OrigemBriefing;
  c1_o_que_aconteceu: string | null;
  c2_satisfacao: string | null;
  c3_campanhas: string | null;
  c4_nosso_desempenho: string | null;
  c5_pontos_atencao: string | null;
  c6_proximos_passos: string | null;
  audio_url: string | null;
  autor_id: string;
  enviado_clickup: boolean;
  clickup_task_id: string | null;
  clickup_comment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comentario {
  id: string;
  cria_id: string;
  autor_id: string;
  corpo: string;
  anexo_url: string | null;
  created_at: string;
}
