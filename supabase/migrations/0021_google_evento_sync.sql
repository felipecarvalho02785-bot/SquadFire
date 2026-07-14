-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0021 — Espelho da agenda do CRM no Google (CRM → Google)
-- ─────────────────────────────────────────────────────────────
-- Mapa entre um "evento do CRM" (ex.: prazo de uma fase) e o id do evento
-- criado no Google Agenda de cada membro. Assim o sync é idempotente: re-rodar
-- ATUALIZA o evento em vez de duplicar. Uma linha por (membro, tipo, ref).

create table if not exists google_evento_sync (
  membro_id        uuid not null references membro(id) on delete cascade,
  ref_tipo         text not null,           -- 'fase' | 'roda' | 'ritual'
  ref_id           text not null,           -- id do fase_da_forja, etc.
  google_event_id  text not null,
  atualizado_em    timestamptz not null default now(),
  primary key (membro_id, ref_tipo, ref_id)
);

comment on table google_evento_sync is
  'Mapa evento-do-CRM → evento-do-Google por membro (sync idempotente CRM → Google Agenda).';

alter table google_evento_sync enable row level security;

-- Cada membro só enxerga o próprio mapa. Escrita é via service_role (o job de
-- sync roda server-side).
drop policy if exists p_ges_self on google_evento_sync;
create policy p_ges_self on google_evento_sync for all to authenticated
  using (membro_id = app.current_membro_id())
  with check (membro_id = app.current_membro_id());
