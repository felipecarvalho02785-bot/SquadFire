-- 0012 · Lenha avulsa — "tarefas do dia" criáveis e delegáveis por qualquer membro.
-- Até aqui toda Lenha pendurava numa fase (Forja) ou numa rotina (ocorrência).
-- Uma tarefa avulsa (ad-hoc, delegável) não tem nenhum dos dois — este patch
-- abre esse terceiro caso sem afrouxar a integridade de Forja/Rotina.

-- 1) novo valor de enum (idempotente). Não é usado como literal em nenhum outro
--    ponto deste arquivo, então é seguro mesmo se o runner rodar tudo numa tx.
alter type tipo_lenha add value if not exists 'avulsa';

-- 2) integridade mantida para Forja/Rotina; o "resto" (avulsa e qualquer tipo
--    futuro que não seja forja/rotina) fica sem fase e sem rotina. Referencia
--    só os literais que já existem ('forja','rotina') — nunca o valor novo —,
--    então é seguro rodar na mesma transação do ADD VALUE acima.
alter table lenha drop constraint if exists lenha_tipo_coerente;
alter table lenha add constraint lenha_tipo_coerente check (
  (tipo = 'forja'  and fase_da_forja_id is not null and rotina_id is null) or
  (tipo = 'rotina' and rotina_id is not null and fase_da_forja_id is null) or
  (tipo not in ('forja','rotina') and fase_da_forja_id is null and rotina_id is null)
);

-- 3) INSERT: Forja continua sendo Projetos/Admin; rotina e avulsa = qualquer
--    membro. Escrito por forma (fase_da_forja_id is null), sem citar o enum novo.
drop policy if exists p_lenha_ins on lenha;
create policy p_lenha_ins on lenha for insert to authenticated
  with check (
    (fase_da_forja_id is not null and (app.has_papel('gestor_projetos') or app.is_admin()))
    or (fase_da_forja_id is null and app.is_membro())
  );

comment on constraint lenha_tipo_coerente on lenha is
  'forja→fase, rotina→rotina, avulsa→nenhum. Integridade por forma dos FKs.';
