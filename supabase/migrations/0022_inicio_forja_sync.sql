-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0022 — Aplicar a "Data inicial" do ClickUp no sync
-- ─────────────────────────────────────────────────────────────
-- O sync/webhook do ClickUp roda como service_role (sem JWT), então não pode
-- chamar iniciar_forja (que exige papel Projetos/Admin). Esta função é o
-- caminho do sync: seta a data de início da Forja da Cria e dispara a cascata
-- dos prazos das 7 fases (app.aplicar_data_inicio) — só se a data mudou.

create or replace function public.definir_inicio_forja_sync(p_cria_id uuid, p_data date)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja uuid;
  v_atual date;
begin
  select id, data_inicio into v_forja, v_atual from forja where cria_id = p_cria_id;
  if v_forja is null then return; end if;
  if v_atual is distinct from p_data then
    perform app.aplicar_data_inicio(v_forja, p_data);
  end if;
end;
$$;

comment on function public.definir_inicio_forja_sync(uuid, date) is
  'Caminho do sync ClickUp: aplica a Data inicial (start_date) na Forja e cascateia os prazos das 7 fases. Só service_role.';

revoke all on function public.definir_inicio_forja_sync(uuid, date) from public;
grant execute on function public.definir_inicio_forja_sync(uuid, date) to service_role;
