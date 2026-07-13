# Catálogo de Rotinas (Lenha de Rotina)

Traduz a seção 1.5 da spec em entradas **seed-ready** pra tabela `rotina` (+ `rotina_papel`).
Cada rotina mapeia pros campos do modelo: `escopo`, `recorrencia_tipo`, `recorrencia_config`.

**Legenda de origem:** `POP` = oficial (não mexer) · `doc` = já na spec · `confirmado` = fechado
na sessão · `⚠ a definir` = pendente (parqueado) · `⚡ evento` = não é recorrente (não entra no
motor de recorrência).

> Cadências de dia da semana usam `recorrencia_tipo`:
> - `diaria` → `{}`
> - `semanal` → `{ "dia": "sex" }` (uma vez por semana num dia)
> - `dias_da_semana` → `{ "dias": ["seg","qui"] }` (vários dias fixos)
> - `mensal` → `{ "dia_mes": 1 }`
> - `sprint` → `{ "ciclo_semanas": 4 }`

---

## 🔵 Coletivas (toda a squad) — `escopo = coletiva`

| Rotina | recorrencia_tipo | recorrencia_config | Origem |
|---|---|---|---|
| Daily (alinhamento interno) — 1ª Lenha do dia | `diaria` | `{}` | doc |
| Weekly (alinhamento da squad) | `semanal` | `{"dia":"sex"}` | doc |
| Planilha BSC | `semanal` | `{"dia":"sex"}` | doc |

## 🟣 Subconjunto — `escopo = subconjunto`, `papeis = [gestor_projetos, gestor_trafego]`

| Rotina | recorrencia_tipo | recorrencia_config | Origem |
|---|---|---|---|
| Atualizar relatório interno no ClickUp (= briefing semanal) | `semanal` | `{"dia":"qui"}` | doc |

## 🟢 Gestor de Projetos — `escopo = individual`, `papel = gestor_projetos`

| Rotina | recorrencia_tipo | recorrencia_config | Origem |
|---|---|---|---|
| Comunicação ativa nos grupos | `diaria` | `{}` | POP |
| Execução das demandas (copys, planilhas, NPS) | `diaria` | `{}` | POP |
| Acompanhamento + pontuação de pendências | `diaria` | `{}` | POP |
| Relatório diário *(sexta é substituído pelo semanal)* | `diaria` | `{}` | POP |
| Envio de relatórios pelo criativo | `semanal` | `{"dia":"seg"}` | POP |
| Relatório de saúde do projeto no ClickUp | `semanal` | `{"dia":"qui"}` | POP |
| Relatório semanal | `semanal` | `{"dia":"sex"}` | POP |
| Medir NPS | `mensal` | `{"dia_mes": ?}` ⚠ | POP |
| Ciclo de sprint S1→S4 | `sprint` | `{"ciclo_semanas":4}` | POP |

> **Nota:** o "Daily de alinhamento com Account e Coordenador" do POP é o **mesmo** Daily
> coletivo — não duplicar. `⚠ a definir`: dia do mês do NPS e a data-âncora do ciclo de sprint.

## 🟡 Gestor de Contas — `escopo = individual`, `papel = gestor_contas`

| Rotina | recorrencia_tipo | recorrencia_config | Origem |
|---|---|---|---|
| Relatório diário das tarefas (fim de expediente) | `diaria` | `{}` | doc |
| Check-in com cada Cria | `semanal` | `{"dia": ?}` *(por Cria)* | **confirmado** |
| Relatório periódico pro cliente | `⚠ a definir` (quinzenal? mensal?) | — | ⚠ |
| Acompanhar renovação / flag de contrato | `⚠ a definir` (mensal? ou ⚡) | — | ⚠ |
| Coletar e validar briefing | `⚡ evento?` (onboarding) | — | ⚠ |
| Enviar conteúdo pra aprovação | `⚡ evento?` | — | ⚠ |

## 🟠 Gestor de Tráfego — `escopo = individual`, `papel = gestor_trafego`

| Rotina | recorrencia_tipo | recorrencia_config | Origem |
|---|---|---|---|
| Checar campanhas ativas (gasto/CPL/performance) | `⚠ a definir` (proposta: `diaria`) | — | ⚠ |
| Otimizar / ajustar campanhas | `⚠ a definir` (proposta: `diaria`) | — | ⚠ |
| Relatório de métricas de tráfego | `⚠ a definir` (proposta: `semanal`) | — | ⚠ |
| Subir campanha nova por Forja | `⚡ evento` (por Forja) | — | ⚠ |

## ⚫ Admin / Felipe

Responsabilidades **contínuas** (visão macro, gestão de membros, acompanhar risco), não rotinas
agendadas. **Proposta: nenhuma Lenha de Rotina** por padrão. `⚠ a definir` se entra uma revisão
macro recorrente.

---

## Pendências parqueadas (resolver depois)

- **Contas:** cadência do relatório pro cliente; renovação como rotina ou evento; confirmar
  "coletar briefing" e "enviar aprovação" como ⚡ evento.
- **Tráfego:** confirmar diária/diária/semanal pras três rotinas; "subir campanha" como ⚡ evento.
- **Projetos:** dia do mês do NPS; data-âncora do ciclo de sprint.
- **Contas — check-in:** definir se cai num dia fixo da semana ou é "toda semana, por Cria".
- **Admin:** rotina recorrente ou nenhuma.
