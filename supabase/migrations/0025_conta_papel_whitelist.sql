-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0025 — Anti-escalada em atualizar_minha_conta
-- ─────────────────────────────────────────────────────────────
-- Bug de segurança (auditoria): atualizar_minha_conta aceitava QUALQUER papel.
-- Como trocar o papel_primário dispara trg_membro_sync_papel (que insere a
-- linha em membro_papel), um Tráfego podia se auto-conceder gestor_contas /
-- gestor_projetos — ganhando poderes de RLS que a matriz de papéis nega
-- (editar Cria por inteiro, furando o guard de coluna do 0011).
--
-- Correção: o membro só pode escolher como papel primário um papel que JÁ lhe
-- foi atribuído (existe em membro_papel). Trocar só o nome, ou alternar entre
-- papéis que ele legitimamente tem, continua funcionando. Conceder um papel
-- novo é ato de Admin (RLS p_admin_all em membro_papel).

create or replace function public.atualizar_minha_conta(p_nome text, p_papel papel)
returns void
language plpgsql
security definer set search_path = public, app, pg_temp
as $$
declare
  v_id uuid := app.current_membro_id();
begin
  if v_id is null then
    raise exception 'membro não identificado' using errcode = '42501';
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome não pode ser vazio';
  end if;

  -- Anti-escalada de privilégio: papel primário só entre os já atribuídos.
  if not exists (
    select 1 from membro_papel mp
    where mp.membro_id = v_id and mp.papel = p_papel
  ) then
    raise exception 'você não tem o papel % atribuído — peça a um admin', p_papel
      using errcode = '42501';
  end if;

  update membro
     set nome = btrim(p_nome),
         papel_primario = p_papel
   where id = v_id;
end;
$$;

comment on function public.atualizar_minha_conta(text, papel) is
  'Membro edita o próprio nome e papel primário — restrito a papéis já atribuídos (anti-escalada). A tabela membro é admin-only na RLS.';

revoke all on function public.atualizar_minha_conta(text, papel) from public;
grant execute on function public.atualizar_minha_conta(text, papel) to authenticated;
