# Especificação Funcional — CRM Squad 8

> **E3 Digital · Squad 8** — Produto: Estruturação · **Documento vivo**
> Identidade: Dragão / fogo / forja · Escopo: Estruturação
> Clientes = escritórios de advocacia (previdenciário/jurídico).

**Glossário:** Cria = cliente · Forja = projeto · Lenha = tarefa · Covil = dashboard · Linha de Fogo = kanban.

Documento vivo — vai sendo preenchido conforme cada módulo fecha.

---

## Registro de decisões — refinamento

Decisões fechadas na sessão de refinamento (fonte única; detalhes nos módulos e no
`docs/modelo-de-dados.md`):

| # | Tema | Decisão |
|---|---|---|
| 1 | Papéis por membro | **Múltiplos papéis**, com um **papel primário** que define a tela-casa do Covil. |
| 2 | Admin (Felipe) | **Flag à parte** (`is_admin`), por cima dos 3 papéis; pode acumular papel operacional. |
| 3 | Avanço de fase | **Manual + checklist**. Prazo de 7 dias = SLA/alerta (não trava). Gates bloqueiam a conclusão da fase. |
| 4 | Status da Cria | Ciclo **Ativa / Pausada / Encerrada** + **`em_risco`** como flag **derivada** (SLA/NPS). |
| 5 | Fogueira | É o **board Kanban (Linha de Fogo)** — apresentação, não entidade de dados. |
| 6 | Kanban | **Aba separada** (não dentro do Covil). |
| 7 | Campo Produto | **Travado** em "Estruturação" (enum já previsto pra futuros produtos). |
| 8 | Covil V1 | **Listas + alertas + KPIs**; calendário fica pro backlog. |
| 9 | Contrato no cadastro | Cria pode ser cadastrada **sem contrato**. Forja nasce com `data_inicio` nula e 7 fases "pendente" (sem prazos); ao confirmar o contrato, a IA seta a data e os prazos são calculados. |
| 10 | Permissões por papel | Todos **leem** tudo; **edição** por papel (matriz em `docs/modelo-de-dados.md`). Contas→Crias/contratos; Projetos→fases/Lenha de Forja; Tráfego→mídia; Admin→tudo + membros. |
| 11 | Checklist por fase | Cada fase tem Lenha de Forja padrão (seed). Fases 1–2 já concretas (Formulário Acesso/Diagnóstico, Diagnóstico 360); 3–7 com placeholder até Felipe detalhar. |

**Ainda aguardando input do Felipe (não é múltipla escolha):**

- Rotinas reais de cada papel (a 1.5 é rascunho de trabalho).
- Deliverable concreto de cada fase (além do já mapeado em 3.3).
- Material/POP oficial de referência da Estruturação.
- Validação da proposta de KPIs e dos blocos do Covil por papel.

---

## Módulo 1 — Acesso e Membros

### 1.1 Princípio central (o diferencial)

O acesso não é só quem entra — **é o que cada um vê ao entrar**. Dependendo do papel do
membro que faz login, toda a experiência muda:

- as abas/telas que ele consegue acessar;
- as tarefas (Lenha) e demandas que aparecem pra ele;
- o layout do Covil (dashboard inicial) — cada papel tem uma tela-casa própria;
- as permissões (o que pode ver × o que pode editar).

Cada membro tem uma **tarefa recorrente ligada à sua função** — é a essência do papel dele
dentro da Forja. Ou seja: um único CRM, mas com experiências diferentes por papel. **Não é
esconder botão — é montar a interface a partir da função.**

### 1.2 Papéis definidos

| Papel | Função-núcleo (tarefa recorrente) | Foco |
|---|---|---|
| **Gestor de Contas** | Relação com a Cria — briefing, aprovações, alinhamento | Cliente |
| **Gestor de Projetos** | Andamento da Forja — mover fases, distribuir Lenha, SLA | Execução |
| **Gestor de Tráfego** | Campanhas — setup, otimização, métricas | Tráfego |
| **Admin / Líder (Felipe)** | Gestão de membros, allowlist, visão total | Squad inteira |

