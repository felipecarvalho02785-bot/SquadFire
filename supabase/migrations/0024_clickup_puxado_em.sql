-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0024 — Marca de "puxado do ClickUp" (pro lote convergir)
-- ─────────────────────────────────────────────────────────────
-- O "Puxar todos do ClickUp" roda em lotes (a extração pela Faísca é pesada).
-- Esta coluna marca quando a Cria foi puxada pela última vez — assim cada
-- lote pega só quem ainda não foi, e o processo converge sem repetir.

alter table cria
  add column if not exists clickup_puxado_em timestamptz;

comment on column cria.clickup_puxado_em is
  'Última vez que a Cria foi puxada do ClickUp (dados + fase + diagnóstico). Controle do lote.';
