-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0007 — Auth helpers + Row Level Security
-- ─────────────────────────────────────────────────────────────
-- Modelo: leitura ampla (todo membro ativo lê tudo); escrita por papel + admin.
-- Base: docs/modelo-de-dados.md § Permissões por papel.
--
-- O membro é resolvido pelo claim `email` do JWT (Google SSO) contra a
-- allowlist `membro.email`. As policies miram o papel `authenticated`; o
-- `service_role` (integração ClickUp / jobs server-side) bypassa RLS.

-- ── Helpers (SECURITY DEFINER: leem membro sem recursão de RLS) ─
create or replace function app.jwt_email()
returns citext
language sql stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
  '')::citext
$$;

create or replace function app.current_membro_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.id from public.membro m
  where m.email = app.jwt_email() and m.ativo
  limit 1
$$;

create or replace function app.is_membro()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select app.current_membro_id() is not null
$$;

create or replace function app.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select m.is_admin from public.membro m
     where m.email = app.jwt_email() and m.ativo limit 1),
  false)
$$;

create or replace function app.has_papel(p papel)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.membro m
    join public.membro_papel mp on mp.membro_id = m.id
    where m.email = app.jwt_email() and m.ativo and mp.papel = p
  )
$$;

-- ── Habilita RLS em todas as tabelas ─────────────────────────
alter table membro            enable row level security;
alter table membro_papel      enable row level security;
alter table rotina            enable row level security;
alter table rotina_papel      enable row level security;
alter table cria              enable row level security;
alter table contrato          enable row level security;
alter table comentario        enable row level security;
alter table fase              enable row level security;
alter table fase_lenha_padrao enable row level security;
alter table forja             enable row level security;
alter table fase_da_forja     enable row level security;
alter table gargalo           enable row level security;
alter table plano_de_acao     enable row level security;
alter table plano_passo       enable row level security;
alter table briefing          enable row level security;
alter table lenha             enable row level security;

-- ── Leitura ampla: todo membro ativo lê tudo ─────────────────
create policy p_read on membro            for select to authenticated using (app.is_membro());
create policy p_read on membro_papel      for select to authenticated using (app.is_membro());
create policy p_read on rotina            for select to authenticated using (app.is_membro());
create policy p_read on rotina_papel      for select to authenticated using (app.is_membro());
create policy p_read on cria              for select to authenticated using (app.is_membro());
create policy p_read on contrato          for select to authenticated using (app.is_membro());
create policy p_read on comentario        for select to authenticated using (app.is_membro());
create policy p_read on fase              for select to authenticated using (app.is_membro());
create policy p_read on fase_lenha_padrao for select to authenticated using (app.is_membro());
create policy p_read on forja             for select to authenticated using (app.is_membro());
create policy p_read on fase_da_forja     for select to authenticated using (app.is_membro());
create policy p_read on gargalo           for select to authenticated using (app.is_membro());
create policy p_read on plano_de_acao     for select to authenticated using (app.is_membro());
create policy p_read on plano_passo       for select to authenticated using (app.is_membro());
create policy p_read on briefing          for select to authenticated using (app.is_membro());
create policy p_read on lenha             for select to authenticated using (app.is_membro());

-- ── Admin: gestão de membros, rotinas e catálogos ────────────
create policy p_admin_all on membro            for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on membro_papel      for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on rotina            for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on rotina_papel      for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on fase              for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy p_admin_all on fase_lenha_padrao for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ── cria: Contas/Admin criam e editam; Tráfego edita mídia ───
-- Refinamento de coluna (Tráfego só mexe em investimento_midia) é reforçado
-- na camada de API — RLS aqui é a nível de linha/comando.
create policy p_cria_ins on cria for insert to authenticated
  with check (app.has_papel('gestor_contas') or app.is_admin());
create policy p_cria_upd on cria for update to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_trafego') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_trafego') or app.is_admin());
create policy p_cria_del on cria for delete to authenticated
  using (app.is_admin());

-- ── contrato: Contas/Admin ───────────────────────────────────
create policy p_contrato_write on contrato for all to authenticated
  using (app.has_papel('gestor_contas') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.is_admin());

-- ── comentário: Contas/Projetos/Admin; sempre como o próprio autor ─
create policy p_coment_ins on comentario for insert to authenticated
  with check (
    (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
    and autor_id = app.current_membro_id()
  );
create policy p_coment_mod on comentario for update to authenticated
  using (autor_id = app.current_membro_id() or app.is_admin())
  with check (autor_id = app.current_membro_id() or app.is_admin());
create policy p_coment_del on comentario for delete to authenticated
  using (autor_id = app.current_membro_id() or app.is_admin());

-- ── forja / fase_da_forja: Projetos/Admin movem/editam ───────
create policy p_forja_upd on forja for update to authenticated
  using (app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_projetos') or app.is_admin());
create policy p_fdf_upd on fase_da_forja for update to authenticated
  using (app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_projetos') or app.is_admin());

-- ── gargalo + plano + passo: Contas/Projetos/Admin ───────────
create policy p_gargalo_write on gargalo for all to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin());
create policy p_plano_write on plano_de_acao for all to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin());
create policy p_passo_write on plano_passo for all to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin());

-- ── briefing: Contas/Projetos/Admin; INSERT como o próprio autor ─
create policy p_brief_ins on briefing for insert to authenticated
  with check (
    (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
    and autor_id = app.current_membro_id()
  );
create policy p_brief_mod on briefing for update to authenticated
  using (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin())
  with check (app.has_papel('gestor_contas') or app.has_papel('gestor_projetos') or app.is_admin());
create policy p_brief_del on briefing for delete to authenticated
  using (autor_id = app.current_membro_id() or app.is_admin());

-- ── lenha: criar/distribuir Forja = Projetos/Admin; concluir a
--    PRÓPRIA lenha (Forja ou Rotina) = qualquer papel dono dela ──
create policy p_lenha_ins on lenha for insert to authenticated
  with check (
    (tipo = 'forja'  and (app.has_papel('gestor_projetos') or app.is_admin()))
    or (tipo = 'rotina' and app.is_membro())
  );
-- Update: dono da lenha muda o status dela; Projetos/Admin gerenciam de fato.
create policy p_lenha_upd on lenha for update to authenticated
  using (
    responsavel_id = app.current_membro_id()
    or app.has_papel('gestor_projetos') or app.is_admin()
  )
  with check (
    responsavel_id = app.current_membro_id()
    or app.has_papel('gestor_projetos') or app.is_admin()
  );
create policy p_lenha_del on lenha for delete to authenticated
  using (app.has_papel('gestor_projetos') or app.is_admin());
