-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0030 — Guard de coluna da Cria vira ALLOWLIST
-- ─────────────────────────────────────────────────────────────
-- Bug (auditoria): o guard do 0011 era uma DENYLIST (enumerava as colunas que o
-- Tráfego NÃO pode mudar). Colunas novas (diagnostico_path/nome/resumo,
-- clickup_puxado_em, clickup_puxa_tentativas) ficaram de fora → o Tráfego
-- passou a poder editá-las. Vira allowlist: compara a linha INTEIRA e só deixa
-- passar investimento_midia (+ os campos de sistema). Robusto a colunas futuras.

create or replace function app.guarda_coluna_cria()
returns trigger
language plpgsql
as $$
declare v_check cria;
begin
  -- Sistema/serviço (sem JWT), Admin ou Contas: sem restrição de coluna.
  if app.jwt_email() is null or app.is_admin() or app.has_papel('gestor_contas') then
    return new;
  end if;

  -- Tráfego (e não Contas/Admin): SÓ investimento_midia pode mudar.
  if app.has_papel('gestor_trafego') then
    v_check := new;
    v_check.investimento_midia := old.investimento_midia; -- único permitido
    v_check.updated_at        := old.updated_at;          -- sistema (set_updated_at)
    if v_check is distinct from old then
      raise exception 'Tráfego só pode editar investimento_midia da Cria';
    end if;
  end if;

  return new;
end;
$$;
