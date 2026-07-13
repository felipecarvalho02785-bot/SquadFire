# Roteiro de produção — SquadFire / Squad 8

Diagnóstico do protótipo e o plano, ponto a ponto, pra tirar o SquadFire do
mock estático e colocar no ar **com as integrações** (ClickUp, IA, WhatsApp,
Google). Prioridades: **P0** = bloqueia o MVP no ar · **P1** = importante ·
**P2** = depois. Esforço: baixo / médio / alto.

---

## 1. Onde estamos hoje

- **Protótipo** `design/app.html` — HTML/CSS/JS estático, sem backend. Todas as
  telas navegam, a identidade (fogo/forja/dragão, fontes da marca, tema
  claro/escuro) está pronta, e muita interação já funciona em sessão.
- **Docs** `docs/` — modelo de dados conceitual, camada de IA, especificação
  funcional e rotinas.
- **Integração ClickUp** `integracao/clickup/` — esqueleto (client, sync das
  Crias com filtro Squad 08, webhook, push de briefing). **Pendente de deploy**:
  registrar o webhook e mapear os custom fields que faltam.

### ✅ Feito nesta rodada de produção (jul/2026)

O P0 saiu do papel. Já no repositório e **validado**:

- **Banco `supabase/`** — migrations 0001–0008 (extensões/helpers, 12 enums,
  todas as tabelas dos Mód. 1-3 com constraints/índices, regras de negócio como
  triggers, auth+RLS por papel, grants) + `seed.sql` (7 fases, checklists, 18
  rotinas, admin inicial). **Validado contra Postgres 16**: 100% dos testes de
  trigger e da matriz de RLS passando (ver `supabase/README.md`).
  - Regra 1 (Cria→Forja+7 fases+Lenhas), Regra 2 (contrato→cascata de prazos),
    Regra 3 (`avancar_fase` com checklist + gate de papel), Regra 6 (papel
    primário mantido automaticamente — compatível com o modelo REST).
- **App `Next.js 15`** (App Router + TS + `@supabase/ssr`) — `next build` limpo,
  13 rotas. Auth Google SSO + middleware + allowlist; shell da Forja; telas
  data-driven (Meu Dia, Covil, Crias + detalhe, Tarefas) com RLS aplicada;
  Calendário/Faísca como placeholders das integrações P1; modo demonstração
  quando o Supabase não está configurado.
- **Sync ClickUp** — `status_cria` reconciliado (churn/finalizada→encerrada,
  hold→pausada), rota `/api/clickup/sync` (upsert por `clickup_task_id`,
  service_role) e **webhook** `/api/clickup/webhook` (HMAC → upsert em quase-tempo-real).
- **Ações interativas** — Server Actions: concluir a própria Lenha (RLS decide) e
  **avançar fase** via RPC `public.avancar_fase` (checklist + gate de papel no banco).
- **Motor de recorrência** — `app.gerar_lenhas_do_dia` gera as Lenhas de Rotina do
  dia por papel (idempotente); cron `/api/rotinas/gerar` (diário). Cadências
  fechadas ativas; sprint/NPS/tráfego seguem parqueadas (seed `ativo=false`).
- **CI verde** — GitHub Actions: build + typecheck + `node --test` + testes de
  banco (migrations/seed/RLS/triggers/recorrência contra Postgres 16).

**Falta pra ir ao ar:** provisionar o Supabase (projeto + Google OAuth) e a
Vercel, e preencher as envs. Ver [`docs/deploy.md`](deploy.md).

## 2. Diagnóstico da auditoria (jul/2026)

Varredura completa (código + funcional + produto), com verificação adversarial.

### Saúde do código: limpa
0 erros de runtime, 0 IDs duplicados, todas as abas navegam, todas as sub-abas
têm painel, e os handlers têm guarda (`if(!el) return`) — nada estoura.

### Corrigido nesta rodada
- **Estrutura:** `app.html` ganhou esqueleto HTML real (`<!DOCTYPE>`, `charset
  utf-8`, `viewport`) — sem isso havia risco de mojibake nos acentos e o mobile
  não engatava. Removido código morto de sparkline. `&` cru escapado.
