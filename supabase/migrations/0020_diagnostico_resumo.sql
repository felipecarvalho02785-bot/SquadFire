-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0020 — Resumo do Diagnóstico 360 (lido pela IA)
-- ─────────────────────────────────────────────────────────────
-- Ao vincular o PDF do Diagnóstico 360, a Faísca (Gemini) lê o arquivo e
-- guarda aqui um resumo objetivo — que vira contexto pra IA responder sobre o
-- cliente. O contrato já tem colunas de extração (valor_contrato,
-- data_inicio_extraida, dados_extraidos), então não precisa de coluna nova.

alter table cria
  add column if not exists diagnostico_resumo text;

comment on column cria.diagnostico_resumo is
  'Resumo do Diagnóstico 360 extraído do PDF pela Faísca (Gemini). Contexto pra IA.';
