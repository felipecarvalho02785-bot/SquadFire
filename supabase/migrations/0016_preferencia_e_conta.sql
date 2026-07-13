-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0016 — Preferências do membro + editar a própria Conta
-- ─────────────────────────────────────────────────────────────
-- A Forjaria (Configurações) guardava tudo só no localStorage. Aqui as
-- preferências passam a persistir no banco (uma linha por membro, jsonb) e o
-- membro pode editar o próprio nome/papel primário via RPC (a tabela membro
-- é admin-only na RLS — o RPC dá o self-service sem afrouxar isso).

-- ── preferencia (1 linha por membro) ─────────────────────────
-- dados (jsonb) guarda o bloco de preferências da Forjaria:
--   { notif:{...}, canais:{...}, ia:{...}, forja:{...}, sla:int, twofa:bool }
-- Aparência (tema/densidade/animações) fica no localStorage de propósito:
-- precisa ser aplicada antes da primeira pintura, sem ida ao banco.
create table if not exists preferencia (
  membro_id  uuid primary key references membro(id) on delete cascade,
  dados      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table preferencia is
  'Preferências da Forjaria por membro (notificações, IA, Forja, SLA, 2FA). Aparência fica no cliente.';

drop trigger if exists trg_preferencia_updated_at on preferencia;
create trigger trg_preferencia_updated_at
  before update on preferencia
  for each row execute function app.set_updated_at();

alter table preferencia enable row level security;

-- Cada membro lê e escreve APENAS a própria linha.
drop policy if exists p_pref_self on preferencia;
create policy p_pref_self on preferencia for all to authenticated
  using (membro_id = app.current_membro_id())
  with check (membro_id = app.current_membro_id());

-- ── RPC: editar a própria Conta (nome + papel primário) ──────
-- A tabela membro é admin-only na RLS; este RPC (SECURITY DEFINER) deixa o
-- membro ajustar só o próprio registro. Trocar o papel primário define a
-- tela-casa do Covil; o trigger trg_membro_sync_papel garante a linha em
-- membro_papel. Squad é allowlist confiável — self-service é intencional.
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
  update membro
     set nome = btrim(p_nome),
         papel_primario = p_papel
   where id = v_id;
end;
$$;

comment on function public.atualizar_minha_conta(text, papel) is
  'Membro edita o próprio nome e papel primário (a tabela membro é admin-only na RLS).';

revoke all on function public.atualizar_minha_conta(text, papel) from public;
grant execute on function public.atualizar_minha_conta(text, papel) to authenticated;
