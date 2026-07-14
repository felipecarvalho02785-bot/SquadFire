-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0028 — Contador de tentativas do "Puxar todos"
-- ─────────────────────────────────────────────────────────────
-- Bug (auditoria): o lote marcava clickup_puxado_em INCONDICIONALMENTE — uma
-- Cria cuja extração falhava era marcada como "puxada" e nunca mais tentada
-- (sucesso falso). Corrigido no route (só marca no sucesso). Para o lote ainda
-- CONVERGIR quando uma Cria falha sempre, contamos as tentativas: após 3
-- falhas ela sai do lote (o botão por-Cria continua disponível pra retry).

alter table cria
  add column if not exists clickup_puxa_tentativas int not null default 0;

comment on column cria.clickup_puxa_tentativas is
  'Tentativas malsucedidas de puxar do ClickUp no lote. Sucesso marca clickup_puxado_em; após 3 falhas o lote desiste (converge).';
