-- ─────────────────────────────────────────────────────────────
-- SquadFire · seed — catálogos fixos + rotinas + admin inicial
-- ─────────────────────────────────────────────────────────────
-- Rode depois das migrations, num banco limpo. Idempotência simples via
-- `on conflict do nothing` nas chaves naturais (ordem/titulo/email).

-- ── 1) Catálogo das 7 fases da Estruturação ──────────────────
insert into fase (ordem, nome, duracao_dias, is_gate, gate_descricao) values
  (1, 'Alinhamento / Boas-vindas',          7, true,  'Formulário Diagnóstico respondido'),
  (2, 'Diagnóstico 360',                     7, false, null),
  (3, 'Treinamento Comercial (equipe)',      7, false, null),
  (4, 'Consultoria Comercial (sócios)',      7, false, null),
  (5, 'Implementação CRM + IA',              7, false, null),
  (6, 'Auditoria de Mídia',                  7, false, null),
  (7, 'Auditoria Criativa',                  7, false, null)
on conflict (ordem) do nothing;

-- ── 2) Lenhas de Forja padrão por fase (checklist) ───────────
-- Fases 1–2 concretas (spec 3.3); 3–7 placeholder até o Felipe detalhar.
insert into fase_lenha_padrao (fase_id, ordem, titulo)
select f.id, v.ordem, v.titulo
from (values
  (1, 1, 'Reunião de alinhamento'),
  (1, 2, 'Enviar Formulário de Acesso'),
  (1, 3, 'Enviar Formulário Diagnóstico'),
  (2, 1, 'Elaborar documento Diagnóstico 360 (gargalos + planos)'),
  (2, 2, 'Reunião de fechamento'),
  (2, 3, 'Enviar PDF do Diagnóstico ao cliente'),
  (3, 1, 'Entregável do Treinamento Comercial (a detalhar)'),
  (4, 1, 'Entregável da Consultoria Comercial (a detalhar)'),
  (5, 1, 'Entregável da Implementação CRM + IA (a detalhar)'),
  (6, 1, 'Entregável da Auditoria de Mídia — inclui Google Meu Negócio (a detalhar)'),
  (7, 1, 'Entregável da Auditoria Criativa (a detalhar)')
) as v(fase_ordem, ordem, titulo)
join fase f on f.ordem = v.fase_ordem
on conflict (fase_id, ordem) do nothing;

-- ── 3) Rotinas (catálogo do motor de recorrência) ────────────
-- ativo=true → cadência fechada (doc/POP/confirmado).
-- ativo=false → cadência ainda "a definir" (parqueada em rotinas.md); catalogada
--   mas sem gerar Lenha até a squad confirmar.

-- Coletivas (toda a squad)
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Daily (alinhamento interno)',        'coletiva', 'diaria',  '{}'::jsonb,                true),
  ('Weekly (alinhamento da squad)',      'coletiva', 'semanal', '{"dia":"sex"}'::jsonb,     true),
  ('Planilha BSC',                       'coletiva', 'semanal', '{"dia":"sex"}'::jsonb,     true)
on conflict do nothing;

-- Subconjunto (Projetos + Tráfego)
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Atualizar relatório interno no ClickUp (briefing semanal)', 'subconjunto', 'semanal', '{"dia":"qui"}'::jsonb, true)
on conflict do nothing;

-- Gestor de Projetos (individual)
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Comunicação ativa nos grupos',                 'individual', 'diaria',  '{}'::jsonb,             true),
  ('Execução das demandas (copys, planilhas, NPS)','individual', 'diaria',  '{}'::jsonb,             true),
  ('Acompanhamento + pontuação de pendências',     'individual', 'diaria',  '{}'::jsonb,             true),
  ('Relatório diário (Projetos)',                  'individual', 'diaria',  '{}'::jsonb,             true),
  ('Envio de relatórios pelo criativo',            'individual', 'semanal', '{"dia":"seg"}'::jsonb,  true),
  ('Relatório de saúde do projeto no ClickUp',     'individual', 'semanal', '{"dia":"qui"}'::jsonb,  true),
  ('Relatório semanal (Projetos)',                 'individual', 'semanal', '{"dia":"sex"}'::jsonb,  true),
  ('Medir NPS',                                    'individual', 'mensal',  '{"dia_mes":1}'::jsonb,  false), -- dia do mês a definir
  ('Ciclo de sprint S1→S4',                        'individual', 'sprint',  '{"ciclo_semanas":4}'::jsonb, false) -- data-âncora a definir
