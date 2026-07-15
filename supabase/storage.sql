-- ─────────────────────────────────────────────────────────────
-- SquadFire · Storage — buckets + policies (rodar SÓ no Supabase real)
-- ─────────────────────────────────────────────────────────────
-- FORA de migrations/ de propósito: o schema `storage` só existe no Supabase,
-- não no Postgres puro do CI. Aplique este arquivo no SQL Editor (ou psql)
-- depois das migrations. Buckets privados; acesso restrito a membros da squad.

-- Buckets privados com TETO de tamanho e MIME por tipo (o upload é gateado só
-- por app.is_membro; sem isto um membro poderia subir arquivo gigante/qualquer).
-- contratos = PDF; briefings = áudio; entregaveis = criativos (imagem/vídeo/pdf).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('contratos',   'contratos',   false, 26214400,  array['application/pdf']),
  ('briefings',   'briefings',   false, 26214400,  array['audio/webm','audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/x-m4a','audio/aac']),
  ('entregaveis', 'entregaveis', false, 52428800,  array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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
