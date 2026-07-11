-- ─────────────────────────────────────────────────────────────
-- SquadFire · Storage — buckets + policies (rodar SÓ no Supabase real)
-- ─────────────────────────────────────────────────────────────
-- FORA de migrations/ de propósito: o schema `storage` só existe no Supabase,
-- não no Postgres puro do CI. Aplique este arquivo no SQL Editor (ou psql)
-- depois das migrations. Buckets privados; acesso restrito a membros da squad.

insert into storage.buckets (id, name, public) values
  ('contratos',   'contratos',   false),
  ('briefings',   'briefings',   false),
  ('entregaveis', 'entregaveis', false)
on conflict (id) do nothing;

-- Membros ativos da squad leem/gravam nos buckets internos (usa app.is_membro,
-- criado nas migrations). O service_role (server-side) bypassa isto.
create policy "squad_le_storage" on storage.objects for select to authenticated
  using (bucket_id in ('contratos','briefings','entregaveis') and app.is_membro());

create policy "squad_grava_storage" on storage.objects for insert to authenticated
  with check (bucket_id in ('contratos','briefings','entregaveis') and app.is_membro());

create policy "squad_atualiza_storage" on storage.objects for update to authenticated
  using (bucket_id in ('contratos','briefings','entregaveis') and app.is_membro());

create policy "squad_remove_storage" on storage.objects for delete to authenticated
  using (bucket_id in ('contratos','briefings','entregaveis') and app.is_membro());
