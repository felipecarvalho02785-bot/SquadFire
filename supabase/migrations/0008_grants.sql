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