### 1.3 Decisão — Visibilidade × Delegação

Visibilidade **não** é o problema. Todo mundo pode ver tudo (Forjas e Crias). O que diferencia
cada papel é a **tarefa que é delegada** a ele, não o que ele enxerga.

### 1.4 Os dois tipos de Lenha (tarefa)

O CRM tem duas naturezas de tarefa que convivem:

| Tipo | Origem | Natureza | Vínculo |
|---|---|---|---|
| **Lenha de Forja** (tarefa de projeto) | Fluxo da Estruturação | Obrigatória, tem que ser seguida; anda com as fases | `FaseDaForja` |
| **Lenha de Rotina** (tarefa individual) | Rotina/função do membro | Recorrente, pessoal; acompanhamento do dia a dia | `Membro` (por papel) |

- A **Lenha de Forja** é o trabalho do projeto (o funil de fases da Estruturação).
- A **Lenha de Rotina** é o trabalho recorrente de cada função e aparece na tela-casa (Covil)
  de cada papel.

### 1.5 Rotinas por papel — Lenha de Rotina (RASCUNHO, validar)

> Proposta inicial pra Felipe cortar/ajustar. As rotinas reais quem manda é ele.
> **Versão estruturada e seed-ready em [`docs/rotinas.md`](rotinas.md)** — já com Check-in da
> Cria = semanal confirmado; demais cadências parqueadas.

**Rotina COMUM — toda a equipe (coletiva)**

- **Daily** — alinhamento interno da equipe. Primeira reunião do dia, todos os dias. É a
  primeira Lenha do dia pra todo mundo, independente do papel.
- **Weekly** — alinhamento da squad inteira. Semanal, às sextas. Cai pra todos.
- **Preenchimento da planilha de BSC** — time inteiro. Semanal, às sextas.

> **Nota de schema:** a Lenha de Rotina tem escopos — individual (de um papel/membro) e
> coletiva (da squad inteira, cai pra todos). A Daily é o primeiro caso de rotina coletiva.

**Gestor de Contas**

- Check-in com cada Cria (cadência a definir)
- Coletar e validar briefing
- Enviar conteúdo pra aprovação do cliente
- Relatório periódico pro cliente
- Acompanhar renovação/flag de contrato (Forja Quente / Brasa Viva)
- Relatório diário das tarefas do dia — todo final de expediente (diária)

**Gestor de Projetos — OFICIAL (fonte: POP E3 Digital)**

Objetivo: responsável pela produção e execução dos produtos operacionais.
Foco: planilhas quinzenais, acompanhamento das entregas, NPS mensal, comunicação diária nos
GPs, demandas de copy e entregas no prazo (onboarding + criação).

_Rotina diária (todos os dias):_

- Daily de alinhamento com Account e Coordenador
- Manter comunicação ativa nos grupos
- Execução das demandas (copys, planilhas, organização do CRM, entregas de NPS)
- Acompanhamento das entregas e pontuação de pendências
- Relatório diário

_Rotina semanal (o que muda por dia da semana):_

| Dia | Tarefa específica do dia (além da rotina diária) |
|---|---|
| Segunda | Envio de relatórios pelo criativo |
| Terça | — |
| Quarta | — |
| Quinta | Relatório de saúde do projeto no ClickUp · Atualizar relatório interno no ClickUp (compartilhada c/ Tráfego) |
| Sexta | Weekly com a Squad · Relatório semanal (no lugar do diário) |

_POP — responsabilidades:_ produzir copys/planilhas/materiais; gerir entregas e prazos no
ClickUp; medir NPS mensal e organizar feedbacks; manter comunicação com Accounts e
Coordenadores; relatório de saúde do projeto no ClickUp às quintas; enviar relatórios pelo
criativo às segundas.

_Sprints (ciclo de 4 semanas):_

