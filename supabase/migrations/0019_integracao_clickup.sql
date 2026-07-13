-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0019 — Config do webhook do ClickUp (secret no banco)
-- ─────────────────────────────────────────────────────────────
-- Guarda o id + secret do webhook do ClickUp numa linha única. Assim o botão
-- "Ativar tempo real" na Forjaria registra o webhook e grava o secret aqui —
-- sem precisar setar env nem fazer redeploy. A verificação da assinatura lê
-- este secret (com fallback pra env CLICKUP_WEBHOOK_SECRET).

create table if not exists integracao_clickup (
  id             boolean primary key default true,
  webhook_id     text,
  webhook_secret text,
  atualizado_em  timestamptz not null default now(),
  constraint integracao_clickup_singleton check (id)
);

comment on table integracao_clickup is
  'Config do webhook do ClickUp (id + secret), uma linha só. Secret é sensível: leitura só admin; escrita via service_role.';

alter table integracao_clickup enable row level security;

-- Só admin lê (o secret é sensível). Escrita é sempre via service_role (bypassa RLS).
drop policy if exists p_intg_cu_read on integracao_clickup;
create policy p_intg_cu_read on integracao_clickup for select to authenticated
  using (app.is_admin());
