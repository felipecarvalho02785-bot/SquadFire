# Modelo de Dados — CRM Squad 8

Base: **Supabase / PostgreSQL**. Este documento traduz a especificação funcional e as decisões
de refinamento em entidades, enums, relacionamentos e regras de negócio. É um **design de
schema** (fonte pra migrations), não migration final.

> Convenções: toda tabela tem `id uuid pk`, `created_at timestamptz`, `updated_at timestamptz`.
> Nomes de tabela no singular, snake_case. FKs terminam em `_id`.

---

## Mapa das entidades

```
Membro ──< MembroPapel                         (N:N com papéis + papel primário)
Membro ──< Lenha (responsável)
Membro ──< Rotina? (via RotinaPapel / atribuição)

Cria (1) ─── (1) Forja                          (1:1, criada no cadastro)
Cria ──< Contrato                               (anexos + extração por IA)
Cria ──< Comentario
Cria ──< Gargalo ──(1)── PlanoDeAcao
Cria ──< Briefing
Cria ──< Nps                                    (backlog)

Forja ──< FaseDaForja ──< Lenha (tipo=forja)    (Lenha pendura na FASE, não na Forja)
Fase (catálogo 7) ──< FaseDaForja

Rotina ──< RotinaPapel                          (escopo: individual/subconjunto/coletiva)
Rotina ──< Lenha (tipo=rotina)                  (ocorrências geradas pelo motor de recorrência)
```

`Fogueira` **não é tabela** — é o board Kanban (Linha de Fogo), uma visão sobre `Forja` +
`FaseDaForja`.

---

## Enums

```sql
-- Papéis operacionais (Admin é flag à parte, não entra aqui)
create type papel as enum ('gestor_contas', 'gestor_projetos', 'gestor_trafego');

-- Produto (hoje travado em 'estruturacao'; enum já previsto pra futuros)
create type produto as enum ('estruturacao'); -- futuro: 'alavancagem', 'e3_light'

-- Ciclo de vida da Cria ('em_risco' NÃO entra aqui — é flag derivada)
create type status_cria as enum ('ativa', 'pausada', 'encerrada');

-- Flag de contrato da Forja
create type flag_contrato as enum ('forja_quente', 'brasa_viva'); -- setup / manutenção

-- Fase da Forja
create type status_fase as enum ('pendente', 'em_andamento', 'concluida');

-- Lenha (tarefa)
create type tipo_lenha as enum ('forja', 'rotina');
create type status_lenha as enum ('pendente', 'em_andamento', 'concluida', 'cancelada');
create type prioridade_lenha as enum ('baixa', 'media', 'alta');

-- Rotina (Lenha de Rotina — template recorrente)
create type escopo_rotina as enum ('individual', 'subconjunto', 'coletiva');
create type recorrencia_tipo as enum ('diaria', 'dias_da_semana', 'semanal', 'mensal', 'sprint');

-- Gargalos
create type status_gargalo as enum ('aberto', 'em_resolucao', 'resolvido');

-- Briefing
create type origem_briefing as enum ('audio', 'grupo_whatsapp', 'manual');
```

---

## Módulo 1 — Acesso e Membros

### `membro`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| nome | text | |
| email | text unique | usado na allowlist de login (Google SSO) |
| papel_primario | papel | define a **tela-casa** do Covil |
| is_admin | boolean default false | Admin = flag à parte (Felipe) |
| ativo | boolean default true | desativa acesso sem apagar histórico |
| created_at / updated_at | timestamptz | |

### `membro_papel` (N:N — múltiplos papéis)

| Campo | Tipo | Notas |
|---|---|---|
| membro_id | uuid fk → membro | |
| papel | papel | |
| **pk** | (membro_id, papel) | |

> Regra: `membro.papel_primario` **deve** existir em `membro_papel` do próprio membro.