- **S1** — Diagnóstico das entregas e estruturação das demandas
- **S2** — Melhoria da qualidade e agilidade operacional
- **S3** — Padronização dos processos e fluxos internos
- **S4** — Revisão dos resultados e plano de otimização contínua

_OKRs:_ eficiência das entregas 90% no prazo · redução de 30% no retrabalho; qualidade e
satisfação interna NPS interno > 7 · 100% das demandas com validação positiva do Account.

_PDI:_ gestão de tempo e priorização · comunicação com criação e tráfego · padrões de entrega
e documentação de processos.

> **Nota de schema:** a Lenha de Rotina precisa suportar **cadências mistas** — tarefas
> diárias fixas + tarefas atreladas a dia da semana (segunda/quinta/sexta) + tarefas mensais
> (NPS) + ciclo de sprint. O campo de recorrência **não pode ser só** "diária/semanal/mensal";
> precisa de **recorrência por dia da semana**.

**Gestor de Tráfego**

- Checar campanhas ativas (gasto, CPL, performance)
- Otimizar/ajustar campanhas
- Subir campanha nova por Forja
- Relatório de métricas de tráfego
- Atualizar relatório interno no ClickUp — toda quinta (compartilhada c/ Gestor de Projetos)

> **Nota de schema (escopo revisado):** a Lenha de Rotina tem **três escopos**, não dois:
> 1. **Individual** — de um papel/membro (rotina do Projetos, Contas, Tráfego)
> 2. **Subconjunto** — de alguns papéis (ex.: relatório interno no ClickUp = Projetos + Tráfego)
> 3. **Coletiva** — da squad inteira (Daily, Weekly)
>
> Na prática: a Lenha de Rotina se atribui a **um ou mais** papéis/membros, não a um só.

**Admin / Líder (Felipe)**

- Visão macro do Covil
- Gestão de membros e allowlist
- Acompanhar Crias em risco e SLAs gerais

### 1.6 Em aberto

- [x] **Roster completo de papéis:** FECHADO — só três: Gestor de Contas, Gestor de Projetos,
  Gestor de Tráfego. (Sem Designer/Social/Copy.)
- [ ] Validar/ajustar as rotinas de cada papel (seção 1.5) — _aguardando input do Felipe; o
  rascunho da 1.5 vale como versão de trabalho._
- [x] **Recorrência da Lenha de Rotina:** o campo precisa suportar **diária fixa, por dia da
  semana, semanal, mensal e sprint** (ver `docs/modelo-de-dados.md`). Não é só diária/semanal/mensal.
- [x] **Um membro pode ter mais de um papel?** SIM — **múltiplos papéis**, com um **papel
  primário** que define a tela-casa do Covil.
- [x] **Líder (Felipe):** entra como **Admin (flag à parte)**, por cima dos 3 papéis; pode,
  opcionalmente, acumular um papel operacional.

### 1.7 Impacto técnico (schema)

- Entidade **`Membro`** ganha campo de papel/função (enum de papéis).
- Flag/campo pra **`Lenha`** distinguir os dois tipos: **Lenha de Forja** (hangs off
  `FaseDaForja`) × **Lenha de Rotina** (hangs off `Membro`, com campo de recorrência).
- **Composição de UI por papel:** o Covil monta a tela-casa a partir da função + mostra a
  Lenha de Rotina daquele membro.
- **Permissões por papel** (ver = todos; editar/delegar = conforme função) além do allowlist
  de login (**Google SSO + JWT**).

---

## Módulo 2 — Crias (Clientes)

### 2.1 O que é a Cria

A Cria é o cliente da Squad 8 — escritórios de advocacia (foco previdenciário/jurídico). É a
partir dela que nascem as Forjas (projetos).

### 2.2 Cadastro da Cria — CAMPOS OFICIAIS

- Nome do Cliente
- E-mail
- Telefone / WhatsApp
- Área de Atuação (área do direito)
- Produto
- Investimento em mídia (verba de mídia — insumo do Gestor de Tráfego)
- Closer (quem fechou o contrato)

