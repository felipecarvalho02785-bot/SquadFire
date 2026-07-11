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