### `rotina` (Lenha de Rotina — template recorrente)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| titulo | text | ex.: "Daily", "Relatório de saúde no ClickUp" |
| descricao | text null | |
| escopo | escopo_rotina | individual / subconjunto / coletiva |
| recorrencia_tipo | recorrencia_tipo | diaria, dias_da_semana, semanal, mensal, sprint |
| recorrencia_config | jsonb | parametriza a cadência (ver abaixo) |
| ativo | boolean default true | |

**`recorrencia_config` por tipo:**

- `diaria` → `{}` (todo dia)
- `dias_da_semana` → `{ "dias": ["seg","qui","sex"] }`
- `semanal` → `{ "dia": "sex" }`
- `mensal` → `{ "dia_mes": 1 }` ou `{ "regra": "ultimo_dia_util" }`
- `sprint` → `{ "ciclo_semanas": 4, "semana": 1 }` (S1–S4)

> **Por que jsonb:** o doc (1.5) exige cadências mistas — diária fixa **+** por dia da semana
> **+** mensal (NPS) **+** sprint. Um enum simples "diária/semanal/mensal" não cobre.

### `rotina_papel` (a quais papéis a rotina se atribui)

| Campo | Tipo | Notas |
|---|---|---|
| rotina_id | uuid fk → rotina | |
| papel | papel | |
| **pk** | (rotina_id, papel) | |

> Escopo `coletiva` = todas as linhas de papel (ou flag "todos"); `individual`/`subconjunto` =
> um ou alguns papéis. Ex.: relatório interno no ClickUp = {gestor_projetos, gestor_trafego}.

---

## Módulo 2 — Crias (Clientes)

### `cria`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| nome_cliente | text | |
| email | text | |
| telefone_whatsapp | text | |
| area_atuacao | text | área do direito |
| produto | produto default 'estruturacao' | **travado** (não editável na UI) |
| investimento_midia | numeric(12,2) null | **verba de campanha** que o cliente investe em mídia — **editável**, começa null (alinhada com o cliente após onboarding). **≠ valor do contrato** (esse mora em `contrato.valor_contrato`) |
| closer | text null | quem fechou o contrato |
| gestor_contas_id | uuid fk → membro null | responsável (campo de sistema) |
| status | status_cria default 'ativa' | ciclo de vida |
| em_risco | boolean default false | **derivado** (SLA/NPS) — recalculado, não editado à mão |
| clickup_task_id | text null unique | id da task-mestre no ClickUp (list "Estruturação") — **chave de vínculo** |
| clickup_squad | text null | valor do custom field _Squad_ no ClickUp; no CRM só entra `Squad 08` |
| clickup_semana | smallint null | ordinal do custom field _Semana_ (1–7) → fase da Forja |
| sincronizado_em | timestamptz null | último sync bem-sucedido vindo do ClickUp |
| created_at / updated_at | timestamptz | |

