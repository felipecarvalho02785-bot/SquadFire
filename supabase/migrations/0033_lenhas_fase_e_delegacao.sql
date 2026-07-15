-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0033 — Fecha Lenhas de fase auto-concluída + libera delegação
-- ─────────────────────────────────────────────────────────────
-- Dois achados do panorama de auditoria:
--
-- A5) definir_fase_forja_sync marcava as fases < Semana do ClickUp como
--     'concluida', mas deixava as Lenhas de checklist dessas fases abertas para
--     sempre. Uma Cria que entra já na Semana 5 acumulava ~4 fases de Lenhas
--     'pendente' → os KPIs "Lenhas na fila" (Covil) e "Lenhas pendentes" (Cria)
--     nunca zeravam. Agora, ao concluir uma fase, cancela as Lenhas abertas dela.
--
-- M4) p_lenha_upd só permitia reatribuir a Lenha para si mesmo ou sendo
--     Projetos/Admin. O dono comum (ex.: Gestor de Contas) não conseguia
--     DELEGAR sua tarefa a um colega (with check barrava). Agora o responsável
--     atual pode reatribuir para qualquer membro ativo.

-- ── A5: definir_fase_forja_sync também fecha as Lenhas das fases concluídas ──
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
    if v_sem >= 7 then return; end if;
  else
    if v_sem <= v_ordem_atual then return; end if;
  end if;

  update fase_da_forja
     set status = (case
                     when ordem < v_sem then 'concluida'
                     when ordem = v_sem then 'em_andamento'
                     else 'pendente'
                   end)::status_fase
   where forja_id = v_forja;

  -- NOVO: as Lenhas de checklist das fases que ficaram concluídas são canceladas
  -- (o sync pulou essas fases; seus itens não fazem mais sentido em aberto).
  update lenha
     set status = 'cancelada'
   where fase_da_forja_id in (
           select id from fase_da_forja where forja_id = v_forja and ordem < v_sem
         )
     and status not in ('concluida', 'cancelada');

  update forja
     set fase_atual_id = (select id from fase_da_forja where forja_id = v_forja and ordem = v_sem),
         concluida = false
   where id = v_forja;
end;
$$;

comment on function public.definir_fase_forja_sync(uuid, int) is
  'Caminho do sync ClickUp: aplica a Semana (1..7) só quando AVANÇA a Forja; ao concluir fases, cancela as Lenhas abertas delas. Só service_role.';

revoke all on function public.definir_fase_forja_sync(uuid, int) from public;
grant execute on function public.definir_fase_forja_sync(uuid, int) to service_role;

-- Backfill: cancela as Lenhas já órfãs (abertas em fases hoje concluídas).
update lenha l
   set status = 'cancelada'
  from fase_da_forja fdf
 where l.fase_da_forja_id = fdf.id
   and fdf.status = 'concluida'
   and l.status not in ('concluida', 'cancelada');

-- ── M4: permitir delegar a Lenha para outro membro ativo ────────────────────
drop policy if exists p_lenha_upd on lenha;
create policy p_lenha_upd on lenha for update to authenticated
  using (
    responsavel_id = app.current_membro_id()
    or app.has_papel('gestor_projetos') or app.is_admin()
  )
  with check (
    responsavel_id = app.current_membro_id()
    or app.has_papel('gestor_projetos') or app.is_admin()
    -- delegação: o responsável atual (garantido pelo USING) pode reatribuir a
    -- Lenha para qualquer membro ATIVO.
    or responsavel_id in (select id from membro where ativo)
  );
