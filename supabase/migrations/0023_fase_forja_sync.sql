-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0023 — Sincronizar a fase da Forja com a "Semana" do ClickUp
-- ─────────────────────────────────────────────────────────────
-- Bug: o sync trazia cria.clickup_semana, mas nunca movia as fases da Forja —
-- então a Cria aparecia sempre em "Fase 1, nada feito". Aqui o sync passa a
-- refletir a Semana do ClickUp nas 7 fases: fases anteriores = concluída, a
-- da Semana = em andamento, as demais = pendente; e aponta a fase atual.
-- ClickUp é a fonte da verdade de em que semana o cliente está.

create or replace function public.definir_fase_forja_sync(p_cria_id uuid, p_semana int)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja uuid;
  v_sem   int := least(greatest(p_semana, 1), 7);
begin
  if p_semana is null or p_semana < 1 then return; end if;
  select id into v_forja from forja where cria_id = p_cria_id;
  if v_forja is null then return; end if;

  update fase_da_forja
     set status = (case
                     when ordem < v_sem then 'concluida'
                     when ordem = v_sem then 'em_andamento'
                     else 'pendente'
                   end)::status_fase
   where forja_id = v_forja;

  update forja
     set fase_atual_id = (select id from fase_da_forja where forja_id = v_forja and ordem = v_sem)
   where id = v_forja;
end;
$$;

comment on function public.definir_fase_forja_sync(uuid, int) is
  'Caminho do sync ClickUp: reflete a Semana (1..7) nas fases da Forja (concluída/em andamento/pendente) e aponta a fase atual. Só service_role.';

revoke all on function public.definir_fase_forja_sync(uuid, int) from public;
grant execute on function public.definir_fase_forja_sync(uuid, int) to service_role;
