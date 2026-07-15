-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0031 — Rastro de alterações (auditoria / LGPD)
-- ─────────────────────────────────────────────────────────────
-- Log de "quem mudou o quê" nas entidades sensíveis (Cria, Forja, Contrato).
-- Um trigger genérico grava INSERT/UPDATE/DELETE com o e-mail do autor (do JWT;
-- null = sistema/serviço), as colunas que mudaram e um snapshot. Só Admin lê.
-- Ignora updates que só tocam colunas de sistema (sincronização) pra não poluir.

create table auditoria (
  id           bigint generated always as identity primary key,
  entidade     text not null,          -- nome da tabela (cria, forja, contrato)
  entidade_id  uuid,
  acao         text not null,          -- INSERT | UPDATE | DELETE
  membro_email citext,                 -- quem fez (null = sistema/serviço)
  mudou        text[] not null default '{}',
  dados        jsonb,                  -- snapshot (new; old no delete)
  created_at   timestamptz not null default now()
);

create index idx_auditoria_entidade on auditoria(entidade, entidade_id, created_at desc);
create index idx_auditoria_created on auditoria(created_at desc);

comment on table auditoria is 'Rastro de alterações (LGPD): quem mudou o quê em Cria/Forja/Contrato. Admin-only.';

-- Colunas de sistema (mudam sozinhas na sincronização) — não geram rastro.
create or replace function app.registrar_auditoria()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_new     jsonb;
  v_old     jsonb;
  v_mudou   text[] := '{}';
  v_dados   jsonb;
  k         text;
  v_sistema text[] := array['updated_at', 'sincronizado_em', 'clickup_puxado_em', 'clickup_puxa_tentativas'];
begin
  if tg_op = 'DELETE' then
    v_id := (old).id; v_dados := to_jsonb(old);
  else
    v_id := (new).id; v_dados := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    v_new := to_jsonb(new); v_old := to_jsonb(old);
    for k in select jsonb_object_keys(v_new) loop
      if (v_new->k is distinct from v_old->k) and not (k = any(v_sistema)) then
        v_mudou := array_append(v_mudou, k);
      end if;
    end loop;
    if array_length(v_mudou, 1) is null then return new; end if; -- só sistema → ignora
  end if;

  insert into auditoria(entidade, entidade_id, acao, membro_email, mudou, dados)
  values (tg_table_name, v_id, tg_op, app.jwt_email(), v_mudou, v_dados);

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger trg_auditoria after insert or update or delete on cria
  for each row execute function app.registrar_auditoria();
create trigger trg_auditoria after insert or update or delete on contrato
  for each row execute function app.registrar_auditoria();
create trigger trg_auditoria after insert or update or delete on forja
  for each row execute function app.registrar_auditoria();

-- RLS: só Admin lê; ninguém escreve direto (o trigger, SECURITY DEFINER, insere).
alter table auditoria enable row level security;
create policy p_audit_read on auditoria for select to authenticated using (app.is_admin());