- **Coerência de dados:** fase da Letícia (Fase 3 · Treinamento) e do Mozini
  (Fase 3, batendo com o ClickUp real) alinhadas em todos os pontos; status de
  saúde na tabela refletindo os alertas; `%` no prazo unificado (83%); gráficos
  do Covil batendo com a carteira real (donut soma 21; "Forjas por fase" =
  `[1,3,15,2,0,0,0]`); gênero da cliente na Faísca; datas coerentes.
- **Controles antes mortos** (agora respondem em sessão): cards do Kanban abrem
  a Cria, "Criar Cria e abrir a Forja" abre a Forja, compositor de comentários,
  checklists (Covil/detalhe/perfil/Roda de Fogo) e o toggle de densidade.
- **Produto:** removido o "gestor único" da Cria — a Squad inteira assume o
  cliente (Nova Cria sem o campo Gestor; tabela sem a coluna Gestor; Kanban e
  detalhe sem "Luiz M." como dono).

### Fica pra fase de produção (depende de backend/dados)
São **inerentes ao protótipo sem servidor** — não são bugs, são o trabalho de
virar app real (detalhado no roteiro abaixo):
- O **detalhe da Cria é um exemplo único** (Letícia) e o **Perfil da Brigada**
  mostra o nome do membro clicado com KPIs fixos — ambos precisam ser
  data-driven. (O Perfil ainda depende de decidir o que mostrar por membro,
  agora que a carteira é da Squad e não de um dono.)
- CTAs que exigem backend: baixar/ver PDF, gravar áudio de verdade, enviar na
  Faísca, "+ Nova Lenha", ações da Forjaria (salvar, convidar, integrações),
  navegação de mês do Calendário, cards da Biblioteca abrirem preview.

## 3. Caminho crítico do MVP (ordem sugerida dos P0)

```
Supabase + Google SSO  ──►  migrations (enums + tabelas + seeds)  ──►  RLS por papel
        │                                     │
        │                          trigger: Cria → Forja + 7 fases + Lenhas
        ▼                                     ▼
  Scaffold Next.js  ──►  App shell + auth  ──►  camada de dados  ──►  Crias/Detalhe/Covil data-driven
                                                     │
                          ClickUp: upsertCria/unlink (webhook + cron)  ◄── fonte das Crias
                                                     │
                    IA: áudio → Gemini → Claude (6 campos) → push comentário no ClickUp
```
Com esse trilho, o MVP já **espelha as Crias do ClickUp**, roda a **Forja das 7
fases** e fecha o **ciclo do briefing** (áudio → IA → ClickUp).

---

## 4. Roteiro por área

### 4.1 Frontend (protótipo → app Next.js)

**P0**
- **[médio] Scaffold Next.js 15 (App Router) + TS + Vercel AI SDK** — projeto em
  TS, ESLint/Prettier; `ai` + `@ai-sdk/google` + `@ai-sdk/anthropic`,
  `@supabase/ssr`, `zod`. Segredos só server-side.
- **[baixo] Portar tokens/fontes/temas pro `globals.css`** — `:root` (ember,
  plasma, good/warn/crit), `theme-light`, `no-anim`; Grenze/Grenze Gotisch via
  `next/font/local`; assets (dragão, ícones, avatares) pra `/public`.
- **[médio] App shell** — `rail` + `topbar` + Faísca como `layout.tsx`; trocar o
  roteamento por texto (`SMAP`/`openScreen`) por rotas reais e `<Link>`.
- **[médio] Auth: Google SSO + allowlist** — middleware protege o grupo `(app)`;
  carrega o membro logado (papéis + `is_admin`); `login.html` → `(auth)/login`.
- **[médio] Camada de dados Supabase** — clientes server/client com o JWT do
  usuário (RLS); tipos gerados; reads nos Server Components.
- **[alto] Detalhe da Cria/Forja data-driven** (`/crias/[id]`) — cabeçalho, KPIs,
  Termômetro das 7 fases e as 5 abas montados dos dados.
- **[médio] Lista de Crias data-driven** — tabela `cria` (Squad 08) + filtros
  server-side; cada linha → `/crias/[id]`.
- **[alto] Covil por papel** — tela-casa composta por `papel_primario`+`is_admin`;
  KPIs do topo de agregações reais.
