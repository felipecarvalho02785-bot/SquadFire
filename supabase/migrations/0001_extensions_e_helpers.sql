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