> `em_risco` é materializado por job/trigger (SLA de fase estourando ou NPS baixo). A flag de
> contrato mora na `forja` (setup × manutenção).
>
> **Origem dos dados:** a `cria` é o espelho local de uma task-mestre do ClickUp. O vínculo é por
> `clickup_task_id` (idempotente); `nome_cliente`, `status`, `clickup_squad`, `clickup_semana` e os
> gestores chegam do sync. Só sobem pro CRM tasks com `clickup_squad = 'Squad 08'`. Ver
> [§ Integração ClickUp](#integração-clickup-fonte-das-crias).

### `contrato`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| cria_id | uuid fk → cria | |
| arquivo_url | text | caminho no Supabase Storage |
| valor_contrato | numeric(12,2) null | mensalidade/fee da Estruturação (extraído do PDF pela IA). **≠ `cria.investimento_midia`** (verba de campanha) |
| dados_extraidos | jsonb null | JSON estruturado devolvido pela IA (API Anthropic) |
| data_inicio_extraida | date null | gatilho dos prazos do funil |
| confirmado | boolean default false | usuário conferiu/corrigiu a extração |
| created_at | timestamptz | |

> Fluxo: anexa PDF → IA lê server-side → preenche `dados_extraidos` + `data_inicio_extraida` →
> usuário confere → ao confirmar, `forja.data_inicio` é setada e os prazos das fases calculados.

### `comentario`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| cria_id | uuid fk → cria | |
| autor_id | uuid fk → membro | |
| corpo | text | |
| anexo_url | text null | arquivo complementar no Storage |
| created_at | timestamptz | registro contínuo/incremental |

### `gargalo`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| cria_id | uuid fk → cria | |
| fase_da_forja_id | uuid fk → fase_da_forja | fase em que o gargalo ocorreu |
| descricao | text | |
| status | status_gargalo default 'aberto' | aberto / em_resolucao / resolvido |
| created_at / updated_at | timestamptz | |

> Vincular à fase permite a **inteligência de gargalos por fase** no Covil do Admin (padrões:
> "todo mundo trava na mesma etapa").

### `plano_de_acao` (1:1 com gargalo)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| gargalo_id | uuid fk → gargalo unique | |
| responsavel_id | uuid fk → membro null | |
| prazo | date null | |
| gerado_por_ia | boolean default false | IA sugere, membro edita/confirma |
| created_at / updated_at | timestamptz | |

### `plano_passo` (passos do plano)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| plano_de_acao_id | uuid fk → plano_de_acao | |
| ordem | int | |
| descricao | text | |
| concluido | boolean default false | |

### `briefing` (relatório semanal — 6 campos)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| cria_id | uuid fk → cria | |
| forja_id | uuid fk → forja null | |
| semana_referencia | date | segunda-feira da semana, por ex. |
| origem | origem_briefing | audio / grupo_whatsapp / manual |
| c1_o_que_aconteceu | text null | |
| c2_satisfacao | text null | |
| c3_campanhas | text null | |
| c4_nosso_desempenho | text null | |
| c5_pontos_atencao | text null | |
| c6_proximos_passos | text null | |
| audio_url | text null | gravação (MediaRecorder → Storage) |
| autor_id | uuid fk → membro | |
| enviado_clickup | boolean default false | |
| clickup_task_id | text null | **task-mestre do cliente** no ClickUp (= `cria.clickup_task_id`) — o briefing é publicado como **comentário** nela, não como task nova |
| clickup_comment_id | text null | id do comentário criado no ClickUp (idempotência do push / evita duplicar) |
| created_at / updated_at | timestamptz | |

> Dois caminhos convivem: (a) áudio ditado pelo membro → IA estrutura os 6 campos → push ClickUp;
> (b) leitura do grupo de WhatsApp (Evolution/Criativivo) → IA pré-preenche → membro revisa.
>
> **Ida ao ClickUp (CRM → ClickUp):** ao publicar o briefing, o texto estruturado (6 campos) vira um
> **comentário na task-mestre do cliente** (`cria.clickup_task_id`), via endpoint de comentários da
> API. Guarda-se `clickup_comment_id` pra não duplicar em reenvios. É o único fluxo de escrita
> CRM → ClickUp; todo o resto é leitura (ClickUp → CRM).

---

## Módulo 3 — Forja (Estruturação)

### `fase` (catálogo — 7 fases fixas)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| ordem | int unique | 1..7 |
| nome | text | nome **operacional** (ver seed) |
| duracao_dias | int default 7 | |
| is_gate | boolean default false | fase com pré-requisito pra avançar |
| gate_descricao | text null | ex.: "Formulário Diagnóstico respondido" |

**Seed das 7 fases:**

| ordem | nome | duracao_dias | is_gate |
|---|---|---|---|
| 1 | Alinhamento / Boas-vindas | 7 | ✅ (Formulário Diagnóstico) |
| 2 | Diagnóstico 360 | 7 | — |
| 3 | Treinamento Comercial (equipe) | 7 | — |
| 4 | Consultoria Comercial (sócios) | 7 | — |
| 5 | Implementação CRM + IA | 7 | — |
| 6 | Auditoria de Mídia | 7 | — |
| 7 | Auditoria Criativa | 7 | — |

### `forja` (1:1 com Cria)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| cria_id | uuid fk → cria unique | 1 Cria = 1 Forja |
| data_inicio | date null | vem da leitura do contrato; gatilho dos prazos |
| flag_contrato | flag_contrato default 'forja_quente' | setup × manutenção |
| fase_atual_id | uuid fk → fase_da_forja null | ponteiro pra fase corrente |
| concluida | boolean default false | true quando a 7ª fase conclui |
| created_at / updated_at | timestamptz | |

### `fase_da_forja` (instância de cada fase numa Forja)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| forja_id | uuid fk → forja | |
| fase_id | uuid fk → fase | |
| ordem | int | copiado de fase.ordem (facilita sort) |
| data_prevista_inicio | date null | calculada a partir de `forja.data_inicio` |
| data_prevista_fim | date null | previsto_inicio + duracao_dias |
| data_realizada_inicio | date null | |
| data_realizada_fim | date null | |
| status | status_fase default 'pendente' | |
| **unique** | (forja_id, fase_id) | |

> **SLA/atraso** é derivado: `status <> 'concluida' AND now() > data_prevista_fim` → alerta
> vermelho no Covil. O prazo não avança a fase sozinho.

---

## Módulo 1 & 3 — Lenha (tarefa)

### `lenha`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| tipo | tipo_lenha | forja / rotina |
| titulo | text | |
| descricao | text null | |
| status | status_lenha default 'pendente' | |
| prioridade | prioridade_lenha default 'media' | |
| prazo | date null | |
| responsavel_id | uuid fk → membro null | |
| fase_da_forja_id | uuid fk → fase_da_forja null | preenchido quando tipo='forja' |
| rotina_id | uuid fk → rotina null | preenchido quando tipo='rotina' (ocorrência) |
| data_referencia | date null | dia da ocorrência (rotina) |
| concluida_em | timestamptz null | |
| created_at / updated_at | timestamptz | |

> **Check de integridade:** `tipo='forja'` ⇒ `fase_da_forja_id not null`, `rotina_id null`;
> `tipo='rotina'` ⇒ `rotina_id not null`, `fase_da_forja_id null`.
> A Lenha de Forja pendura na **fase** (não na Forja) pra preservar histórico quando a fase avança.

---

## Backlog (entidades previstas, não V1)

- **`nps`** — nota mensal por Cria (`cria_id`, `mes_referencia`, `nota`, `comentario`); alimenta
  `cria.em_risco` e o campo "Satisfação" do briefing.
- **`formulario_resposta`** — respostas do Formulário de Acesso e do Formulário Diagnóstico;
  o Diagnóstico é o **gate** da fase 1→2 e insumo pra IA rascunhar o Diagnóstico 360.
- **`notificacao`** — SLA estourando, fase a vencer, briefing pendente, gargalo sem plano.
- **`entregavel`** — PDFs/documentos por fase (Diagnóstico 360, treinamento, etc.), no Storage.

---

## Regras de negócio (invariantes)

1. **Cadastro dispara a Estruturação.** Ao criar `cria`, criar automaticamente `forja` + as 7
   `fase_da_forja` (a partir do seed de `fase`) + as **Lenhas de Forja padrão** de cada fase
   (ver seed abaixo). Sem escolha de produto, sem criação manual de Forja.
2. **Contrato é opcional no cadastro; prazos vêm dele.** A Cria pode ser cadastrada **sem
   contrato**: a Forja nasce com `data_inicio` nula e as 7 fases em `pendente`, **sem prazos**.
   Ao anexar e **confirmar** o contrato, `forja.data_inicio` recebe a data extraída pela IA e os
   `data_prevista_inicio`/`fim` de cada fase são calculados em cascata (fase N começa quando N-1
   fecha no previsto; 7 dias cada). Enquanto não há data, nada de SLA/atraso.
3. **Avanço de fase = manual + checklist.** Só conclui a fase quando as Lenhas de Forja dela
   estão concluídas (e o gate, se houver, cumprido). Avançar seta `data_realizada_fim` da fase
   atual, `data_realizada_inicio` da próxima e move `forja.fase_atual_id`.
4. **SLA é sinal, não trava.** Fase vencida (`now() > data_prevista_fim` e não concluída) acende
   alerta; nunca vira a fase automaticamente.
5. **`cria.em_risco` é derivado.** Recalculado por SLA estourando ou NPS baixo — nunca setado à mão.
6. **Papel primário válido.** `membro.papel_primario` tem que estar em `membro_papel`.
7. **Visibilidade total, delegação por papel.** Todos leem Crias e Forjas; edição/delegação e a
   composição do Covil dependem do papel (RLS por papel + `is_admin`).

---

## Permissões por papel (base pra RLS)

Passada grossa — todos **leem** tudo; a **edição** é por papel. Refina na implementação das
políticas RLS. `Admin` (flag) libera tudo.

| Recurso / Ação | Contas | Projetos | Tráfego | Admin |
|---|---|---|---|---|
| Ler tudo (Crias, Forjas, Lenha, Covil) | ✅ | ✅ | ✅ | ✅ |
| Criar / editar Cria + Contrato | ✅ | — | — | ✅ |
| Comentário / Briefing | ✅ | ✅ | — | ✅ |
| Mover fase da Forja (avançar) | — | ✅ | — | ✅ |
| Criar / distribuir Lenha de Forja | — | ✅ | — | ✅ |
| Editar campos de mídia / campanha | — | — | ✅ | ✅ |
| Gargalo + Plano de Ação | ✅ | ✅ | — | ✅ |
| Concluir a **própria** Lenha (Forja/Rotina) | ✅ | ✅ | ✅ | ✅ |
| Gestão de membros / allowlist | — | — | — | ✅ |

> Regra transversal: quem só é `responsavel_id` de uma Lenha pode mudar o **status dela**, mas
> não criar/redistribuir — isso é do dono do recurso (Projetos pra Forja, Admin no geral).

---

## Seed — Lenha de Forja padrão por fase

Gerado junto com a Forja (regra 1). Fases 1–2 já concretas (fonte: spec 3.3); 3–7 com placeholder
até o Felipe detalhar. É o **checklist** cuja conclusão habilita avançar a fase.

| Fase | Lenha de Forja padrão | Gate |
|---|---|---|
| 1 · Alinhamento / Boas-vindas | Reunião de alinhamento · Enviar Formulário de Acesso · Enviar Formulário Diagnóstico | **Formulário Diagnóstico respondido** (trava fase 1→2) |
| 2 · Diagnóstico 360 | Elaborar documento Diagnóstico 360 (gargalos + planos) · Reunião de fechamento · Enviar PDF ao cliente | — |
| 3 · Treinamento Comercial | _Entregável da fase (a detalhar)_ | — |
| 4 · Consultoria Comercial (sócios) | _Entregável da fase (a detalhar)_ | — |
| 5 · Implementação CRM + IA | _Entregável da fase (a detalhar)_ | — |
| 6 · Auditoria de Mídia | _Entregável da fase (a detalhar — inclui Google Meu Negócio)_ | — |
| 7 · Auditoria Criativa | _Entregável da fase (a detalhar)_ | — |

---

## Integração ClickUp (fonte das Crias)

O CRM **não cadastra clientes à mão**: cada Cria é o espelho de uma task-mestre do ClickUp.
O SquadFire lê o ClickUp (via API/MCP), filtra pelo Squad e materializa/atualiza as `cria`.

### Caminho no workspace

```
Team  E3 Digital ............................ 9007045289
└─ Space  Projetos .......................... 901312638575
   ├─ Folder  Gestão de Projetos ........... 901316177250
   │  └─ List  Estruturação ............... 901324100247   ← LISTA-MESTRE (1 task = 1 cliente)
   └─ Folder  Estruturação ................. 901316177650   (listas semanais Semana 1–7+, operacional)
```

A **lista-mestre `901324100247`** é a fonte de verdade das Crias. Cada task = um escritório, com o
ciclo de vida no _status_ da task (backlog / onboarding / execução / finalizado / churn) e os
atributos em _custom fields_.

### Custom fields usados

| Campo ClickUp | field id | Uso no CRM |
|---|---|---|
| **Squad** | `280cc0b8-7014-490c-b798-5785b0a9d501` | **filtro de entrada** — só `Squad 08` (orderindex 7, option `745a8f43-44f1-4060-9270-6da328da77d7`) vira Cria |
| **Semana** | `0b75db7c-c23b-404c-a590-4168337fb39d` | `clickup_semana` → fase da Forja (orderindex 0 = Semana 1 … 6 = Semana 7+) |
| Link do grupo | — | WhatsApp do grupo (SLA/leitura de briefing) |
| Gestor de Projetos | — | `forja`/atribuição de papel |

> A API de filtro do ClickUp **não** filtra por custom field diretamente: puxa-se a lista-mestre e
> filtra-se `Squad = Squad 08` no cliente de integração (ler `custom_fields[].value` por task).

### Mapa de campos (ClickUp → `cria`)

| ClickUp | → | `cria` |
|---|---|---|
| `task.id` | → | `clickup_task_id` (chave idempotente) |
| `task.name` | → | `nome_cliente` |
| custom _Squad_ (label) | → | `clickup_squad` (gate: precisa ser `Squad 08`) |
| custom _Semana_ (orderindex+1) | → | `clickup_semana` → `forja` fase 1–7 |
| `task.status` | → | `status` (backlog→`ativa`/pré-forja; execução→`ativa`; churn→`churn`) |
| Gestor de Projetos | → | `gestor_contas_id` (resolve por email/nome) |
| Link do grupo | → | metadado de WhatsApp (SLA) |
| _now()_ do sync | → | `sincronizado_em` |

### Regras de sincronização

- **Direção:** ClickUp → CRM é a fonte de verdade pros campos acima (read-only no CRM). O único
  caminho de volta (CRM → ClickUp) é o **briefing**, publicado como **comentário na task-mestre do
  cliente** (`cria.clickup_task_id`) — ver [§ briefing](#briefing-relatório-semanal--6-campos).
- **Idempotência:** upsert por `clickup_task_id`. Task que sai do Squad 08 (ou é arquivada) →
  `status` reflete, não se apaga a Cria.
- **Fase:** `clickup_semana` dirige a fase da Forja; se a task-mestre não tiver Semana preenchida a
  Cria fica no **backlog** (pré-forja), sem prazos calculados.
- **Gatilho:** sync agendado (cron) + webhook do ClickUp (task criada/movida/atualizada na
  lista-mestre) pra refletir em quase-tempo-real.

> Implementação de referência do cliente de integração: [`integracao/clickup/`](../integracao/clickup/).

---

## Notas de implementação (Supabase)

- **Auth:** Google SSO; allowlist por `membro.email`; JWT carrega papel(is) + `is_admin` pra RLS.
- **RLS:** leitura ampla; escrita condicionada a papel/admin.
- **Storage:** buckets pra contratos, áudios de briefing e entregáveis.
- **Server-side (Next.js route handlers / edge):** chamadas à API Anthropic (leitura de contrato,
  estruturação do briefing, sugestão de plano de ação) — nunca no client.
- **Motor de recorrência:** job diário que, a partir de `rotina` + `recorrencia_config` + escopo,
  gera as `lenha` (tipo=rotina) do dia pros membros/papéis certos.
- **Integrações:** ClickUp — **entrada** das Crias (lista-mestre `901324100247`, filtro Squad 08;
  ver [§ Integração ClickUp](#integração-clickup-fonte-das-crias)) e **saída** do briefing (push do
  relatório semanal); WhatsApp Evolution/Criativivo (SLA de grupos), Google (Meu Negócio na auditoria).
