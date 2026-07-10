# Integração ClickUp — fonte das Crias

Este módulo lê o **ClickUp** e transforma cada task-mestre do **Squad 08** em uma `cria` do
SquadFire. O CRM não cadastra clientes à mão: o ClickUp é a fonte de verdade.

> **Status: esqueleto — PENDENTE DE DEPLOY.** O mapeamento e o filtro estão prontos e testáveis
> (`run-sync.js`). Falta plugar a **gravação no banco** (upsert por `clickup_task_id`) e
> **registrar o webhook** no ClickUp. Ver [§ O que falta](#o-que-falta-deploy).

## Arquivos

| Arquivo | Papel |
|---|---|
| `config.js` | IDs reais do workspace (team/space/list) e custom fields; leitura do token via env |
| `client.js` | cliente HTTP fininho da API v2 do ClickUp (`getTasksListaMestre`, `getTask`) |
| `sync-crias.js` | filtra **Squad 08** e mapeia task → objeto `cria` (puro/testável, não conhece o DB) |
| `webhook.js` | handler de webhook (verifica assinatura → devolve ação `upsert`/`unlink`/`delete`) |
| `push-briefing.js` | **CRM → ClickUp**: publica o briefing semanal como **comentário** na task do cliente |
| `run-sync.js` | runner manual: imprime as Crias mapeadas (não grava) |

## Como funciona

```
ClickUp (Space "Projetos")
  └─ Folder "Gestão de Projetos" › List "Estruturação"  (901324100247)  ← lista-mestre
         1 task = 1 escritório · status = ciclo de vida · custom fields Squad/Semana
                         │
              getTasksListaMestre()   (paginado, com custom_fields)
                         │
              filtro  Squad = "Squad 08"   (isSquad08)
                         │
              mapTaskToCria()  →  { clickup_task_id, nome_cliente, fase, status, … }
                         │
              upsert por clickup_task_id   ← A FAZER (camada de banco)
```

- **Filtro:** a API do ClickUp não filtra por custom field, então puxamos a lista inteira e
  filtramos `Squad 08` no código (`custom_fields[].value`).
- **Fase:** o custom field _Semana_ (orderindex 0 = Semana 1) vira a fase da Forja (1–7). Sem Semana
  ou status de backlog → Cria fica no **backlog** (pré-forja, sem prazos).
- **Idempotência:** tudo é chaveado por `clickup_task_id`. Task que sai do Squad 08 → ação `unlink`
  (não se apaga a Cria; o consumidor decide).

Mapa de campos completo e IDs: [`docs/modelo-de-dados.md` § Integração ClickUp](../../docs/modelo-de-dados.md#integração-clickup-fonte-das-crias).

## Rodar o sync (manual)

```bash
# token só em env — nunca comitar
export CLICKUP_API_TOKEN=pk_xxxxxxxx
node integracao/clickup/run-sync.js
```

Requer Node ≥ 18 (usa `fetch` global). Deve listar ~29 Crias do Squad 08 (21 em execução + 8 no
backlog), batendo com o protótipo (`design/app.html`).

## Webhook

`webhook.js` expõe `handleWebhook({ rawBody, signature, payload })`:

1. verifica a assinatura HMAC-SHA256 (`X-Signature`) com `CLICKUP_WEBHOOK_SECRET`;
2. re-busca a task e reavalia o gate Squad 08;
3. devolve uma ação: `upsert` (Cria), `unlink` (saiu do Squad 08) ou `delete`.

Plugue num route handler (Next.js `app/api/clickup/webhook/route.ts`, edge function, etc.) que
receba o corpo cru, chame `handleWebhook` e aplique a ação no banco.

## Briefing → comentário no ClickUp (CRM → ClickUp)

Único fluxo de **escrita** da integração. `push-briefing.js`:

```js
import { pushBriefing } from './push-briefing.js';
// cria.clickup_task_id = task-mestre do cliente; briefing = os 6 campos
const { clickup_comment_id } = await pushBriefing(cria, briefing);
// grave clickup_comment_id no briefing pra não duplicar em reenvios
```

O briefing semanal (6 campos, gerado pela IA a partir do áudio) vira um **comentário na task do
cliente** — não cria task nova. Assim o time vê o histórico semanal direto no card do ClickUp.

## O que falta (deploy)

- [ ] Camada de banco: `upsertCria(cria)` / `unlinkCria(taskId)` (Supabase, por `clickup_task_id`).
- [ ] Ligar `pushBriefing` ao gerar o briefing e gravar `clickup_comment_id` (evita duplicar).
- [ ] Resolver **Gestor de Projetos** (custom field) → `gestor_contas_id` por email/nome.
- [ ] Agendar o sync (cron) além do webhook em tempo-real.
- [ ] Registrar o webhook no ClickUp apontando pra rota pública + setar `CLICKUP_WEBHOOK_SECRET`.
- [ ] Token de produção: **personal token** para o cron server-side (nunca no cliente).

## Variáveis de ambiente

Ver `.env.example` na raiz. As deste módulo:

```
CLICKUP_API_TOKEN=pk_xxxxxxxx        # personal/OAuth token — server-side
CLICKUP_WEBHOOK_SECRET=xxxxxxxx      # segredo do webhook (assinatura HMAC)
```
