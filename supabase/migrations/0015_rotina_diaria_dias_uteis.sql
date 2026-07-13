-- 0015 · Rotina diária = dias úteis (seg–sex), não todo dia do calendário.
-- Ajusta o motor de recorrência: 'diaria' passa a firar apenas de segunda a
-- sexta. Os demais tipos (semanal/dias_da_semana/mensal) seguem iguais.

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
      when 'diaria'         then v_dow between 1 and 5   -- dias úteis (seg–sex)
      when 'semanal'        then (r.recorrencia_config->>'dia') = v_dia
      when 'dias_da_semana' then (r.recorrencia_config->'dias') ? v_dia
      when 'mensal'         then extract(day from p_data)::int
                                 = coalesce((r.recorrencia_config->>'dia_mes')::int, -1)
      else false  -- sprint: âncora do ciclo ainda a definir (parqueado)
    end;
    if not v_fires then continue; end if;

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
