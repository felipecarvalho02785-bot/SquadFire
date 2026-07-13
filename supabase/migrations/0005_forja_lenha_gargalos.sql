-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0005 — Módulo 3 (Forja) + Lenha + Gargalos/Briefing
-- ─────────────────────────────────────────────────────────────
-- Ordem por dependência de FK, não por módulo do doc:
--   fase → forja → fase_da_forja → (gargalo → plano → passo), briefing, lenha.

-- ── fase (catálogo — 7 fases fixas) ──────────────────────────
create table fase (
  id            uuid primary key default gen_random_uuid(),
  ordem         int not null unique check (ordem between 1 and 7),
  nome          text not null,
  duracao_dias  int not null default 7,
  is_gate       boolean not null default false,
  gate_descricao text
);

comment on table fase is 'Catálogo fixo das 7 fases da Estruturação (ver seed).';

-- ── fase_lenha_padrao (checklist padrão por fase) ────────────
-- Fonte data-driven do trigger que cria as Lenhas de Forja junto com a Cria.
create table fase_lenha_padrao (
  fase_id uuid not null references fase(id) on delete cascade,
  ordem   int not null,
  titulo  text not null,
  primary key (fase_id, ordem)
);

comment on table fase_lenha_padrao is
  'Lenhas de Forja padrão por fase (regra 1); lidas ao criar a Forja.';

-- ── forja (1:1 com Cria) ─────────────────────────────────────
-- fase_atual_id referencia fase_da_forja (criada logo abaixo) → FK adicionada
-- depois pra quebrar a dependência circular.
create table forja (
  id            uuid primary key default gen_random_uuid(),
  cria_id       uuid not null unique references cria(id) on delete cascade,
  data_inicio   date,
  flag_contrato flag_contrato not null default 'forja_quente',
  fase_atual_id uuid,
  concluida     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column forja.data_inicio is
  'Vem da leitura do contrato; gatilho dos prazos. Null = backlog (sem SLA).';

create trigger trg_forja_updated_at
  before update on forja
  for each row execute function app.set_updated_at();

-- ── fase_da_forja (instância de cada fase numa Forja) ────────
create table fase_da_forja (
  id                   uuid primary key default gen_random_uuid(),
  forja_id             uuid not null references forja(id) on delete cascade,
  fase_id              uuid not null references fase(id),
  ordem                int not null,
  data_prevista_inicio date,
  data_prevista_fim    date,
  data_realizada_inicio date,
  data_realizada_fim   date,
  status               status_fase not null default 'pendente',
  unique (forja_id, fase_id)
);

create index idx_fase_da_forja_forja on fase_da_forja(forja_id, ordem);

-- Fecha a dependência circular forja ↔ fase_da_forja.
alter table forja
  add constraint forja_fase_atual_fk
  foreign key (fase_atual_id) references fase_da_forja(id) on delete set null;

-- ── gargalo ──────────────────────────────────────────────────
create table gargalo (
  id               uuid primary key default gen_random_uuid(),
  cria_id          uuid not null references cria(id) on delete cascade,
  fase_da_forja_id uuid references fase_da_forja(id) on delete set null,
  descricao        text not null,
  status           status_gargalo not null default 'aberto',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_gargalo_cria on gargalo(cria_id);
create index idx_gargalo_fase on gargalo(fase_da_forja_id);

create trigger trg_gargalo_updated_at
  before update on gargalo
  for each row execute function app.set_updated_at();

-- ── plano_de_acao (1:1 com gargalo) ──────────────────────────
create table plano_de_acao (
  id             uuid primary key default gen_random_uuid(),
  gargalo_id     uuid not null unique references gargalo(id) on delete cascade,
  responsavel_id uuid references membro(id) on delete set null,
  prazo          date,
  gerado_por_ia  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_plano_updated_at
  before update on plano_de_acao
  for each row execute function app.set_updated_at();

-- ── plano_passo ──────────────────────────────────────────────
create table plano_passo (
  id               uuid primary key default gen_random_uuid(),
  plano_de_acao_id uuid not null references plano_de_acao(id) on delete cascade,
  ordem            int not null,
  descricao        text not null,
  concluido        boolean not null default false,
  unique (plano_de_acao_id, ordem)
);

-- ── briefing (relatório semanal — 6 campos) ──────────────────
create table briefing (
  id                 uuid primary key default gen_random_uuid(),
  cria_id            uuid not null references cria(id) on delete cascade,
  forja_id           uuid references forja(id) on delete set null,
  semana_referencia  date not null,
  origem             origem_briefing not null,
  c1_o_que_aconteceu text,
  c2_satisfacao      text,
  c3_campanhas       text,
  c4_nosso_desempenho text,
  c5_pontos_atencao  text,
  c6_proximos_passos text,
  audio_url          text,
  autor_id           uuid not null references membro(id),
  enviado_clickup    boolean not null default false,
  -- task-mestre do cliente (= cria.clickup_task_id); briefing vira COMENTÁRIO nela.
  clickup_task_id    text,
  clickup_comment_id text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_briefing_cria on briefing(cria_id, semana_referencia desc);

create trigger trg_briefing_updated_at
  before update on briefing
  for each row execute function app.set_updated_at();

-- ── lenha (tarefa: Forja ou Rotina) ──────────────────────────
create table lenha (
  id               uuid primary key default gen_random_uuid(),
  tipo             tipo_lenha not null,
  titulo           text not null,
  descricao        text,
  status           status_lenha not null default 'pendente',
  prioridade       prioridade_lenha not null default 'media',
  prazo            date,
  responsavel_id   uuid references membro(id) on delete set null,
  fase_da_forja_id uuid references fase_da_forja(id) on delete cascade,
  rotina_id        uuid references rotina(id) on delete set null,
  data_referencia  date,
  concluida_em     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- integridade: forja pendura na fase; rotina pendura na rotina (ocorrência).
  constraint lenha_tipo_coerente check (
    (tipo = 'forja'  and fase_da_forja_id is not null and rotina_id is null) or
    (tipo = 'rotina' and rotina_id is not null and fase_da_forja_id is null)
  )
);

create index idx_lenha_responsavel on lenha(responsavel_id);
create index idx_lenha_fase         on lenha(fase_da_forja_id);
create index idx_lenha_rotina_dia   on lenha(rotina_id, data_referencia);
create index idx_lenha_status       on lenha(status);

create trigger trg_lenha_updated_at
  before update on lenha
  for each row execute function app.set_updated_at();