> **Nota sobre "Produto":** como o produto é único (Estruturação), esse campo tende a vir
> fixo/pré-preenchido como Estruturação, não como escolha aberta. **Decidido: fica travado**
> (pré-preenchido e não editável). Se no futuro entrar Alavancagem/E3 Light, o campo (enum) já
> está previsto.

**Campos de sistema (automáticos, não digitados):** Gestor de Contas responsável, data de
contrato, status da Cria, flag de contrato (Forja Quente / Brasa Viva). Confirmar se algum
destes também entra no cadastro manual.

### 2.3 Contratos anexos + leitura por IA (feature)

Dentro do cadastro da Cria, poder anexar o(s) contrato(s) do cliente e ter uma **IA lendo o
contrato pra extrair dados automaticamente**.

_O que a IA extrai:_

- **Data de início do contrato** — é o **gatilho dos prazos** do funil. Em vez de digitar, a
  IA lê do contrato.
- Outros dados reconhecíveis (nome/razão do cliente, valor, vigência, escopo, etc.) alimentam
  os campos do cadastro quando presentes.

_Fluxo:_ anexa o contrato → IA lê → sistema preenche a data de início (e o que mais
reconhecer) → usuário confere → Estruturação dispara com os prazos já calculados.

_Impacto técnico:_

- Armazenamento de arquivo (**Supabase Storage**) pro contrato ficar vinculado à Cria.
- Extração via IA **server-side** (chamada à **API Anthropic** no Next.js, lendo o PDF do
  contrato) retornando dados estruturados (JSON) pra preencher os campos.
- A data de contrato deixa de ser digitação manual → vem da leitura da IA (com opção de o
  usuário conferir/corrigir antes de confirmar).
- Guardar os campos extraídos + o arquivo original (auditoria/histórico).

### 2.4 Como a aba se apresenta (RASCUNHO)

- **Lista de Crias** — visão geral com filtros (status, flag de contrato, gestor responsável).
- **Detalhe da Cria** — dados + contrato(s) anexo(s) + Forjas vinculadas + histórico + comentários.

### 2.5 CORREÇÃO — Cadastrar a Cria já dispara a Estruturação

Ponto que estava errado no desenho anterior: a Forja **não** é uma criação separada com
escolha de produto.

- O produto é **sempre Estruturação** (produto único da Squad 8). Não existe passo de "escolher
  qual produto o cliente vai trabalhar".
- Cadastrar a Cria **já inicia** o processo de Estruturação automaticamente — a entrega do
  produto começa no momento do cadastro, independente da área do direito.
- No cadastro da Cria, coletar o máximo de informação possível de uma vez, pra já cair direto
  na aba do produto (a Forja/Estruturação com o funil de fases).
- **Relação: 1 Cria → 1 Estruturação**, criada de forma automática no cadastro. Sem criação
  manual de Forja, sem seleção de produto.

_Efeito no fluxo:_ cadastro da Cria → sistema gera a Estruturação (funil, prazos a partir da
data de contrato) → usuário já entra na aba do produto.

### 2.6 Aba de Comentários (na Cria/Estruturação)

Assim que o projeto do cliente é criado, fica disponível uma aba de comentários dentro da Cria.

- Serve pra anexar dados que às vezes não se tem no início — informação vai entrando de forma
  **incremental** conforme aparece.
- É o espaço de **registro contínuo** da relação (contexto, observações, dados soltos, arquivos
  complementares).
- Casa com a entidade `Comentario` já prevista no schema.

### 2.7 SLA nos grupos de WhatsApp → relatório interno automatizado (planejado)

Implementação planejada de **SLA nos grupos de WhatsApp** dos clientes, pra acompanhar esses
grupos e, com isso, **automatizar o relatório interno**.

- O relatório interno (quinta — Projetos + Tráfego) é o **BRIEFING SEMANAL**, baseado em
  perguntas sobre o que aconteceu na semana.
