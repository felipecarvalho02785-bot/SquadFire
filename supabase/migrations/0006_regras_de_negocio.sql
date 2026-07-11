-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0006 — Regras de negócio (funções + triggers)
-- ─────────────────────────────────────────────────────────────
-- Regras 1, 2 e 3 de docs/modelo-de-dados.md § Regras de negócio.

-- ── Regra 1: criar Cria → cria Forja + 7 fases + Lenhas padrão ─
create or replace function app.criar_forja_para_cria()
returns trigger
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja_id uuid;
  v_primeira_fase_da_forja uuid;
  f record;
  v_fase_da_forja_id uuid;
  l record;
begin
  -- 1 Cria = 1 Forja. Nasce sem data_inicio (prazos só quando o contrato confirma).
  insert into forja (cria_id) values (new.id) returning id into v_forja_id;

  -- Instancia as 7 fases do catálogo, em ordem, todas 'pendente' e sem prazos.
  for f in select * from fase order by ordem loop
    insert into fase_da_forja (forja_id, fase_id, ordem)
    values (v_forja_id, f.id, f.ordem)
    returning id into v_fase_da_forja_id;

    if f.ordem = 1 then
      v_primeira_fase_da_forja := v_fase_da_forja_id;
    end if;

    -- Lenhas de Forja padrão da fase (checklist que habilita avançar).
    for l in
      select * from fase_lenha_padrao where fase_id = f.id order by ordem
    loop
      insert into lenha (tipo, titulo, fase_da_forja_id)
      values ('forja', l.titulo, v_fase_da_forja_id);
    end loop;
  end loop;

  -- Ponteiro da fase corrente = fase 1.
  if v_primeira_fase_da_forja is not null then
    update forja set fase_atual_id = v_primeira_fase_da_forja where id = v_forja_id;
  end if;

  return new;
end;
$$;

create trigger trg_cria_cria_forja
  after insert on cria
  for each row execute function app.criar_forja_para_cria();

-- ── Cascata de prazos a partir da data de início da Forja ─────
-- Fase N começa quando N-1 fecha no previsto; duracao_dias por fase.
create or replace function app.aplicar_data_inicio(p_forja_id uuid, p_data_inicio date)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  ff record;
  v_inicio date := p_data_inicio;
  v_fim date;
begin
  update forja set data_inicio = p_data_inicio where id = p_forja_id;

  for ff in
    select fdf.id, f.duracao_dias
    from fase_da_forja fdf
    join fase f on f.id = fdf.fase_id
    where fdf.forja_id = p_forja_id
    order by fdf.ordem
  loop
    v_fim := v_inicio + (ff.duracao_dias || ' days')::interval;
    update fase_da_forja
      set data_prevista_inicio = v_inicio,
          data_prevista_fim    = v_fim
      where id = ff.id;
    v_inicio := v_fim;
  end loop;
end;
$$;

comment on function app.aplicar_data_inicio(uuid, date) is
  'Regra 2: seta forja.data_inicio e calcula os prazos das 7 fases em cascata.';

-- ── Regra 2: confirmar contrato dispara os prazos ────────────
create or replace function app.contrato_confirmado()
returns trigger
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_forja_id uuid;
begin
  -- Só quando confirmado passa a true e há data extraída.
  if new.confirmado and not old.confirmado and new.data_inicio_extraida is not null then
    select id into v_forja_id from forja where cria_id = new.cria_id;
    if v_forja_id is not null then
      perform app.aplicar_data_inicio(v_forja_id, new.data_inicio_extraida);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_contrato_confirmado
  after update of confirmado on contrato
  for each row execute function app.contrato_confirmado();

-- ── Regra 3: avançar fase (manual + checklist) ───────────────
-- Conclui a fase atual (se as Lenhas de Forja dela estiverem concluídas e o
-- gate cumprido) e move o ponteiro pra próxima. Não avança sozinho.
create or replace function app.avancar_fase(p_forja_id uuid)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_atual fase_da_forja%rowtype;
  v_fase fase%rowtype;
  v_pendentes int;
  v_prox fase_da_forja%rowtype;
begin
  -- Autorização (regra 3): só Projetos ou Admin avançam fase. Como a função é
  -- SECURITY DEFINER (bypassa RLS pra mexer em várias tabelas), o guard vive aqui.
  -- Chamadas de sistema/serviço (sem JWT) passam: current_membro_id() é null e
  -- não são bloqueadas — o gate é pra usuário logado sem o papel.
  if app.jwt_email() is not null
     and not (app.has_papel('gestor_projetos') or app.is_admin()) then
    raise exception 'Sem permissão para avançar fase (requer Projetos ou Admin)';
  end if;

  select fdf.* into v_atual
  from forja fj
  join fase_da_forja fdf on fdf.id = fj.fase_atual_id
  where fj.id = p_forja_id;

  if not found then
    raise exception 'Forja % sem fase atual definida', p_forja_id;
  end if;

  select * into v_fase from fase where id = v_atual.fase_id;

  -- Todas as Lenhas de Forja da fase precisam estar concluídas/canceladas.
  select count(*) into v_pendentes
  from lenha
  where fase_da_forja_id = v_atual.id
    and status not in ('concluida', 'cancelada');

  if v_pendentes > 0 then
    raise exception
      'Não é possível avançar: % Lenha(s) de Forja pendente(s) na fase %',
      v_pendentes, v_fase.nome;
  end if;

  -- Fecha a fase atual.
  update fase_da_forja
    set status = 'concluida', data_realizada_fim = now()::date
    where id = v_atual.id;

  -- Próxima fase por ordem.
  select * into v_prox
  from fase_da_forja
  where forja_id = p_forja_id and ordem = v_atual.ordem + 1;

  if found then
    update fase_da_forja
      set status = 'em_andamento', data_realizada_inicio = now()::date
      where id = v_prox.id;
    update forja set fase_atual_id = v_prox.id where id = p_forja_id;
  else
    -- Era a 7ª fase: Forja concluída.
    update forja set concluida = true where id = p_forja_id;
  end if;
end;
$$;

comment on function app.avancar_fase(uuid) is
  'Regra 3: conclui a fase atual (checklist ok) e move o ponteiro; nunca automático.';
