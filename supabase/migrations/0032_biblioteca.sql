-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0032 — Biblioteca (acervo real de roteiros e criativos)
-- ─────────────────────────────────────────────────────────────
-- A página Biblioteca era mockup. Aqui vira acervo de verdade: roteiros (texto)
-- e criativos (arquivo no bucket entregaveis), com vínculo opcional à Cria.
-- Leitura ampla (toda a squad reusa o acervo); cada um edita/apaga o que criou.

create table biblioteca_item (
  id           uuid primary key default gen_random_uuid(),
  cria_id      uuid references cria(id) on delete set null,   -- opcional (item genérico)
  titulo       text not null,
  tipo         text not null check (tipo in ('roteiro', 'criativo')),
  conteudo     text,          -- roteiro (texto)
  arquivo_path text,          -- criativo/anexo no bucket entregaveis
  arquivo_nome text,
  autor_id     uuid references membro(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_biblioteca_tipo on biblioteca_item(tipo, created_at desc);
create index idx_biblioteca_cria on biblioteca_item(cria_id);

comment on table biblioteca_item is 'Acervo de roteiros (texto) e criativos (arquivo) da squad, reutilizável, com vínculo opcional à Cria.';

create trigger trg_biblioteca_updated_at
  before update on biblioteca_item
  for each row execute function app.set_updated_at();

alter table biblioteca_item enable row level security;

-- Leitura: toda a squad. Escrita: qualquer membro cria (como o próprio autor);
-- edita/apaga só o próprio item (ou Admin).
create policy p_read on biblioteca_item for select to authenticated
  using (app.is_membro());
create policy p_bib_ins on biblioteca_item for insert to authenticated
  with check (app.is_membro() and autor_id = app.current_membro_id());
create policy p_bib_upd on biblioteca_item for update to authenticated
  using (autor_id = app.current_membro_id() or app.is_admin())
  with check (autor_id = app.current_membro_id() or app.is_admin());
create policy p_bib_del on biblioteca_item for delete to authenticated
  using (autor_id = app.current_membro_id() or app.is_admin());
