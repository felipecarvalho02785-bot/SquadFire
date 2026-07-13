-- 0013 · RPC pública para iniciar a Forja (setar a data de início do projeto).
-- Com a data de início, os prazos das 7 fases são calculados em cascata por
-- app.aplicar_data_inicio — é isso que alimenta o SLA e o Calendário (em que
-- fase/dia cada Cria está). Só Projetos/Admin podem iniciar.

create or replace function public.iniciar_forja(p_cria_id uuid, p_data date)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja uuid;
begin
  if not (app.has_papel('gestor_projetos') or app.is_admin()) then
    raise exception 'sem permissão para iniciar a Forja' using errcode = '42501';
  end if;

  select id into v_forja from forja where cria_id = p_cria_id;
  if v_forja is null then
    raise exception 'Forja não encontrada para a Cria %', p_cria_id;
  end if;

  perform app.aplicar_data_inicio(v_forja, p_data);
end;
$$;

comment on function public.iniciar_forja(uuid, date) is
  'Seta a data de início da Forja da Cria e calcula os prazos das 7 fases em cascata (regra 2). Guard: Projetos/Admin.';

revoke all on function public.iniciar_forja(uuid, date) from public;
grant execute on function public.iniciar_forja(uuid, date) to authenticated;