- Com o acompanhamento dos grupos + dados do CRM, dá pra gerar esse briefing automaticamente.
- Conecta com stack de comms já existente (**Evolution API / Criativivo**) e com a pergunta em
  aberto sobre webhooks de saída do Criativivo (viabilidade da arquitetura híbrida).

**BRIEFING SEMANAL — estrutura oficial (6 campos):**

| Campo | Como automatizar (fonte) |
|---|---|
| O que aconteceu essa semana | Resumo (via IA) das interações e eventos do grupo de WhatsApp na semana |
| Satisfação | Sentimento do cliente no grupo + NPS mensal |
| Campanhas | Dados do Gestor de Tráfego — investimento em mídia, performance das campanhas |
| Nosso desempenho | Lenha de Forja concluída na semana + cumprimento de prazos/SLA |
| Pontos de atenção | SLA estourando, pendências, sinais de insatisfação detectados no grupo |
| Próximos passos | Próximas Lenhas + próxima fase do funil da Estruturação |

_Fluxo previsto:_ acompanhar grupo (Evolution/Criativivo) → IA resume + cruza com dados do CRM
→ pré-preenche os 6 campos → membro revisa/ajusta na quinta → registra.

#### 2.7.1 Briefing por ÁUDIO dentro do CRM → envio automático pro ClickUp (prioridade)

Hoje o Gestor de Projetos já faz isso no Gemini: grava um áudio falando o que rolou e a IA
devolve o briefing pronto. A ideia é trazer essa mesma configuração pra dentro do CRM.

_Fluxo:_

1. Dentro de uma aba do CRM, o membro clica pra gravar um áudio e fala o que aconteceu na semana.
2. Ao terminar, o áudio vai pra IA, que devolve o briefing pronto já estruturado nos **6 campos**.
3. Com o briefing pronto, o CRM faz uma conexão via API com o **ClickUp** e joga o relatório
   direto lá, automático.

_Impacto técnico:_

- Gravação de áudio no navegador (**MediaRecorder**) dentro da aba.
- IA processa o áudio → transcrição + estruturação nos 6 campos. (Modelo com áudio nativo, ou
  transcrição + LLM estruturando. Definir provider na fase de build.)
- Integração **ClickUp via API** — ao concluir, cria/atualiza o item do briefing no ClickUp
  automaticamente. (ClickUp MCP já conectado.)
- Salvar o briefing também no CRM (histórico/Comentário), não só no ClickUp.

> **Nota:** dois caminhos pro mesmo briefing convivem — (a) por áudio (o membro dita) e (b)
> automático (via leitura do grupo). Podem ser complementares: a leitura do grupo pré-preenche,
> o áudio complementa/corrige.

### 2.8 Aba de Gargalos/Gaps

Aba específica dentro da Cria pra tratar problemas/gargalos da operação do cliente.

- Quando surge um problema a resolver, registra-se **qual é o gargalo** na operação daquele cliente.
- **Contextualizado pela fase do funil** em que o cliente está (o gargalo se vincula à fase
  atual da Estruturação). O tipo de gargalo tende a variar conforme a fase.
- Dentro da mesma aba, cada gargalo recebe um **Plano de Ação** pra resolver o problema.
- **IA de apoio** na criação do plano de ação — dá **recomendações, não respostas cravadas**.
  Assiste o membro sem substituir o julgamento dele.

_Impacto técnico:_

- Nova entidade `Gargalo` — vinculada à `Cria` e à `FaseDaForja` (fase em que ocorreu), com
  status (aberto / em resolução / resolvido).
- `PlanoDeAcao` vinculado ao `Gargalo` (passos/ações, responsável, prazo).
- IA gera sugestões de plano de ação (chamada à API), apresentadas como **recomendação editável**.
- Histórico de gargalos por fase vira insumo: dá pra ver padrões (ex.: gargalo recorrente sempre
  na mesma fase) no Covil.

### 2.9 Em aberto

