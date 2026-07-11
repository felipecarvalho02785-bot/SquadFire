-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0011 — Guard de coluna (mídia) + derivação de em_risco
-- ─────────────────────────────────────────────────────────────
-- Refina a matriz de permissões: RLS libera Tráfego a atualizar a Cria, mas
-- só a coluna de mídia. Como RLS não é por coluna, o guard vive num trigger.

create or replace function app.guarda_coluna_cria()
returns trigger
language plpgsql
as $$
begin
  -- Sistema/serviço (sem JWT), Admin ou Contas: sem restrição de coluna.
  if app.jwt_email() is null or app.is_admin() or app.has_papel('gestor_contas') then
    return new;
  end if;

  -- Usuário é Tráfego (e não Contas/Admin): só investimento_midia pode mudar.
  if app.has_papel('gestor_trafego') then
    if row(new.nome_cliente, new.email, new.telefone_whatsapp, new.area_atuacao,
            new.produto, new.closer, new.gestor_contas_id, new.status, new.em_risco,
            new.clickup_task_id, new.clickup_squad, new.clickup_semana)
       is distinct from
       row(old.nome_cliente, old.email, old.telefone_whatsapp, old.area_atuacao,
            old.produto, old.closer, old.gestor_contas_id, old.status, old.em_risco,
            old.clickup_task_id, old.clickup_squad, old.clickup_semana)
    then
      raise exception 'Tráfego só pode editar investimento_midia da Cria';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_cria_guarda_coluna
  before update on cria
  for each row execute function app.guarda_coluna_cria();

-- ── Derivação de em_risco por SLA de fase ────────────────────
-- em_risco = existe fase não concluída com prazo previsto estourado.
-- Recompute total (idempotente); também LIMPA quem deixou de estar em risco.
-- (NPS baixo entra aqui como segunda fonte quando a entidade nps existir.)
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
      and now()::date > fdf.data_prevista_fim
  )
  update cria c
     set em_risco = (c.id in (select cria_id from risco))
   where c.em_risco is distinct from (c.id in (select cria_id from risco));
  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;

comment on function app.recalcular_em_risco() is
  'Recalcula cria.em_risco por SLA de fase vencida (idempotente; limpa quem saiu do risco).';

-- Wrapper para cron/serviço (service_role), fora do alcance de usuários comuns.
create or replace function public.recalcular_em_risco()
returns int
language sql
security invoker
as $$
  select app.recalcular_em_risco();
$$;

revoke all on function public.recalcular_em_risco() from public;
grant execute on function public.recalcular_em_risco() to service_role;
