-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0026 — definir_fase_forja_sync só AVANÇA (nunca retrocede)
-- ─────────────────────────────────────────────────────────────
-- Bug (auditoria): a versão 0023 reescrevia as 7 fases INCONDICIONALMENTE a
-- partir da Semana do ClickUp, a cada sync/webhook. Quando o time avançava a
-- fase manualmente (avancar_fase) à frente da Semana do ClickUp, o cron da
-- manhã revertia o avanço todo dia. Também nunca reajustava forja.concluida,
-- deixando uma Cria concluída-e-reaberta mostrando duas fases diferentes.
--
-- Correção — a Semana do ClickUp só é aplicada quando de fato AVANÇA a Forja:
--   • Forja em andamento: aplica apenas se v_sem > fase atual (nunca retrocede,
--     protegendo o "Avançar Fase" manual).
--   • Forja concluída: só reabre se o ClickUp voltar o cliente a uma semana < 7
--     (reativação real); se v_sem = 7, mantém concluída.
-- Ao aplicar, marca concluida=false (Semana 1..7 = no máximo "em andamento" na
-- fase 7; a conclusão final é ato do avancar_fase).

create or replace function public.definir_fase_forja_sync(p_cria_id uuid, p_semana int)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja       uuid;
  v_concluida   boolean;
  v_fase_atual  uuid;
  v_ordem_atual int := 0;
  v_sem         int := least(greatest(p_semana, 1), 7);
begin
  if p_semana is null or p_semana < 1 then return; end if;

  select id, coalesce(concluida, false), fase_atual_id
    into v_forja, v_concluida, v_fase_atual
    from forja where cria_id = p_cria_id;
  if v_forja is null then return; end if;

  if v_fase_atual is not null then
    select coalesce(ordem, 0) into v_ordem_atual
      from fase_da_forja where id = v_fase_atual;
    v_ordem_atual := coalesce(v_ordem_atual, 0);
  end if;

  -- Guarda "só avança": decide se a Semana do ClickUp deve ou não ser aplicada.
  if v_concluida then
    -- Concluída e ClickUp ainda na semana final → nada a fazer.
    if v_sem >= 7 then return; end if;
    -- Concluída e ClickUp voltou pra semana < 7 → reativação, aplica abaixo.
  else
    -- Em andamento: nunca retrocede nem re-toca a fase atual.
    if v_sem <= v_ordem_atual then return; end if;
  end if;

  update fase_da_forja
     set status = (case
                     when ordem < v_sem then 'concluida'
                     when ordem = v_sem then 'em_andamento'
                     else 'pendente'
                   end)::status_fase
   where forja_id = v_forja;

  update forja
     set fase_atual_id = (select id from fase_da_forja where forja_id = v_forja and ordem = v_sem),
         concluida = false
   where id = v_forja;
end;
$$;

comment on function public.definir_fase_forja_sync(uuid, int) is
  'Caminho do sync ClickUp: aplica a Semana (1..7) só quando AVANÇA a Forja (nunca retrocede; reabre concluída se ClickUp voltar a <7). Só service_role.';

revoke all on function public.definir_fase_forja_sync(uuid, int) from public;
grant execute on function public.definir_fase_forja_sync(uuid, int) to service_role;
