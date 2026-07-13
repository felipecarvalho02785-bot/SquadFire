-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0010 — Motor de recorrência (Lenhas de Rotina do dia)
-- ─────────────────────────────────────────────────────────────
-- A partir de `rotina` (ativa) + `rotina_papel`, gera as lenha(tipo=rotina)
-- do dia para cada membro do(s) papel(is). Idempotente por (rotina, membro, dia).

-- Idempotência: no máximo 1 ocorrência por rotina/membro/dia.
create unique index if not exists uq_lenha_rotina_ocorrencia
  on lenha (rotina_id, responsavel_id, data_referencia)
  where tipo = 'rotina';

create or replace function app.gerar_lenhas_do_dia(p_data date default current_date)
returns int
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_dow  int  := extract(dow from p_data)::int;                 -- 0=dom .. 6=sab
  v_dia  text := (array['dom','seg','ter','qua','qui','sex','sab'])[v_dow + 1];
  v_criadas int := 0;
  r record;
  m record;
  v_fires boolean;
begin
  for r in select * from rotina where ativo loop
    v_fires := case r.recorrencia_tipo
      when 'diaria'         then true
      when 'semanal'        then (r.recorrencia_config->>'dia') = v_dia
      when 'dias_da_semana' then (r.recorrencia_config->'dias') ? v_dia
      when 'mensal'         then extract(day from p_data)::int
                                 = coalesce((r.recorrencia_config->>'dia_mes')::int, -1)
      else false  -- sprint: âncora do ciclo ainda a definir (parqueado)
    end;
    if not v_fires then continue; end if;

    -- Alvo: membros ativos que têm algum papel listado em rotina_papel da rotina.
    for m in
      select distinct mb.id
      from membro mb
      join membro_papel mp on mp.membro_id = mb.id
      join rotina_papel rp on rp.papel = mp.papel and rp.rotina_id = r.id
      where mb.ativo
    loop
      insert into lenha (tipo, titulo, rotina_id, responsavel_id, data_referencia)
      values ('rotina', r.titulo, r.id, m.id, p_data)
      on conflict (rotina_id, responsavel_id, data_referencia)
        where tipo = 'rotina'
        do nothing;
      if found then v_criadas := v_criadas + 1; end if;
    end loop;
  end loop;

  return v_criadas;
end;
$$;

comment on function app.gerar_lenhas_do_dia(date) is
  'Motor de recorrência: gera as Lenhas de Rotina do dia por papel (idempotente).';

-- Wrapper para o cron/serviço (service_role). Não exposto a usuários comuns.
create or replace function public.gerar_lenhas_do_dia(p_data date default current_date)
returns int
language sql
security invoker
as $$
  select app.gerar_lenhas_do_dia(p_data);
$$;

revoke all on function public.gerar_lenhas_do_dia(date) from public;
grant execute on function public.gerar_lenhas_do_dia(date) to service_role;