- [x] **Uma Cria tem uma ou várias Forjas?** 1 Cria = 1 Estruturação, automática no cadastro.
- [x] **Precisa criar Forja/escolher produto?** Não. Produto único, disparo automático.
- [x] **Perguntas do relatório interno** — recebido (briefing semanal, 6 campos).
- [ ] O que precisa aparecer na lista vs. no detalhe da Cria? _(rascunho em 2.4; refinar na fase de UI)_
- [x] **Status da Cria:** ciclo = **Ativa / Pausada / Encerrada**. "Em risco" **não** é status
  manual — é **flag derivada** (SLA estourando / NPS baixo) que acende no Covil.

---

## Módulo 3 — Forja (a Estruturação / aba do produto)

### 3.1 Panorama (o que já está cravado)

- A Forja **é** a Estruturação — produto único da Squad 8. Não há escolha de produto.
- Nasce **automática no cadastro da Cria** (1 Cria = 1 Forja). O usuário já cai na aba do produto.
- **Data de início vem da leitura do contrato pela IA** → é o gatilho dos prazos do funil.
- A Forja roda um funil de **7 fases — 7 dias cada, 49 dias no total**.
- Cada fase carrega a **Lenha de Forja** (tarefas do projeto) — a `Lenha` pendura na
  `FaseDaForja`, não na Forja direto, pra **preservar histórico** quando a fase avança.
