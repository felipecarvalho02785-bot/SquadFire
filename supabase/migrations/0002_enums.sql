-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0002 — Tipos enumerados
-- ─────────────────────────────────────────────────────────────
-- Fiel a docs/modelo-de-dados.md § Enums. Alterar aqui é breaking:
-- valores usados no seed, na integração ClickUp e no app.

create type papel as enum ('gestor_contas', 'gestor_projetos', 'gestor_trafego');
create type produto as enum ('estruturacao');

-- status_cria: ciclo de vida da Cria. 'encerrada' cobre tanto churn (perda)
-- quanto graduação/finalização — a distinção fina vive no ClickUp/metadados,
-- não numa coluna enum. Ver integracao/clickup/sync-crias.js (mapStatus).
create type status_cria as enum ('ativa', 'pausada', 'encerrada');

create type flag_contrato as enum ('forja_quente', 'brasa_viva');
create type status_fase as enum ('pendente', 'em_andamento', 'concluida');

create type tipo_lenha as enum ('forja', 'rotina');
create type status_lenha as enum ('pendente', 'em_andamento', 'concluida', 'cancelada');
create type prioridade_lenha as enum ('baixa', 'media', 'alta');

create type escopo_rotina as enum ('individual', 'subconjunto', 'coletiva');
create type recorrencia_tipo as enum ('diaria', 'dias_da_semana', 'semanal', 'mensal', 'sprint');

create type status_gargalo as enum ('aberto', 'em_resolucao', 'resolvido');
create type origem_briefing as enum ('audio', 'grupo_whatsapp', 'manual');
