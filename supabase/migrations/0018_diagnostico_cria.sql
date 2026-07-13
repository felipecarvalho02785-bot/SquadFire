-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0018 — Diagnóstico 360 (PDF) na Cria
-- ─────────────────────────────────────────────────────────────
-- A Cria ganha o vínculo com o PDF do Diagnóstico 360 (todas as informações
-- do cliente). Guardamos o PATH no Storage (bucket privado) — a URL assinada é
-- gerada na hora de exibir. O Contrato continua na tabela `contrato`
-- (arquivo_url), então não precisa de coluna aqui.

alter table cria
  add column if not exists diagnostico_path text,
  add column if not exists diagnostico_nome text;

comment on column cria.diagnostico_path is
  'Caminho do PDF do Diagnóstico 360 no Storage (bucket entregaveis). URL assinada gerada ao exibir.';