- **Flag de contrato:** Forja Quente (SETUP) · Brasa Viva (MANUTENÇÃO).
- Já se conecta com: **Gargalos/Gaps** (vinculados à fase atual) e **Briefing** (campo "próximos
  passos" = próxima fase).

> Isto substitui o funil antigo (Faísca → Aço, ~64d). Agora são **7 fases × 7 dias = 49 dias**.

### 3.2 Entidades relacionadas (schema atual)

`Forja` tem várias `FaseDaForja` (instância de cada `Fase` naquela Forja, com prazo previsto ×
realizado) → cada `FaseDaForja` tem sua `Lenha`. (`Comentario` também orbita a Forja. A
`Fogueira` **não** é entidade: é o board Kanban — Linha de Fogo — visão de apresentação das Forjas.)

### 3.3 FASES REAIS DO PRODUTO (fonte: Felipe)

Fluxo semana a semana do que o cliente passa.

**Semana 1 — Alinhamento / Boas-vindas (Onboarding)**
- Reunião de alinhamento de expectativas com o cliente.
- Após a reunião: envio do **Formulário de Acesso** (dados do cliente pra acessar as redes dele).
- Envio também do **Formulário Diagnóstico**.
- O Formulário Diagnóstico é o **gate**: é o que permite avançar pra próxima etapa.
- **Entregáveis:** Formulário de Acesso · Formulário Diagnóstico.

**Semana 2 — Diagnóstico 360**
- Elaboração de um documento de diagnóstico: principais gargalos da operação do cliente + plano
  de ações pra resolver cada gargalo.
- Reunião de fechamento do documento.
- **Entregável:** PDF Diagnóstico 360 enviado ao cliente.
- Conecta direto com a aba **Gargalos/Gaps** (2.8) — é aqui que os gargalos + planos de ação
  nascem oficialmente.

**Semana 3 — Treinamento Comercial (equipe do cliente)**
- Conduzido pelo consultor comercial: análise, diretrizes, ensino de métricas e outros pontos.
- **Entregável:** PDF / curso pra acompanhamento com o cliente.

**Semana 4 — Consultoria Comercial com Sócios**
- Consultor traz métricas e ensina os sócios (gestão empresarial a nível comercial).
- **Entregável:** documentos de apoio à análise (Felipe detalha depois).

**Semana 5 — Implementação de CRM + IA**
- Implementação do CRM + IA para o cliente.

**Semana 6 — Auditoria de Mídia**
- Auditoria de mídia + Google Meu Negócio.

**Semana 7 — Auditoria Criativa**
- Auditoria criativa. Finaliza a Estruturação.

### 3.4 RESOLVIDO — 7 fases × 7 dias (49 dias) · nomes operacionais

Confirmado: são **7 semanas reais, 7 dias por fase, 49 dias no total**. O funil do CRM segue as
7 etapas operacionais. O funil antigo de 6 fases (~64d) está descontinuado.

**Decisão de nomenclatura:** manter os **nomes operacionais** das fases. Não usar os nomes de
identidade (Faísca/Fornalha/etc.) nas fases do funil.

| # | Fase (nome oficial) | Prazo | Acumulado |
|---|---|---|---|
| 1 | Alinhamento / Boas-vindas | 7 dias | 7d |
| 2 | Diagnóstico 360 | 7 dias | 14d |
| 3 | Treinamento Comercial (equipe) | 7 dias | 21d |
| 4 | Consultoria Comercial (sócios) | 7 dias | 28d |
| 5 | Implementação CRM + IA | 7 dias | 35d |
| 6 | Auditoria de Mídia | 7 dias | 42d |
| 7 | Auditoria Criativa | 7 dias | 49d |

### 3.5 Em aberto (aguardando Felipe definir)

- [ ] O deliverable concreto de cada fase (além dos já mapeados em 3.3) — _aguardando Felipe._
- [x] **Critério de avanço de fase:** **manual + checklist**. O Gestor conclui a Lenha da fase e
  avança na mão; o prazo de 7 dias vira **SLA/alerta** (não trava sozinho). Gates (ex.: Formulário
  Diagnóstico) impedem concluir a fase sem serem cumpridos.
- [ ] Referências/padrões que a E3 já usa pra estruturação (material oficial, igual ao POP do
  Projetos) — _aguardando Felipe._
- [x] **Fogueira:** é o **board Kanban (Linha de Fogo)** — visão de apresentação das Forjas por
  fase, **não** uma entidade de dados pesada. Fica em **aba separada** (não dentro do Covil).

---

## Módulo 4 — Covil (Dashboard)

> **Status:** ainda não especificado a fundo — panorama do que o Covil precisa puxar, com base
> nos Módulos 1–3. Rascunho pra Felipe reagir.

### 4.1 Princípio — Covil é POR PAPEL

O Covil **não é uma tela única**. Como definido no Módulo 1, cada papel entra e vê a sua
**tela-casa**. O Covil monta a partir da função do membro logado + mostra a Lenha dele.

### 4.2 Blocos comuns (todo Covil, independente do papel)

- **Rotina do dia** — Lenha de Rotina coletiva (Daily sempre; sexta: Weekly + BSC) + as
  individuais do papel.
- **Alertas de SLA** — prazos de fase estourando (funil de 7×7 dias). O que tá vermelho.
- **Minhas Lenhas** — Lenha de Forja atribuída ao membro, por prioridade/prazo.

### 4.3 Covil por papel (rascunho)

**Gestor de Contas**
- Suas Crias e em que fase da Estruturação cada uma está
- Briefings pendentes (o de áudio → ClickUp)
- Sinais de satisfação / Crias em risco
- Renovações / flag de contrato (Forja Quente × Brasa Viva)

**Gestor de Projetos**
- Todas as Forjas e distribuição por fase (quantas em cada uma das 7 etapas)
- SLAs estourando (visão de comando)
- Lenha a distribuir / pendências pontuadas
- Entregas da semana (o "nosso desempenho" do briefing)

**Gestor de Tráfego**
- Campanhas ativas + investimento em mídia por Cria
- Forjas na fase de Auditoria de Mídia
- Performance / métricas de tráfego

**Admin / Líder (Felipe)**
- Visão macro: todas as Crias, todas as Forjas, todos os SLAs
- Gestão de membros / allowlist
- Inteligência de gargalos por fase (padrões recorrentes — ex.: todo mundo trava na mesma etapa)

### 4.4 Em aberto

- [~] **KPIs do topo (proposta de V1, validar):** Forjas ativas · % de fases no prazo · Crias em
  risco · Briefings pendentes na semana · Gargalos abertos sem plano de ação.
- [ ] Validar os blocos de cada papel (cortar/adicionar).
- [x] **Calendário no Covil:** V1 = **listas + alertas + KPIs**; calendário fica pro backlog.
- [x] **Kanban (Linha de Fogo):** **aba separada** (não dentro do Covil).

---

## Módulo 5 — Backlog de features (a explorar / priorizar)

### Encaixa direto (consequência do que já foi definido)

- **Linha de Fogo (Kanban)** — board das Forjas pelas 7 fases (ou Lenhas por status). É o que a
  identidade chama de **`Fogueira`** — visão de apresentação, **não** é entidade de dados. ✅ resolvido.
- **Automação do funil** — ao disparar a Estruturação, gerar as Lenhas padrão de cada fase
  automaticamente (checklist pronto, ninguém pula etapa).
- **Formulários integrados** — Formulário de Acesso + Formulário Diagnóstico dentro do fluxo;
  respostas caem na Cria. (O Formulário Diagnóstico é o gate fase 1→2.)

### Alto valor

- **Geração de entregáveis por IA** — IA rascunha o Diagnóstico 360 a partir das respostas do
  formulário diagnóstico (puxa gargalos + sugere planos de ação). Fecha o ciclo com a aba
  Gargalos/Gaps.
- **NPS** — coleta e tracking de NPS mensal por Cria; vira sinal de risco no Covil.
- **Central de notificações/alertas** — SLA estourando, fase a vencer, briefing pendente,
  gargalo sem plano de ação. In-app + WhatsApp/email.
- **Analytics da agência** — tempo médio por fase, % no prazo, gargalos recorrentes, carga por
  membro. Gestão, não só acompanhamento.

### Futuro

- **Portal do cliente** — visão read-only do progresso + download de entregáveis.
- **Compliance OAB** — guardrail Provimento 205/2021 caso o CRM gere copy client-facing.

### Motor técnico transversal (necessário pro resto funcionar)

- **Engine de recorrência da Lenha de Rotina** — suportar: diária fixa, por dia da semana,
  mensal, sprint; escopo individual / subconjunto / coletiva.
- **Integrações:** ClickUp (briefing push), WhatsApp (Evolution/Criativivo — SLA de grupos),
  Google (Meu Negócio na auditoria, Drive/Storage pros docs).

---

## Entidades do schema (consolidado do documento)

Entidades citadas ao longo da spec, pra referência de modelagem:

- **`Membro`** — usuário do CRM; campo de papel/função (enum), allowlist de login.
- **`Cria`** — cliente (escritório). Campos oficiais em 2.2 + campos de sistema.
- **`Forja`** — a Estruturação (1:1 com Cria). Flag de contrato (Forja Quente / Brasa Viva).
- **`Fase`** — catálogo das 7 fases (nomes operacionais, 7 dias cada).
- **`FaseDaForja`** — instância de uma Fase numa Forja (prazo previsto × realizado).
- **`Lenha`** — tarefa. Dois tipos: **de Forja** (→ `FaseDaForja`) e **de Rotina** (→ `Membro`,
  com recorrência e escopo individual/subconjunto/coletiva).
- **`Gargalo`** — problema da operação (→ `Cria` + `FaseDaForja`), com status.
- **`PlanoDeAcao`** — plano vinculado ao `Gargalo` (passos, responsável, prazo).
- **`Comentario`** — registro contínuo (→ Cria/Forja).
- **`Briefing`** — briefing semanal (6 campos); origem áudio e/ou leitura de grupo.
- **`Fogueira`** — **não** é tabela: é o board Kanban (Linha de Fogo), visão de apresentação das Forjas.
- **`RodaDeFogo`** — reunião de acompanhamento com a Cria (pauta, gravação de áudio, notas, próximos passos);
  é onde o `Briefing` semanal é gerado. Vincula à `Cria`/`Forja` e à `FaseDaForja` atual.

> Documento mantido no repositório como fonte viva. Atualizar conforme cada módulo fecha.
