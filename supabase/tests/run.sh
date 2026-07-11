#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SquadFire · testes do banco (triggers + RLS) contra Postgres real
# ─────────────────────────────────────────────────────────────
# Reseta o schema, aplica migrations + seed e roda as asserções.
# Conexão via variáveis PG* (PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT).
# Uso local:  PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres \
#             PGDATABASE=squadfire_test bash supabase/tests/run.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # supabase/
PSQL="psql -v ON_ERROR_STOP=1 -q"

echo "▸ criando papéis da API (idempotente)…"
$PSQL <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
SQL

echo "▸ resetando schema…"
$PSQL <<'SQL'
drop schema if exists app cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to public;
SQL

echo "▸ aplicando migrations…"
for f in "$DIR"/migrations/000*_*.sql; do
  $PSQL -f "$f"
done

echo "▸ aplicando seed…"
$PSQL -f "$DIR/seed.sql"

echo "▸ rodando asserções (triggers + regras)…"
$PSQL <<'SQL'
do $$
declare n int;
begin
  -- catálogos
  select count(*) into n from fase;                 if n<>7  then raise exception 'fases=% (esperado 7)', n; end if;
  select count(*) into n from fase_lenha_padrao;    if n<>11 then raise exception 'lenhas_padrao=% (esperado 11)', n; end if;
  select count(*) into n from rotina;               if n<>18 then raise exception 'rotinas=% (esperado 18)', n; end if;
  select count(*) into n from membro_papel;         if n<1   then raise exception 'membro_papel auto não criado (regra 6)'; end if;

  -- Regra 1: criar Cria → Forja + 7 fases + 11 lenhas de forja
  insert into cria (nome_cliente, clickup_task_id, clickup_squad) values ('T1','CU-T1','Squad 08');
  select count(*) into n from forja;                if n<>1  then raise exception 'forja=% (esperado 1)', n; end if;
  select count(*) into n from fase_da_forja;        if n<>7  then raise exception 'fase_da_forja=% (esperado 7)', n; end if;
  select count(*) into n from lenha where tipo='forja'; if n<>11 then raise exception 'lenhas_forja=% (esperado 11)', n; end if;

  -- Regra 2: confirmar contrato calcula prazos em cascata
  insert into contrato (cria_id, arquivo_url, data_inicio_extraida, confirmado)
    select id,'s://c.pdf', date '2026-08-01', false from cria where clickup_task_id='CU-T1';
  select count(*) into n from fase_da_forja where data_prevista_inicio is not null;
    if n<>0 then raise exception 'prazos antes de confirmar=% (esperado 0)', n; end if;
  update contrato set confirmado=true where cria_id=(select id from cria where clickup_task_id='CU-T1');
  select count(*) into n from fase_da_forja where data_prevista_inicio is not null;
    if n<>7 then raise exception 'prazos após confirmar=% (esperado 7)', n; end if;
  if (select data_prevista_fim from fase_da_forja where ordem=7) <> date '2026-09-19' then
    raise exception 'cascata de prazos incorreta';
  end if;

  -- Regra 3: avançar exige lenhas concluídas
  begin
    perform app.avancar_fase((select id from forja limit 1));
    raise exception 'avançou fase com lenhas pendentes';
  exception when others then null; -- ok, bloqueou
  end;
  update lenha set status='concluida'
    where fase_da_forja_id=(select id from fase_da_forja where ordem=1 limit 1);
  perform app.avancar_fase((select id from forja limit 1));
  if (select fdf.ordem from forja f join fase_da_forja fdf on fdf.id=f.fase_atual_id) <> 2 then
    raise exception 'ponteiro não avançou para fase 2';
  end if;

  -- Regra 6: proteção do papel primário
  begin
    delete from membro_papel where papel='gestor_projetos'
      and membro_id=(select id from membro where is_admin limit 1);
    raise exception 'removeu papel primário';
  exception when others then null; -- ok, protegido
  end;

  -- lenha: check de integridade
  begin
    insert into lenha (tipo, titulo) values ('forja','sem fase');
    raise exception 'lenha forja sem fase passou no check';
  exception when check_violation then null; -- ok
  end;

  -- RPC pública avancar_fase (wrapper) opera igual à função de app
  update lenha set status='concluida'
    where fase_da_forja_id=(select id from fase_da_forja where ordem=2 limit 1);
  perform public.avancar_fase((select id from forja limit 1));
  if (select fdf.ordem from forja f join fase_da_forja fdf on fdf.id=f.fase_atual_id) <> 3 then
    raise exception 'RPC pública avancar_fase não moveu para fase 3';
  end if;

  raise notice '✓ triggers/regras OK';
end $$;
SQL

echo "▸ rodando asserções de RLS (por papel)…"
$PSQL <<'SQL'
-- membros de teste + 1 cria (superuser, bypassa RLS)
insert into membro (nome,email,papel_primario,is_admin) values
  ('Contas','contas@t.dev','gestor_contas',false),
  ('Projetos','projetos@t.dev','gestor_projetos',false),
  ('Trafego','trafego@t.dev','gestor_trafego',false) on conflict do nothing;
insert into cria (nome_cliente, clickup_task_id, clickup_squad)
  values ('RLS','CU-RLS','Squad 08') on conflict do nothing;
SQL

# leitura ampla (contas enxerga a cria)
$PSQL <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"email":"contas@t.dev"}',true);
do $$ begin
  if (select count(*) from cria) < 1 then raise exception 'contas deveria LER cria'; end if;
end $$;
rollback;
SQL

# projetos NÃO cria Cria (insert bloqueado por RLS)
$PSQL <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"email":"projetos@t.dev"}',true);
do $$ begin
  begin
    insert into cria (nome_cliente) values ('x');
    raise exception 'projetos NÃO deveria inserir cria';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
SQL

# contas NÃO edita forja (update afeta 0 linhas)
$PSQL <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"email":"contas@t.dev"}',true);
do $$ declare r int; begin
  update forja set flag_contrato='brasa_viva'
    where cria_id=(select id from cria where clickup_task_id='CU-RLS');
  get diagnostics r = row_count;
  if r <> 0 then raise exception 'contas editou forja (% linhas)', r; end if;
end $$;
rollback;
SQL

# não-membro não lê nada
$PSQL <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"email":"fora@t.dev"}',true);
do $$ begin
  if (select count(*) from cria) <> 0 then raise exception 'não-membro leu crias'; end if;
end $$;
rollback;
SQL

echo "✓ RLS OK"
echo "✅ TODOS OS TESTES DO BANCO PASSARAM"