- **[médio] Gravação de áudio real** (MediaRecorder) + upload pro Storage — na
  Roda de Fogo e na aba Briefing.
- **[alto] Pipeline do briefing** (UI) — áudio → IA (6 campos editáveis) →
  publicar comentário no ClickUp (idempotente por `clickup_comment_id`).

**P1** — Kanban data-driven · Tarefas data-driven (+ concluir a própria Lenha) ·
reconciliar "Nova Cria" com o ClickUp como fonte (vira fluxo de contrato/
onboarding, não cadastro manual) · comentários reais (Server Action) · Faísca
(chat streaming + voz + tool-calling) · Brigada/Perfil data-driven · Biblioteca
ligada ao Drive · componentizar gráficos + motor SF·VIDA · tema persistido +
passe de acessibilidade.

**P2** — Calendário data-driven (prazos de fase + Lenhas + **reuniões da Google
Agenda**) · "Agenda de hoje" no Meu Dia · estados de loading/erro/vazio.

### 4.2 Backend & dados (Supabase)

**P0**
- **[baixo] Bootstrap Supabase + migração base** — `supabase/migrations/`,
  `pgcrypto`, padrão de colunas (`id uuid`, `created_at/updated_at`), trigger
  `set_updated_at()`.
- **[baixo] Enums do domínio (12) + reconciliar `status_cria`** — ⚠️ o doc define
  `('ativa','pausada','encerrada')`, mas `sync-crias.js` devolve `'churn'` e
  `'finalizada'`. **Decidir:** estender o enum OU mapear churn/finalizada →
  `encerrada` no upsert. Sem isso o upsert das Crias quebra em runtime.
- **[médio] Tabelas núcleo (Mód. 1-3) + constraints** — `unique
  cria.clickup_task_id`, `unique forja.cria_id`, CHECK de integridade da `lenha`
  (forja × rotina), índices; regra `membro.papel_primario ∈ membro_papel` via
  trigger.
