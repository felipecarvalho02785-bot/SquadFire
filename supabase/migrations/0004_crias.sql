-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0004 — Módulo 2: Crias (cria, contrato, comentário)
-- ─────────────────────────────────────────────────────────────
-- gargalo/plano/briefing dependem de forja/fase_da_forja → ficam no 0005.

-- ── cria ─────────────────────────────────────────────────────
-- Espelho local de uma task-mestre do ClickUp (list "Estruturação").
-- Vínculo idempotente por clickup_task_id. Só entram tasks de Squad 08.
create table cria (
  id                uuid primary key default gen_random_uuid(),
  nome_cliente      text not null,
  email             text,
  telefone_whatsapp text,
  area_atuacao      text,
  produto           produto not null default 'estruturacao',
  -- verba de campanha (editável, começa null) — NÃO é o valor do contrato.
  investimento_midia numeric(12,2),
  closer            text,
  gestor_contas_id  uuid references membro(id) on delete set null,
  status            status_cria not null default 'ativa',
  -- derivado (SLA/NPS) — materializado por job/trigger, nunca editado à mão.
  em_risco          boolean not null default false,
  -- chave de vínculo com o ClickUp (única quando presente).
  clickup_task_id   text unique,
  clickup_squad     text,
  clickup_semana    smallint check (clickup_semana between 1 and 7),
  sincronizado_em   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table cria is 'Cliente (escritório). Espelho da task-mestre do ClickUp, Squad 08.';
comment on column cria.investimento_midia is
  'Verba de campanha do cliente (editável, começa null). ≠ contrato.valor_contrato.';
comment on column cria.em_risco is 'Derivado (SLA/NPS). Não editar manualmente.';

create index idx_cria_status          on cria(status);
create index idx_cria_gestor_contas   on cria(gestor_contas_id);
create index idx_cria_em_risco        on cria(em_risco) where em_risco;

create trigger trg_cria_updated_at
  before update on cria
  for each row execute function app.set_updated_at();

-- ── contrato ─────────────────────────────────────────────────
-- PDF no Storage; IA extrai valor/data. Confirmar dispara os prazos da Forja.
create table contrato (
  id                   uuid primary key default gen_random_uuid(),
  cria_id              uuid not null references cria(id) on delete cascade,
  arquivo_url          text not null,
  valor_contrato       numeric(12,2),
  dados_extraidos      jsonb,
  data_inicio_extraida date,
  confirmado           boolean not null default false,
  created_at           timestamptz not null default now()
);

comment on column contrato.valor_contrato is
  'Mensalidade/fee da Estruturação (extraído do PDF pela IA). ≠ cria.investimento_midia.';

create index idx_contrato_cria on contrato(cria_id);

-- ── comentario (registro contínuo por Cria) ──────────────────
create table comentario (
  id         uuid primary key default gen_random_uuid(),
  cria_id    uuid not null references cria(id) on delete cascade,
  autor_id   uuid not null references membro(id),
  corpo      text not null,
  anexo_url  text,
  created_at timestamptz not null default now()
);

create index idx_comentario_cria on comentario(cria_id, created_at desc);
