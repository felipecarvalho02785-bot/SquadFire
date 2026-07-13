-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0017 — Comentário ↔ ClickUp (base do two-way)
-- ─────────────────────────────────────────────────────────────
-- Os comentários do sistema (registro contínuo da Cria + notas da Roda de
-- Fogo) passam a espelhar como COMENTÁRIO na task-mestre do cliente no
-- ClickUp. Guardamos o id do comentário lá e a origem — pra, no sentido
-- inverso (ClickUp → CRM), não reenviar o que veio de lá (anti-eco).

alter table comentario
  add column if not exists clickup_comment_id text,
  add column if not exists origem text not null default 'crm';

comment on column comentario.origem is
  'crm = criado no sistema (espelha no ClickUp); clickup = importado do ClickUp (não reenviar).';
