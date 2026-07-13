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