on conflict do nothing;

-- Gestor de Contas (individual)
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Relatório diário das tarefas (fim de expediente)', 'individual', 'diaria',  '{}'::jsonb,            true),
  ('Check-in com cada Cria',                           'individual', 'semanal', '{"dia":"seg"}'::jsonb, true) -- dia default, ajustável (ou por Cria)
on conflict do nothing;

-- Gestor de Tráfego (individual) — cadências propostas, ainda a confirmar
insert into rotina (titulo, escopo, recorrencia_tipo, recorrencia_config, ativo) values
  ('Checar campanhas ativas (gasto/CPL/performance)', 'individual', 'diaria',  '{}'::jsonb,        false),
  ('Otimizar / ajustar campanhas',                    'individual', 'diaria',  '{}'::jsonb,        false),
  ('Relatório de métricas de tráfego',                'individual', 'semanal', '{"dia":"sex"}'::jsonb, false)
on conflict do nothing;

-- ── 4) rotina_papel (a quais papéis cada rotina se atribui) ──
-- Coletivas → todos os papéis.
insert into rotina_papel (rotina_id, papel)
select r.id, p.papel
from rotina r
cross join (values ('gestor_contas'::papel), ('gestor_projetos'::papel), ('gestor_trafego'::papel)) as p(papel)
where r.escopo = 'coletiva'
on conflict do nothing;

-- Subconjunto (relatório interno) → Projetos + Tráfego.
insert into rotina_papel (rotina_id, papel)
select r.id, p.papel
from rotina r
cross join (values ('gestor_projetos'::papel), ('gestor_trafego'::papel)) as p(papel)
where r.titulo = 'Atualizar relatório interno no ClickUp (briefing semanal)'
on conflict do nothing;

-- Individuais → papel correspondente ao grupo da rotina.
insert into rotina_papel (rotina_id, papel)
select r.id, 'gestor_projetos'::papel from rotina r where r.escopo = 'individual' and r.titulo in (
  'Comunicação ativa nos grupos','Execução das demandas (copys, planilhas, NPS)',
  'Acompanhamento + pontuação de pendências','Relatório diário (Projetos)',
  'Envio de relatórios pelo criativo','Relatório de saúde do projeto no ClickUp',
  'Relatório semanal (Projetos)','Medir NPS','Ciclo de sprint S1→S4')
on conflict do nothing;

insert into rotina_papel (rotina_id, papel)
select r.id, 'gestor_contas'::papel from rotina r where r.escopo = 'individual' and r.titulo in (
  'Relatório diário das tarefas (fim de expediente)','Check-in com cada Cria')
on conflict do nothing;

insert into rotina_papel (rotina_id, papel)
select r.id, 'gestor_trafego'::papel from rotina r where r.escopo = 'individual' and r.titulo in (
  'Checar campanhas ativas (gasto/CPL/performance)','Otimizar / ajustar campanhas',
  'Relatório de métricas de tráfego')
on conflict do nothing;

-- ── 5) Admin inicial (allowlist) ─────────────────────────────
-- O dono do workspace entra como admin para configurar o resto da squad pela UI.
-- Ajuste o email/nome e adicione os demais membros (Contas, Projetos, Tráfego).
-- O membro_papel do papel_primario é criado automaticamente pelo trigger
-- trg_membro_sync_papel (regra 6).
insert into membro (nome, email, papel_primario, is_admin, ativo) values
  ('Felipe Carvalho', 'e3digital.software@gmail.com', 'gestor_projetos', true, true)
on conflict (email) do nothing;
