-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0027 — em_risco no fuso de Brasília (SLA não vira 3h cedo)
-- ─────────────────────────────────────────────────────────────
-- Bug (auditoria): recalcular_em_risco comparava now()::date, e a sessão do
-- Supabase roda em UTC. Das ~21h à meia-noite (BRT) o "hoje" já era o dia
-- seguinte, então uma fase que vence hoje virava "atrasada" ~3h antes da hora
-- e a Cria era marcada em_risco cedo demais. Agora a data usada é a de
-- Brasília, batendo com o resto do app (lib/datas.ts).

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
      and (now() at time zone 'America/Sao_Paulo')::date > fdf.data_prevista_fim
  )
  update cria c
     set em_risco = (c.id in (select cria_id from risco))
   where c.em_risco is distinct from (c.id in (select cria_id from risco));
  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;

comment on function app.recalcular_em_risco() is
  'Recalcula cria.em_risco por SLA de fase vencida, no fuso America/Sao_Paulo (idempotente; limpa quem saiu do risco).';