- **[baixo] Seeds** — catálogo das 7 fases (fase 1 = gate "Diagnóstico
  respondido"), Lenhas de Forja padrão por fase, rotinas (`docs/rotinas.md`).
- **[médio] Google SSO + allowlist + claims no JWT** — hook rejeita email fora de
  `membro`; token injeta `papeis`/`is_admin`/`membro_id` pra RLS.
- **[médio] RLS por papel** — SELECT amplo; escrita pela matriz do doc (criar
  Cria → contas/admin; mover fase/distribuir Lenha → projetos/admin; mídia →
  tráfego/admin; concluir a própria Lenha → qualquer papel). Helpers
  `has_papel()`/`is_admin()`.
- **[médio] Trigger Cria → Forja + 7 fases + Lenhas padrão** (idempotente pro
  sync).
- **[médio] Camada de banco do sync ClickUp** — `upsertCria`/`unlinkCria` por
  `clickup_task_id`; resolver "Gestor de Projetos" → `membro`.
- **[médio] Cascade de prazos das 7 fases** — ao setar `forja.data_inicio`,
  calcula início/fim previstos em cascata (7 dias/fase).
- **[baixo] Buckets de Storage** (contratos, áudios, entregáveis) com RLS.

**P1** — extração de contrato (Gemini → `valor_contrato`/`data_inicio`) ·
job `cria.em_risco` por SLA · motor de recorrência (Lenhas de rotina) · RPC
guardada de avanço de fase (checklist + gate) · persistência do push de briefing
· cron do sync.

**P2** — views de analytics pro Covil do Admin · entidades de backlog (`nps`,
`formulario_resposta`, `notificacao`, `entregavel`).

### 4.3 Integrações

**P0 (ClickUp é a fonte das Crias)**
- **[alto] `upsertCria`/`unlinkCria` por `clickup_task_id`** — consome
  `mapTaskToCria()`; 1º insert dispara Forja+fases; **reconciliar status**
  (churn/finalizada → encerrada).
- **[médio] Resolver "Gestor de Projetos" → membro e capturar "Link do grupo"** —
  ⚠️ os field ids desses dois custom fields **ainda não estão** em `config.js`
  (só há Squad e Semana). Ler ambos; casar o gestor por email contra `membro`; o
  Link do grupo amarra o WhatsApp.
- **[baixo] Cron de sync** (reconciliação a cada ~15-30 min).
- **[médio] Registrar o webhook + secret + rota pública** — `POST
  /api/clickup/webhook` recebe o corpo cru → `handleWebhook`. ⚠️ o ClickUp
  **gera e devolve o secret** no registro; guardar em `CLICKUP_WEBHOOK_SECRET`
  (não é inventado localmente), senão a verificação HMAC rejeita tudo.
- **[baixo] Ligar `pushBriefing` + `clickup_comment_id`** — ⚠️ em reenvio,
  **atualizar** o comentário (falta `updateTaskComment` / `PUT /comment/{id}` no
  `client.js`); hoje só há `createTaskComment` e duplicaria no card.
- **[alto] Módulo de IA + pipeline áudio→briefing** — Gemini transcreve →
  Claude estrutura os 6 campos (`generateObject` + Zod) → grava `briefing` →
  push no ClickUp. Chaves só em env.

**P1** — saída estruturada (Zod) + prompt caching + templates versionados ·
`extrairContrato` (Gemini) → cascade de prazos · `planoDoGargalo` (Claude) ·
ingestão WhatsApp (Evolution/Criativivo) dos grupos · SLA de grupos →
`em_risco` + briefing · briefing pré-preenchido pela leitura do grupo.

- **[médio] Google Calendar (agenda) — P1.** O Calendário e o "Meu Dia" mostram
  as **reuniões do dia** puxadas da **Google Agenda** dos membros (leitura: OAuth
  Google Calendar API, eventos do dia/mês por membro). **Escrita:** ao agendar
  uma Roda de Fogo, criar o evento na agenda dos participantes (Faísca § 7.6).
  No protótipo isso já aparece demonstrado (selo "Sincronizado com Google Agenda"
  no Calendário + bloco "Agenda de hoje" no Meu Dia).

**P2** — Faísca (chat global com tool-calling + voz) · Google Meu Negócio
(Business Profile API) na Auditoria de Mídia.

> Em aberto na spec (2.7): arquitetura híbrida do WhatsApp (webhooks de saída do
> Criativivo) — a validar com a instância real.

### 4.4 Auth, deploy, segurança & LGPD

**P0**
- **[médio] Provisionar Supabase (região sa-east-1/São Paulo, por LGPD) + Google
  SSO** — OAuth consent interno E3; `GOOGLE_CLIENT_ID/SECRET`; redirect URLs do
  Supabase e da Vercel. É a fundação — nada roda sem isso.
- Deploy do app + rotas server-side na **Vercel**; Supabase gerenciado.
- **Gestão de segredos** só server-side (já no `.gitignore`/`.env.example`):
  `ANTHROPIC_API_KEY`, `GOOGLE_*`, `CLICKUP_API_TOKEN`/`WEBHOOK_SECRET`, chaves
  Supabase.

**P1/P2** — observabilidade/logs; retenção de dados (contratos/áudios enviados à
IA); LGPD (dados de clientes/áudios; região BR); rate limiting das rotas de IA;
backup; **CI** (o repo hoje não tem) — lint + typecheck + testes + `supabase db`
em PR.

---

## 5. Pontos de atenção (reconciliações antes do deploy)

1. ~~**`status_cria` × sync**~~ — ✅ **resolvido**: `sync-crias.js` mapeia
   churn/finalizada→`encerrada` e hold→`pausada`; a distinção fina vai em
   `_source.motivo`. O enum permanece `('ativa','pausada','encerrada')`.
2. **Custom fields faltando no `config.js`** — "Gestor de Projetos" e "Link do
   grupo" não têm field id mapeado (só Squad e Semana).
3. **Idempotência do briefing** — falta `updateTaskComment` pra reenvio não
   duplicar o comentário no ClickUp.
4. **Secret do webhook** — é gerado pelo ClickUp no registro, não localmente.
5. **Perfil da Brigada × "sem dono único"** — decidir o que o perfil mostra por
   membro agora que a carteira é da Squad (Lenhas/Rodas/atividade do membro, não
   "Crias dele").
