-- 0014 · Integração Google Agenda — tokens OAuth por membro.
-- Os tokens são SENSÍVEIS: ninguém acessa via PostgREST. RLS ligada sem policy
-- para authenticated/anon → só o service_role (server, bypassa RLS) lê/escreve.

create table if not exists integracao_google (
  membro_id     uuid primary key references membro(id) on delete cascade,
  email         text,
  access_token  text not null,
  refresh_token text,
  expiry        timestamptz,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table integracao_google is
  'Tokens OAuth do Google Agenda por membro. Server-only (service_role); RLS sem policy.';

alter table integracao_google enable row level security;

-- Ninguém autenticado/anon toca aqui — só o service_role (server-side).
revoke all on integracao_google from anon, authenticated;
grant all on integracao_google to service_role;

create trigger trg_integracao_google_updated_at
  before update on integracao_google
  for each row execute function app.set_updated_at();
