-- ═══════════════════════════════════════════════════════════════
-- SquadFire · SETUP COMPLETO — cole tudo no Supabase SQL Editor e RUN
-- Rode UMA vez, num projeto novo/limpo. Ordem: migrations -> seed -> storage.
-- Gerado de supabase/migrations/*, seed.sql e storage.sql.
-- ═══════════════════════════════════════════════════════════════


-- ┌── supabase/migrations/0001_extensions_e_helpers.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0001 — Extensões e helpers de infraestrutura
-- ─────────────────────────────────────────────────────────────
-- Materializa docs/modelo-de-dados.md. Rode em ordem (0001, 0002, …).
-- Portável entre o Postgres do Supabase e um Postgres local de validação.

-- gen_random_uuid() (core no PG13+, mas garantimos) e citext (email case-insensitive).
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Schema utilitário do app (helpers de auth/RLS e regras de negócio).
create schema if not exists app;

-- ── updated_at automático ────────────────────────────────────
-- Trigger genérico: seta updated_at = now() em qualquer UPDATE.
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function app.set_updated_at() is
  'Trigger BEFORE UPDATE: mantém updated_at sincronizado com o momento da alteração.';


-- ┌── supabase/migrations/0002_enums.sql
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


-- ┌── supabase/migrations/0003_membros_e_rotinas.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0003 — Módulo 1: Membros e Rotinas
-- ─────────────────────────────────────────────────────────────

-- ── membro ───────────────────────────────────────────────────
-- Allowlist da squad. email é citext (case-insensitive) e casa com o
-- claim `email` do JWT do Google SSO (ver app.current_membro_id).
create table membro (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  email          citext not null unique,
  papel_primario papel not null,
  is_admin       boolean not null default false,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table membro is 'Membros da squad (allowlist do SSO por email).';
comment on column membro.papel_primario is
  'Papel principal; regra: precisa existir uma linha correspondente em membro_papel.';

create trigger trg_membro_updated_at
  before update on membro
  for each row execute function app.set_updated_at();

-- ── membro_papel (N papéis por membro) ───────────────────────
create table membro_papel (
  membro_id uuid not null references membro(id) on delete cascade,
  papel     papel not null,
  primary key (membro_id, papel)
);

comment on table membro_papel is
  'Papéis de cada membro. O papel_primario do membro precisa constar aqui (regra 6).';

-- Regra 6 — papel primário válido: papel_primario ∈ membro_papel.
-- Em vez de um constraint deferido (hostil ao modelo REST do Supabase, que
-- insere membro e membro_papel em chamadas separadas), a invariante é
-- MANTIDA automaticamente: ao criar/mudar o papel_primario, garante-se a
-- linha correspondente em membro_papel; e proíbe-se remover essa linha.

-- Garante que papel_primario sempre tenha linha em membro_papel.
create or replace function app.sync_papel_primario()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into membro_papel (membro_id, papel)
  values (new.id, new.papel_primario)
  on conflict (membro_id, papel) do nothing;
  return new;
end;
$$;

create trigger trg_membro_sync_papel
  after insert or update of papel_primario on membro
  for each row execute function app.sync_papel_primario();

-- Impede remover/alterar a linha do papel primário (quebraria a regra 6).
create or replace function app.protege_papel_primario()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from membro m
    where m.id = old.membro_id and m.papel_primario = old.papel
  ) then
    raise exception
      'não é possível remover o papel primário (%) do membro % (regra 6)',
      old.papel, old.membro_id;
  end if;
  return old;
end;
$$;

create trigger trg_membro_papel_protege
  before delete or update on membro_papel
  for each row execute function app.protege_papel_primario();

-- ── rotina (catálogo de recorrências) ────────────────────────
-- recorrencia_config (jsonb) cobre as cadências mistas: {} diária,
-- {"dias":[...]} dias_da_semana, {"dia":"sex"} semanal,
-- {"dia_mes":1} mensal, {"ciclo_semanas":4} sprint.
create table rotina (
  id                 uuid primary key default gen_random_uuid(),
  titulo             text not null,
  descricao          text,
  escopo             escopo_rotina not null,
  recorrencia_tipo   recorrencia_tipo not null,
  recorrencia_config jsonb not null default '{}'::jsonb,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table rotina is
  'Catálogo de rotinas; o motor de recorrência gera as lenha(tipo=rotina) do dia a partir daqui.';

create trigger trg_rotina_updated_at
  before update on rotina
  for each row execute function app.set_updated_at();

-- ── rotina_papel (a quais papéis a rotina se atribui) ────────
create table rotina_papel (
  rotina_id uuid not null references rotina(id) on delete cascade,
  papel     papel not null,
  primary key (rotina_id, papel)
);

comment on table rotina_papel is
  'Escopo coletiva = todos os papéis; individual/subconjunto = um ou alguns.';


-- ┌── supabase/migrations/0004_crias.sql
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


-- ┌── supabase/migrations/0005_forja_lenha_gargalos.sql
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


-- ┌── supabase/migrations/0006_regras_de_negocio.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0006 — Regras de negócio (funções + triggers)
-- ─────────────────────────────────────────────────────────────
-- Regras 1, 2 e 3 de docs/modelo-de-dados.md § Regras de negócio.

-- ── Regra 1: criar Cria → cria Forja + 7 fases + Lenhas padrão ─
create or replace function app.criar_forja_para_cria()
returns trigger
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja_id uuid;
  v_primeira_fase_da_forja uuid;
  f record;
  v_fase_da_forja_id uuid;
  l record;
begin
  -- 1 Cria = 1 Forja. Nasce sem data_inicio (prazos só quando o contrato confirma).
  insert into forja (cria_id) values (new.id) returning id into v_forja_id;

  -- Instancia as 7 fases do catálogo, em ordem, todas 'pendente' e sem prazos.
  for f in select * from fase order by ordem loop
    insert into fase_da_forja (forja_id, fase_id, ordem)
    values (v_forja_id, f.id, f.ordem)
    returning id into v_fase_da_forja_id;

    if f.ordem = 1 then
      v_primeira_fase_da_forja := v_fase_da_forja_id;
    end if;

    -- Lenhas de Forja padrão da fase (checklist que habilita avançar).
    for l in
      select * from fase_lenha_padrao where fase_id = f.id order by ordem
    loop
      insert into lenha (tipo, titulo, fase_da_forja_id)
      values ('forja', l.titulo, v_fase_da_forja_id);
    end loop;
  end loop;

  -- Ponteiro da fase corrente = fase 1.
  if v_primeira_fase_da_forja is not null then
    update forja set fase_atual_id = v_primeira_fase_da_forja where id = v_forja_id;
  end if;

  return new;
end;
$$;

create trigger trg_cria_cria_forja
  after insert on cria
  for each row execute function app.criar_forja_para_cria();

-- ── Cascata de prazos a partir da data de início da Forja ─────
-- Fase N começa quando N-1 fecha no previsto; duracao_dias por fase.
create or replace function app.aplicar_data_inicio(p_forja_id uuid, p_data_inicio date)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  ff record;
  v_inicio date := p_data_inicio;
  v_fim date;
begin
  update forja set data_inicio = p_data_inicio where id = p_forja_id;

  for ff in
    select fdf.id, f.duracao_dias
    from fase_da_forja fdf
    join fase f on f.id = fdf.fase_id
    where fdf.forja_id = p_forja_id
    order by fdf.ordem
  loop
    v_fim := v_inicio + (ff.duracao_dias || ' days')::interval;
    update fase_da_forja
      set data_prevista_inicio = v_inicio,
          data_prevista_fim    = v_fim
      where id = ff.id;
    v_inicio := v_fim;
  end loop;
end;
$$;

comment on function app.aplicar_data_inicio(uuid, date) is
  'Regra 2: seta forja.data_inicio e calcula os prazos das 7 fases em cascata.';

-- ── Regra 2: confirmar contrato dispara os prazos ────────────
create or replace function app.contrato_confirmado()
returns trigger
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja_id uuid;
begin
  -- Só quando confirmado passa a true e há data extraída.
  if new.confirmado and not old.confirmado and new.data_inicio_extraida is not null then
    select id into v_forja_id from forja where cria_id = new.cria_id;
    if v_forja_id is not null then
      perform app.aplicar_data_inicio(v_forja_id, new.data_inicio_extraida);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_contrato_confirmado
  after update of confirmado on contrato
  for each row execute function app.contrato_confirmado();

-- ── Regra 3: avançar fase (manual + checklist) ───────────────
-- Conclui a fase atual (se as Lenhas de Forja dela estiverem concluídas e o
-- gate cumprido) e move o ponteiro pra próxima. Não avança sozinho.
create or replace function app.avancar_fase(p_forja_id uuid)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_atual fase_da_forja%rowtype;
  v_fase fase%rowtype;
  v_pendentes int;
  v_prox fase_da_forja%rowtype;
begin
  -- Autorização (regra 3): só Projetos ou Admin avançam fase. Como a função é
  -- SECURITY DEFINER (bypassa RLS pra mexer em várias tabelas), o guard vive aqui.
  -- Chamadas de sistema/serviço (sem JWT) passam: current_membro_id() é null e
  -- não são bloqueadas — o gate é pra usuário logado sem o papel.
  if app.jwt_email() is not null
     and not (app.has_papel('gestor_projetos') or app.is_admin()) then
    raise exception 'Sem permissão para avançar fase (requer Projetos ou Admin)';
  end if;

  select fdf.* into v_atual
  from forja fj
  join fase_da_forja fdf on fdf.id = fj.fase_atual_id
  where fj.id = p_forja_id;

  if not found then
    raise exception 'Forja % sem fase atual definida', p_forja_id;
  end if;

  select * into v_fase from fase where id = v_atual.fase_id;

  -- Todas as Lenhas de Forja da fase precisam estar concluídas/canceladas.
  select count(*) into v_pendentes
  from lenha
  where fase_da_forja_id = v_atual.id
    and status not in ('concluida', 'cancelada');

  if v_pendentes > 0 then
    raise exception
      'Não é possível avançar: % Lenha(s) de Forja pendente(s) na fase %',
      v_pendentes, v_fase.nome;
  end if;

  -- Fecha a fase atual.
  update fase_da_forja
    set status = 'concluida', data_realizada_fim = now()::date
    where id = v_atual.id;

  -- Próxima fase por ordem.
  select * into v_prox
  from fase_da_forja
  where forja_id = p_forja_id and ordem = v_atual.ordem + 1;

  if found then
    update fase_da_forja
      set status = 'em_andamento', data_realizada_inicio = now()::date
      where id = v_prox.id;
    update forja set fase_atual_id = v_prox.id where id = p_forja_id;
  else
    -- Era a 7ª fase: Forja concluída.
    update forja set concluida = true where id = p_forja_id;
  end if;
end;
$$;

comment on function app.avancar_fase(uuid) is
  'Regra 3: conclui a fase atual (checklist ok) e move o ponteiro; nunca automático.';


-- ┌── supabase/migrations/0007_auth_e_rls.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0007 — Auth helpers + Row Level Security
-- ─────────────────────────────────────────────────────────────
-- Modelo: leitura ampla (todo membro ativo lê tudo); escrita por papel + admin.
-- Base: docs/modelo-de-dados.md § Permissões por papel.
--
-- O membro é resolvido pelo claim `email` do JWT (Google SSO) contra a
-- allowlist `membro.email`. As policies miram o papel `authenticated`; o
-- `service_role` (integração ClickUp / jobs server-side) bypassa RLS.

-- ── Helpers (SECURITY DEFINER: leem membro sem recursão de RLS) ─
create or replace function app.jwt_email()
returns citext
language sql stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
  '')::citext
$$;

create or replace function app.current_membro_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.id from public.membro m
  where m.email = app.jwt_email() and m.ativo
  limit 1
$$;

create or replace function app.is_membro()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select app.current_membro_id() is not null
$$;

create or replace function app.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select m.is_admin from public.membro m
     where m.email = app.jwt_email() and m.ativo limit 1),
  false)
$$;

create or replace function app.has_papel(p papel)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.membro m
    join public.membro_papel mp on mp.membro_id = m.id
    where m.email = app.jwt_email() and m.ativo and mp.papel = p
  )
$$;

-- ── Habilita RLS em todas as tabelas ─────────────────────────
alter table membro            enable row level security;
alter table membro_papel      enable row level security;
alter table rotina            enable row level security;
alter table rotina_papel      enable row level security;
alter table cria              enable row level security;
alter table contrato          enable row level security;
alter table comentario        enable row level security;
alter table fase              enable row level security;
alter table fase_lenha_padrao enable row level security;
alter table forja             enable row level security;
alter table fase_da_forja     enable row level security;
alter table gargalo           enable row level security;
alter table plano_de_acao     enable row level security;
alter table plano_passo       enable row level security;
alter table briefing          enable row level security;
alter table lenha             enable row level security;

-- ── Leitura ampla: todo membro ativo lê tudo ─────────────────
create policy p_read on membro            for select to authenticated using (app.is_membro());
create policy p_read on membro_papel      for select to authenticated using (app.is_membro());
create policy p_read on rotina            for select to authenticated using (app.is_membro());
create policy p_read on rotina_papel      for select to authenticated using (app.is_membro());
create policy p_read on cria              for select to authenticated using (app.is_membro());
create policy p_read on contrato          for select to authenticated using (app.is_membro());
create policy p_read on comentario        for select to authenticated using (app.is_membro());
create policy p_read on fase              for select to authenticated using (app.is_membro());
create policy p_read on fase_lenha_padrao for select to authenticated using (app.is_membro());
create policy p_read on forja             for select to authenticated using (app.is_membro());
create policy p_read on fase_da_forja     for select to authenticated using (app.is_membro());
create policy p_read on gargalo           for select to authenticated using (app.is_membro());
create policy p_read on plano_de_acao     for select to authenticated using (app.is_membro());
create policy p_read on plano_passo       for select to authenticated using (app.is_membro());
create policy p_read on briefing          for select to authenticated using (app.is_membro());
create policy p_read on lenha             for select to authenticated using (app.is_membro());

-- ── Admin: gestão de membros, rotinas e catálogos ────────────
create policy p_admin_all on membro            for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on membro_papel      for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on rotina            for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on rotina_papel      for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on fase              for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on fase_lenha_padrao for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ── cria: Contas/Admin criam e editam; Tráfego edita mídia ───
-- Refinamento de coluna (Tráfego só mexe em investimento_midia) é reforçado
-- na camada de API — RLS aqui é a nível de linha/comando.
create policy p_cria_ins on cria for insert to authenticated
  with check (app.has_papel('gestor_contas') or app.is_admin());
create policy p_cria_upd on cria for update to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_trafego') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_trafego') or app.is_admin());
create policy p_cria_del on cria for delete to authenticated
  using (app.is_admin());

-- ── contrato: Contas/Admin ───────────────────────────────────
create policy p_contrato_write on contrato for all to authenticated
  using (app.has_papel('gestor_contas') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.is_admin());

-- ── comentário: Contas/Projetos/Admin; sempre como o próprio autor ─
create policy p_coment_ins on comentario for insert to authenticated
  with check (
    (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
    and autor_id = app.current_membro_id()
  );
create policy p_coment_mod on comentario for update to authenticated
  using (autor_id = app.current_membro_id() or app.is_admin())
  with check (autor_id = app.current_membro_id() or app.is_admin());
create policy p_coment_del on comentario for delete to authenticated
  using (autor_id = app.current_membro_id() or app.is_admin());

-- ── forja / fase_da_forja: Projetos/Admin movem/editam ───────
create policy p_forja_upd on forja for update to authenticated
  using (app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_projetos') or app.is_admin());
create policy p_fdf_upd on fase_da_forja for update to authenticated
  using (app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_projetos') or app.is_admin());

-- ── gargalo + plano + passo: Contas/Projetos/Admin ───────────
create policy p_gargalo_write on gargalo for all to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin());
create policy p_plano_write on plano_de_acao for all to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin());
create policy p_passo_write on plano_passo for all to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin());

-- ── briefing: Contas/Projetos/Admin; INSERT como o próprio autor ─
create policy p_brief_ins on briefing for insert to authenticated
  with check (
    (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
    and autor_id = app.current_membro_id()
  );
create policy p_brief_mod on briefing for update to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin());
create policy p_brief_del on briefing for delete to authenticated
  using (autor_id = app.current_membro_id() or app.is_admin());

-- ── lenha: criar/distribuir Forja = Projetos/Admin; concluir a
--    PRÓPRIA lenha (Forja ou Rotina) = qualquer papel dono dela ──
create policy p_lenha_ins on lenha for insert to authenticated
  with check (
    (tipo = 'forja'  and (app.has_papel('gestor_projetos') or app.is_admin()))
    or (tipo = 'rotina' and app.is_membro())
  );
-- Update: dono da lenha muda o status dela; Projetos/Admin gerenciam de fato.
create policy p_lenha_upd on lenha for update to authenticated
  using (
    responsavel_id = app.current_membro_id()
    or app.has_papel('gestor_projetos') or app.is_admin()
  )
  with check (
    responsavel_id = app.current_membro_id()
    or app.has_papel('gestor_projetos') or app.is_admin()
  );
create policy p_lenha_del on lenha for delete to authenticated
  using (app.has_papel('gestor_projetos') or app.is_admin());


-- ┌── supabase/migrations/0008_grants.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0008 — Grants para os papéis da API (Supabase)
-- ─────────────────────────────────────────────────────────────
-- Privilégio = "pode tentar"; RLS (0007) = "quais linhas". Os papéis
-- anon/authenticated/service_role são providos pelo Supabase; a integração
-- server-side usa service_role (BYPASSRLS) para o sync do ClickUp.

grant usage on schema app to anon, authenticated, service_role;
grant execute on all functions in schema app to anon, authenticated, service_role;
alter default privileges in schema app
  grant execute on functions to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;

-- authenticated e service_role operam nas tabelas; RLS filtra as linhas.
grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant usage, select on all sequences in schema public
  to authenticated, service_role;

-- Tabelas/sequences futuras herdam os mesmos grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;


-- ┌── supabase/migrations/0009_rpc_publicas.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0009 — RPCs públicas (expostas ao PostgREST/supabase-js)
-- ─────────────────────────────────────────────────────────────
-- O PostgREST só expõe o schema `public`. As regras vivem em `app` (SECURITY
-- DEFINER + guard de papel); aqui vão wrappers finos pra chamar via supabase.rpc.

-- Avançar a fase da Forja (checklist + gate de papel são checados em app.*).
create or replace function public.avancar_fase(p_forja_id uuid)
returns void
language sql
security invoker
as $$
  select app.avancar_fase(p_forja_id);
$$;

comment on function public.avancar_fase(uuid) is
  'Wrapper público de app.avancar_fase (regra 3). Autorização é feita lá dentro.';

grant execute on function public.avancar_fase(uuid) to authenticated;

-- Confirmar contrato → dispara a cascata de prazos (via trigger de contrato).
-- Exposto como RPC pra UI confirmar sem depender de update direto na tabela.
create or replace function public.confirmar_contrato(p_contrato_id uuid)
returns void
language sql
security invoker
as $$
  update contrato set confirmado = true where id = p_contrato_id;
$$;

comment on function public.confirmar_contrato(uuid) is
  'Marca o contrato como confirmado; o trigger calcula os prazos. RLS de contrato aplica.';

grant execute on function public.confirmar_contrato(uuid) to authenticated;


-- ┌── supabase/migrations/0010_motor_recorrencia.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0010 — Motor de recorrência (Lenhas de Rotina do dia)
-- ─────────────────────────────────────────────────────────────
-- A partir de `rotina` (ativa) + `rotina_papel`, gera as lenha(tipo=rotina)
-- do dia para cada membro do(s) papel(is). Idempotente por (rotina, membro, dia).

-- Idempotência: no máximo 1 ocorrência por rotina/membro/dia.
create unique index if not exists uq_lenha_rotina_ocorrencia
  on lenha (rotina_id, responsavel_id, data_referencia)
  where tipo = 'rotina';

create or replace function app.gerar_lenhas_do_dia(p_data date default current_date)
returns int
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_dow  int  := extract(dow from p_data)::int;                 -- 0=dom .. 6=sab
  v_dia  text := (array['dom','seg','ter','qua','qui','sex','sab'])[v_dow + 1];
  v_criadas int := 0;
  r record;
  m record;
  v_fires boolean;
begin
  for r in select * from rotina where ativo loop
    v_fires := case r.recorrencia_tipo
      when 'diaria'         then true
      when 'semanal'        then (r.recorrencia_config->>'dia') = v_dia
      when 'dias_da_semana' then (r.recorrencia_config->'dias') ? v_dia
      when 'mensal'         then extract(day from p_data)::int
                                 = coalesce((r.recorrencia_config->>'dia_mes')::int, -1)
      else false  -- sprint: âncora do ciclo ainda a definir (parqueado)
    end;
    if not v_fires then continue; end if;

    -- Alvo: membros ativos que têm algum papel listado em rotina_papel da rotina.
    for m in
      select distinct mb.id
      from membro mb
      join membro_papel mp on mp.membro_id = mb.id
      join rotina_papel rp on rp.papel = mp.papel and rp.rotina_id = r.id
      where mb.ativo
    loop
      insert into lenha (tipo, titulo, rotina_id, responsavel_id, data_referencia)
      values ('rotina', r.titulo, r.id, m.id, p_data)
      on conflict (rotina_id, responsavel_id, data_referencia)
        where tipo = 'rotina'
        do nothing;
      if found then v_criadas := v_criadas + 1; end if;
    end loop;
  end loop;

  return v_criadas;
end;
$$;

comment on function app.gerar_lenhas_do_dia(date) is
  'Motor de recorrência: gera as Lenhas de Rotina do dia por papel (idempotente).';

-- Wrapper para o cron/serviço (service_role). Não exposto a usuários comuns.
create or replace function public.gerar_lenhas_do_dia(p_data date default current_date)
returns int
language sql
security invoker
as $$
  select app.gerar_lenhas_do_dia(p_data);
$$;

revoke all on function public.gerar_lenhas_do_dia(date) from public;
grant execute on function public.gerar_lenhas_do_dia(date) to service_role;


-- ┌── supabase/migrations/0011_guarda_coluna_e_risco.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0011 — Guard de coluna (mídia) + derivação de em_risco
-- ─────────────────────────────────────────────────────────────
-- Refina a matriz de permissões: RLS libera Tráfego a atualizar a Cria, mas
-- só a coluna de mídia. Como RLS não é por coluna, o guard vive num trigger.

create or replace function app.guarda_coluna_cria()
returns trigger
language plpgsql
as $$
begin
  -- Sistema/serviço (sem JWT), Admin ou Contas: sem restrição de coluna.
  if app.jwt_email() is null or app.is_admin() or app.has_papel('gestor_contas') then
    return new;
  end if;

  -- Usuário é Tráfego (e não Contas/Admin): só investimento_midia pode mudar.
  if app.has_papel('gestor_trafego') then
    if row(new.nome_cliente, new.email, new.telefone_whatsapp, new.area_atuacao,
            new.produto, new.closer, new.gestor_contas_id, new.status, new.em_risco,
            new.clickup_task_id, new.clickup_squad, new.clickup_semana)
       is distinct from
       row(old.nome_cliente, old.email, old.telefone_whatsapp, old.area_atuacao,
            old.produto, old.closer, old.gestor_contas_id, old.status, old.em_risco,
            old.clickup_task_id, old.clickup_squad, old.clickup_semana)
    then
      raise exception 'Tráfego só pode editar investimento_midia da Cria';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_cria_guarda_coluna
  before update on cria
  for each row execute function app.guarda_coluna_cria();

-- ── Derivação de em_risco por SLA de fase ────────────────────
-- em_risco = existe fase não concluída com prazo previsto estourado.
-- Recompute total (idempotente); também LIMPA quem deixou de estar em risco.
-- (NPS baixo entra aqui como segunda fonte quando a entidade nps existir.)
create or replace function app.recalcular_em_risco()
returns int
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare v_afetadas int;
begin
  with risco as (
    select distinct f.cria_id
    from forja f
    join fase_da_forja fdf on fdf.forja_id = f.id
    where fdf.status <> 'concluida'
      and fdf.data_prevista_fim is not null
      and now()::date > fdf.data_prevista_fim
  )
  update cria c
     set em_risco = (c.id in (select cria_id from risco))
   where c.em_risco is distinct from (c.id in (select cria_id from risco));
  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;

comment on function app.recalcular_em_risco() is
  'Recalcula cria.em_risco por SLA de fase vencida (idempotente; limpa quem saiu do risco).';

-- Wrapper para cron/serviço (service_role), fora do alcance de usuários comuns.
create or replace function public.recalcular_em_risco()
returns int
language sql
security invoker
as $$
  select app.recalcular_em_risco();
$$;

revoke all on function public.recalcular_em_risco() from public;
grant execute on function public.recalcular_em_risco() to service_role;


-- ┌── supabase/seed.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · seed — catálogos fixos + rotinas + admin inicial
-- ─────────────────────────────────────────────────────────────
-- Rode depois das migrations, num banco limpo. Idempotência simples via
-- `on conflict do nothing` nas chaves naturais (ordem/titulo/email).

-- ── 1) Catálogo das 7 fases da Estruturação ──────────────────
insert into fase (ordem, nome, duracao_dias, is_gate, gate_descricao) values
  (1, 'Alinhamento / Boas-vindas',          7, true,  'Formulário Diagnóstico respondido'),
  (2, 'Diagnóstico 360',                     7, false, null),
  (3, 'Treinamento Comercial (equipe)',      7, false, null),
  (4, 'Consultoria Comercial (sócios)',      7, false, null),
  (5, 'Implementação CRM + IA',              7, false, null),
  (6, 'Auditoria de Mídia',                  7, false, null),
  (7, 'Auditoria Criativa',                  7, false, null)
on conflict (ordem) do nothing;

-- ── 2) Lenhas de Forja padrão por fase (checklist) ───────────
-- Fases 1–2 concretas (spec 3.3); 3–7 placeholder até o Felipe detalhar.
insert into fase_lenha_padrao (fase_id, ordem, titulo)
select f.id, v.ordem, v.titulo
from (values
  (1, 1, 'Reunião de alinhamento'),
  (1, 2, 'Enviar Formulário de Acesso'),
  (1, 3, 'Enviar Formulário Diagnóstico'),
  (2, 1, 'Elaborar documento Diagnóstico 360 (gargalos + planos)'),
  (2, 2, 'Reunião de fechamento'),
  (2, 3, 'Enviar PDF do Diagnóstico ao cliente'),
  (3, 1, 'Entregável do Treinamento Comercial (a detalhar)'),
  (4, 1, 'Entregável da Consultoria Comercial (a detalhar)'),
  (5, 1, 'Entregável da Implementação CRM + IA (a detalhar)'),
  (6, 1, 'Entregável da Auditoria de Mídia — inclui Google Meu Negócio (a detalhar)'),
  (7, 1, 'Entregável da Auditoria Criativa (a detalhar)')
) as v(fase_ordem, ordem, titulo)
join fase f on f.ordem = v.fase_ordem
on conflict (fase_id, ordem) do nothing;

-- ── 3) Rotinas (catálogo do motor de recorrência) ────────────
-- ativo=true → cadência fechada (doc/POP/confirmado).
-- ativo=false → cadência ainda "a definir" (parqueada em rotinas.md); catalogada
--   mas sem gerar Lenha até a squad confirmar.

-- Coletivas (toda a squad)
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Daily (alinhamento interno)',        'coletiva', 'diaria',  '{}'::jsonb,                true),
  ('Weekly (alinhamento da squad)',      'coletiva', 'semanal', '{"dia":"sex"}'::jsonb,     true),
  ('Planilha BSC',                       'coletiva', 'semanal', '{"dia":"sex"}'::jsonb,     true)
on conflict do nothing;

-- Subconjunto (Projetos + Tráfego)
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Atualizar relatório interno no ClickUp (briefing semanal)', 'subconjunto', 'semanal', '{"dia":"qui"}'::jsonb, true)
on conflict do nothing;

-- Gestor de Projetos (individual)
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Comunicação ativa nos grupos',                 'individual', 'diaria',  '{}'::jsonb,             true),
  ('Execução das demandas (copys, planilhas, NPS)','individual', 'diaria',  '{}'::jsonb,             true),
  ('Acompanhamento + pontuação de pendências',     'individual', 'diaria',  '{}'::jsonb,             true),
  ('Relatório diário (Projetos)',                  'individual', 'diaria',  '{}'::jsonb,             true),
  ('Envio de relatórios pelo criativo',            'individual', 'semanal', '{"dia":"seg"}'::jsonb,  true),
  ('Relatório de saúde do projeto no ClickUp',     'individual', 'semanal', '{"dia":"qui"}'::jsonb,  true),
  ('Relatório semanal (Projetos)',                 'individual', 'semanal', '{"dia":"sex"}'::jsonb,  true),
  ('Medir NPS',                                    'individual', 'mensal',  '{"dia_mes":1}'::jsonb,  false), -- dia do mês a definir
  ('Ciclo de sprint S1→S4',                        'individual', 'sprint',  '{"ciclo_semanas":4}'::jsonb, false) -- data-âncora a definir
on conflict do nothing;

-- Gestor de Contas (individual)
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Relatório diário das tarefas (fim de expediente)', 'individual', 'diaria',  '{}'::jsonb,            true),
  ('Check-in com cada Cria',                           'individual', 'semanal', '{"dia":"seg"}'::jsonb, true) -- dia default, ajustável (ou por Cria)
on conflict do nothing;

-- Gestor de Tráfego (individual) — cadências propostas, ainda a confirmar
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Checar campanhas ativas (gasto/CPL/performance)', 'individual', 'diaria',  '{}'::jsonb,        false),
  ('Otimizar / ajustar campanhas',                    'individual', 'diaria',  '{}'::jsonb,        false),
  ('Relatório de métricas de tráfego',                'individual', 'semanal', '{"dia":"sex"}'::jsonb, false)
on conflict do nothing;

-- ── 4) rotina_papel (a quais papéis cada rotina se atribui) ──
-- Coletivas → todos os papéis.
insert into rotina_papel (rotina_id, papel)
select r.id, p.papel
from rotina r
cross join (values ('gestor_contas'::papel), ('gestor_projetos'::papel), ('gestor_trafego'::papel)) as p(papel)
where r.escopo = 'coletiva'
on conflict do nothing;

-- Subconjunto (relatório interno) → Projetos + Tráfego.
insert into rotina_papel (rotina_id, papel)
select r.id, p.papel
from rotina r
cross join (values ('gestor_projetos'::papel), ('gestor_trafego'::papel)) as p(papel)
where r.titulo = 'Atualizar relatório interno no ClickUp (briefing semanal)'
on conflict do nothing;

-- Individuais → papel correspondente ao grupo da rotina.
insert into rotina_papel (rotina_id, papel)
select r.id, 'gestor_projetos'::papel from rotina r where r.escopo = 'individual' and r.titulo in (
  'Comunicação ativa nos grupos','Execução das demandas (copys, planilhas, NPS)',
  'Acompanhamento + pontuação de pendências','Relatório diário (Projetos)',
  'Envio de relatórios pelo criativo','Relatório de saúde do projeto no ClickUp',
  'Relatório semanal (Projetos)','Medir NPS','Ciclo de sprint S1→S4')
on conflict do nothing;

insert into rotina_papel (rotina_id, papel)
select r.id, 'gestor_contas'::papel from rotina r where r.escopo = 'individual' and r.titulo in (
  'Relatório diário das tarefas (fim de expediente)','Check-in com cada Cria')
on conflict do nothing;

insert into rotina_papel (rotina_id, papel)
select r.id, 'gestor_trafego'::papel from rotina r where r.escopo = 'individual' and r.titulo in (
  'Checar campanhas ativas (gasto/CPL/performance)','Otimizar / ajustar campanhas',
  'Relatório de métricas de tráfego')
on conflict do nothing;

-- ── 5) Admin inicial (allowlist) ─────────────────────────────
-- O dono do workspace entra como admin para configurar o resto da squad pela UI.
-- Ajuste o email/nome e adicione os demais membros (Contas, Projetos, Tráfego).
-- O membro_papel do papel_primario é criado automaticamente pelo trigger
-- trg_membro_sync_papel (regra 6).
insert into membro (nome, email, papel_primario, is_admin, ativo) values
  ('Felipe Carvalho', 'e3digital.software@gmail.com', 'gestor_projetos', true, true)
on conflict (email) do nothing;


-- ┌── supabase/storage.sql
-- ─────────────────────────────────────────────────────────────
-- SquadFire · Storage — buckets + policies (rodar SÓ no Supabase real)
-- ─────────────────────────────────────────────────────────────
-- FORA de migrations/ de propósito: o schema `storage` só existe no Supabase,
-- não no Postgres puro do CI. Aplique este arquivo no SQL Editor (ou psql)
-- depois das migrations. Buckets privados; acesso restrito a membros da squad.

insert into storage.buckets (id, name, public) values
  ('contratos',   'contratos',   false),
  ('briefings',   'briefings',   false),
  ('entregaveis', 'entregaveis', false)
on conflict (id) do nothing;

-- Membros ativos da squad leem/gravam nos buckets internos (usa app.is_membro,
-- criado nas migrations). O service_role (server-side) bypassa isto.
create policy "squad_le_storage" on storage.objects for select to authenticated
  using (bucket_id in ('contratos','briefings','entregaveis') and app.is_membro());

create policy "squad_grava_storage" on storage.objects for insert to authenticated
  with check (bucket_id in ('contratos','briefings','entregaveis') and app.is_membro());

create policy "squad_atualiza_storage" on storage.objects for update to authenticated
  using (bucket_id in ('contratos','briefings','entregaveis') and app.is_membro());

create policy "squad_remove_storage" on storage.objects for delete to authenticated
  using (bucket_id in ('contratos','briefings','entregaveis') and app.is_membro());



-- ┌── supabase/migrations/0012_lenha_avulsa.sql
-- ─────────────────────────────────────────────────────────────
-- Lenha avulsa — "tarefas do dia" criáveis e delegáveis por qualquer membro.
alter type tipo_lenha add value if not exists 'avulsa';

alter table lenha drop constraint if exists lenha_tipo_coerente;
alter table lenha add constraint lenha_tipo_coerente check (
  (tipo = 'forja'  and fase_da_forja_id is not null and rotina_id is null) or
  (tipo = 'rotina' and rotina_id is not null and fase_da_forja_id is null) or
  (tipo not in ('forja','rotina') and fase_da_forja_id is null and rotina_id is null)
);

drop policy if exists p_lenha_ins on lenha;
create policy p_lenha_ins on lenha for insert to authenticated
  with check (
    (fase_da_forja_id is not null and (app.has_papel('gestor_projetos') or app.is_admin()))
    or (fase_da_forja_id is null and app.is_membro())
  );


-- ┌── supabase/migrations/0013_rpc_iniciar_forja.sql
-- ─────────────────────────────────────────────────────────────
-- RPC pública para iniciar a Forja (data de início → cascata de prazos).
create or replace function public.iniciar_forja(p_cria_id uuid, p_data date)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja uuid;
begin
  if not (app.has_papel('gestor_projetos') or app.is_admin()) then
    raise exception 'sem permissão para iniciar a Forja' using errcode = '42501';
  end if;
  select id into v_forja from forja where cria_id = p_cria_id;
  if v_forja is null then
    raise exception 'Forja não encontrada para a Cria %', p_cria_id;
  end if;
  perform app.aplicar_data_inicio(v_forja, p_data);
end;
$$;
revoke all on function public.iniciar_forja(uuid, date) from public;
grant execute on function public.iniciar_forja(uuid, date) to authenticated;


-- ┌── supabase/migrations/0015_rotina_diaria_dias_uteis.sql
-- ─────────────────────────────────────────────────────────────
-- Rotina diária = dias úteis (seg–sex).
create or replace function app.gerar_lenhas_do_dia(p_data date default current_date)
returns int
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_dow  int  := extract(dow from p_data)::int;
  v_dia  text := (array['dom','seg','ter','qua','qui','sex','sab'])[v_dow + 1];
  v_criadas int := 0;
  r record; m record; v_fires boolean;
begin
  for r in select * from rotina where ativo loop
    v_fires := case r.recorrencia_tipo
      when 'diaria'         then v_dow between 1 and 5
      when 'semanal'        then (r.recorrencia_config->>'dia') = v_dia
      when 'dias_da_semana' then (r.recorrencia_config->'dias') ? v_dia
      when 'mensal'         then extract(day from p_data)::int
                                 = coalesce((r.recorrencia_config->>'dia_mes')::int, -1)
      else false
    end;
    if not v_fires then continue; end if;
    for m in
      select distinct mb.id from membro mb
      join membro_papel mp on mp.membro_id = mb.id
      join rotina_papel rp on rp.papel = mp.papel and rp.rotina_id = r.id
      where mb.ativo
    loop
      insert into lenha (tipo, titulo, rotina_id, responsavel_id, data_referencia)
      values ('rotina', r.titulo, r.id, m.id, p_data)
      on conflict (rotina_id, responsavel_id, data_referencia) where tipo = 'rotina' do nothing;
      if found then v_criadas := v_criadas + 1; end if;
    end loop;
  end loop;
  return v_criadas;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- ┌── supabase/migrations/0016_preferencia_e_conta.sql
-- SquadFire · 0016 — Preferências do membro + editar a própria Conta
-- ─────────────────────────────────────────────────────────────
-- A Forjaria (Configurações) guardava tudo só no localStorage. Aqui as
-- preferências passam a persistir no banco (uma linha por membro, jsonb) e o
-- membro pode editar o próprio nome/papel primário via RPC (a tabela membro
-- é admin-only na RLS — o RPC dá o self-service sem afrouxar isso).

-- ── preferencia (1 linha por membro) ─────────────────────────
-- dados (jsonb) guarda o bloco de preferências da Forjaria:
--   { notif:{...}, canais:{...}, ia:{...}, forja:{...}, sla:int, twofa:bool }
-- Aparência (tema/densidade/animações) fica no localStorage de propósito:
-- precisa ser aplicada antes da primeira pintura, sem ida ao banco.
create table if not exists preferencia (
  membro_id  uuid primary key references membro(id) on delete cascade,
  dados      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table preferencia is
  'Preferências da Forjaria por membro (notificações, IA, Forja, SLA, 2FA). Aparência fica no cliente.';

drop trigger if exists trg_preferencia_updated_at on preferencia;
create trigger trg_preferencia_updated_at
  before update on preferencia
  for each row execute function app.set_updated_at();

alter table preferencia enable row level security;

-- Cada membro lê e escreve APENAS a própria linha.
drop policy if exists p_pref_self on preferencia;
create policy p_pref_self on preferencia for all to authenticated
  using (membro_id = app.current_membro_id())
  with check (membro_id = app.current_membro_id());

-- ── RPC: editar a própria Conta (nome + papel primário) ──────
-- A tabela membro é admin-only na RLS; este RPC (SECURITY DEFINER) deixa o
-- membro ajustar só o próprio registro. Trocar o papel primário define a
-- tela-casa do Covil; o trigger trg_membro_sync_papel garante a linha em
-- membro_papel. Squad é allowlist confiável — self-service é intencional.
create or replace function public.atualizar_minha_conta(p_nome text, p_papel papel)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_id uuid := app.current_membro_id();
begin
  if v_id is null then
    raise exception 'membro não identificado' using errcode = '42501';
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome não pode ser vazio';
  end if;
  update membro
     set nome = btrim(p_nome),
         papel_primario = p_papel
   where id = v_id;
end;
$$;

comment on function public.atualizar_minha_conta(text, papel) is
  'Membro edita o próprio nome e papel primário (a tabela membro é admin-only na RLS).';

revoke all on function public.atualizar_minha_conta(text, papel) from public;
grant execute on function public.atualizar_minha_conta(text, papel) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- ┌── supabase/migrations/0017_comentario_clickup.sql
-- SquadFire · 0017 — Comentário ↔ ClickUp (base do two-way)
-- ─────────────────────────────────────────────────────────────
-- Os comentários do sistema (registro contínuo da Cria + notas da Roda de
-- Fogo) passam a espelhar como COMENTÁRIO na task-mestre do cliente no
-- ClickUp. Guardamos o id do comentário lá e a origem — pra, no sentido
-- inverso (ClickUp → CRM), não reenviar o que veio de lá (anti-eco).

alter table comentario
  add column if not exists clickup_comment_id text,
  add column if not exists origem text not null default 'crm';

comment on column comentario.origem is
  'crm = criado no sistema (espelha no ClickUp); clickup = importado do ClickUp (não reenviar).';

-- ─────────────────────────────────────────────────────────────
-- ┌── supabase/migrations/0018_diagnostico_cria.sql
-- SquadFire · 0018 — Diagnóstico 360 (PDF) na Cria
-- ─────────────────────────────────────────────────────────────
-- A Cria ganha o vínculo com o PDF do Diagnóstico 360 (todas as informações
-- do cliente). Guardamos o PATH no Storage (bucket privado) — a URL assinada é
-- gerada na hora de exibir. O Contrato continua na tabela `contrato`
-- (arquivo_url), então não precisa de coluna aqui.

alter table cria
  add column if not exists diagnostico_path text,
  add column if not exists diagnostico_nome text;

comment on column cria.diagnostico_path is
  'Caminho do PDF do Diagnóstico 360 no Storage (bucket entregaveis). URL assinada gerada ao exibir.';

-- ─────────────────────────────────────────────────────────────
-- ┌── supabase/migrations/0019_integracao_clickup.sql
-- SquadFire · 0019 — Config do webhook do ClickUp (secret no banco)
-- ─────────────────────────────────────────────────────────────
-- Guarda o id + secret do webhook do ClickUp numa linha única. Assim o botão
-- "Ativar tempo real" na Forjaria registra o webhook e grava o secret aqui —
-- sem precisar setar env nem fazer redeploy. A verificação da assinatura lê
-- este secret (com fallback pra env CLICKUP_WEBHOOK_SECRET).

create table if not exists integracao_clickup (
  id             boolean primary key default true,
  webhook_id     text,
  webhook_secret text,
  atualizado_em  timestamptz not null default now(),
  constraint integracao_clickup_singleton check (id)
);

comment on table integracao_clickup is
  'Config do webhook do ClickUp (id + secret), uma linha só. Secret é sensível: leitura só admin; escrita via service_role.';

alter table integracao_clickup enable row level security;

-- Só admin lê (o secret é sensível). Escrita é sempre via service_role (bypassa RLS).
drop policy if exists p_intg_cu_read on integracao_clickup;
create policy p_intg_cu_read on integracao_clickup for select to authenticated
  using (app.is_admin());
