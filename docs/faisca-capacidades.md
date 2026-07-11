# Faísca — o que ela vai conseguir fazer

Catálogo das capacidades do assistente global **Faísca** no SquadFire. Complementa
[`camada-ia.md`](camada-ia.md) §5 (a arquitetura) com o **inventário completo do que ela faz**.

**O que é:** assistente de IA que vive na navegação (botão fixo no rail, em qualquer aba),
por **texto ou voz**. Enxerga a Cria/Forja/tela atual pra dar respostas certeiras.

**Pipeline:** voz → **Gemini** (transcreve) → **Claude** (entende, decide, age via tool-calling)
→ **TTS** (responde por voz, além do texto).

**Princípio:** a Faísca **sugere e executa**, mas em coisas críticas (Início da Forja, avançar
fase, plano de gargalo) **a pessoa confirma**. E ela só faz o que o **papel** do usuário permite (RLS).

---

## 1. Consultar & responder (leitura)

Pergunta em linguagem natural, resposta na hora (Claude sobre os dados do CRM).

| Você pergunta… | A Faísca responde |
|---|---|
| "Quais Forjas estão atrasadas?" | lista as Crias com Estopim (SLA) estourado, por gravidade |
| "Como está a saúde da carteira?" | Em Chamas / Esfriando / Apagando / Cinzas, com números |
| "Quantas Crias em cada fase?" | distribuição do funil (Fase 1→7) |
| "Quais briefings estão pendentes?" | briefings da semana ainda não coletados |
| "Que gargalos estão sem plano?" | gargalos abertos sem plano de ação |
| "Qual a carga da Brigada?" | Lenhas abertas por membro |
| "Me resume a Cria da Letícia" | fase, dia/49, NPS, últimos acontecimentos, pendências |
| "Qual o investimento em mídia do Igor?" | verba de campanha + valor do contrato |
| "Quantas Lenhas concluímos essa semana?" | entregas nos últimos 7/15/30 dias |
| "Qual o % no prazo da squad?" | SLA agregado (e por membro, se pedir) |
| "Quando vence a Fase 3 da Mozini?" | prazos das fases daquela Forja |

## 2. Agir no CRM (tool-calling · escrita)

A Faísca chama funções do próprio backend pra **fazer**, não só responder.

| Você pede… | Ela faz | Ferramenta | Papel |
|---|---|---|---|
| "Agenda Roda de Fogo com a Letícia quinta 15h" | cria a Roda + a Lenha e sincroniza no ClickUp | `agendarRodaDeFogo` | Contas/Projetos/Admin |
| "Avança a fase do Igor" | valida checklist + gate → move a fase | `avancarFase` | Projetos/Admin |
| "Cria uma Lenha pro Luiz: liberar Meta Ads até quinta" | cria e atribui a Lenha | `criarLenha` | Projetos/Admin |
| "Marca a Lenha X como concluída" | conclui a Lenha | `concluirLenha` | responsável da Lenha |
| "Abre a Cria da Mozini" | navega pro detalhe da Cria | `abrirCria` | qualquer |
| "Comenta na Cria: cliente confirmou a call" | registra o comentário | `comentarNaCria` | Contas/Projetos/Admin |
| "Registra um gargalo: cliente não liberou o Ads" | abre o gargalo na fase atual | `registrarGargalo` | Contas/Projetos/Admin |
| "Ajusta o investimento em mídia da Edi pra R$ 12k" | edita a verba de campanha | `editarInvestimentoMidia` | Tráfego/Admin |
| "Define o início da Forja da Cria X pra hoje" | seta `data_inicio` → calcula os prazos das 7 fases | `setarInicioForja` | Contas/Admin · **confirma** |
| "Publica o briefing no ClickUp" | posta o briefing como comentário na task do cliente | `publicarBriefing` | Contas/Projetos/Admin |

## 3. Gerar & escrever (IA generativa)

Onde Gemini ingere e Claude escreve (ver `camada-ia.md` §2–3).

| Você pede… | Ela gera | Encadeamento |
|---|---|---|
| "Gera o briefing dessa semana" (a partir do áudio) | os 6 campos do briefing semanal no modelo padrão | Gemini transcreve → Claude escreve |
| "Sugere um plano pra esse gargalo" | plano de ação + passos (a pessoa edita/confirma) | Claude |
| "O que virar Lenha essa semana?" | Lenhas sugeridas cruzando Diagnóstico 360 × briefing | Claude |
| "Lê esse contrato" | valor do contrato, vigência, dados da Cria | Gemini (extração de PDF) |
| "Resume a semana da Cria pelo grupo" | pré-preenche o briefing pela leitura do WhatsApp | Gemini resume → Claude estrutura |
| "Rascunha uma resposta pro cliente" | mensagem sugerida (a pessoa revisa e envia) | Claude |
| "Que criativo da Biblioteca serve pra essa Cria?" | roteiros/criativos do nicho da Cria | Gemini (visão) + match |

## 4. Voz (ponta a ponta)

- **Ouvir:** o usuário fala; Gemini transcreve o comando.
- **Responder por voz:** TTS lê a resposta (além do texto).
- **Ditar:** briefing, comentários e notas por voz (ex.: ditar o briefing na Roda de Fogo).

## 5. Organização (Biblioteca · Drive)

A IA mantém o acervo em ordem (ver `camada-ia.md` §6).

- Classifica cada roteiro/criativo por **nicho** e **tese** (lendo o conteúdo).
- Sinaliza itens **sem categoria** ou fora do padrão de pastas `Tipo / Nicho / Tese`.
- Sugere **renomear/organizar/deduplicar** arquivos soltos.
- **Vincula** assets ao nicho da Cria (sugere material pronto por cliente).

## 6. Proativo & contextual

- **Contexto da tela:** sabe em que Cria/Forja/aba você está → "resume **esta** Cria", "cria uma
  Lenha **aqui**".
- **Alertas** (alimenta o centro de notificações): SLA estourando, fase a vencer, briefing
  pendente, gargalo sem plano.
- **Sugestões de próxima ação** no Covil e no detalhe da Cria.

---

## 7. Capacidades avançadas

Além do núcleo acima, a Faísca cresce para **interpretar, antecipar e automatizar**.

### 7.1 Inteligência & análise
- **Gargalo recorrente:** "onde as Forjas mais travam?" — identifica a fase que mais prende a carteira.
- **Previsão de SLA:** "o que vai estourar nos próximos dias?" — antecipa antes do Estopim.
- **Risco de churn:** cruza NPS em queda + SLA + silêncio → sinaliza cliente em perigo.
- **Comparativos:** membro × membro, semana × semana, nicho × nicho.
- **Explicar o número:** "por que o SLA caiu essa semana?" — mostra a causa, não só o valor.

### 7.2 Relatórios & comunicação
- **Relatório executivo semanal** (Covil em texto) gerado automaticamente pro Admin.
- **Pauta da Roda de Fogo** montada a partir do estado atual da Cria.
- **Digest matinal** por membro ("suas 3 prioridades hoje").
- **Status pro cliente:** rascunha e-mail/mensagem de acompanhamento (a pessoa revisa e envia).
- **Post-mortem** de uma Forja concluída — o que funcionou e o que travou.

### 7.3 Automação & rotinas (proativo/agendado)
- **Cobrança de briefing:** toda quinta, cutuca quem não entregou.
- **Nudge de Lenha atrasada:** lembra o responsável sozinha.
- **Cliente sem resposta há X horas** → alerta + rascunho de resposta.
- **Onboarding guiado:** conduz o passo a passo de iniciar uma Forja.

### 7.4 Memória & conhecimento (busca na base)
- **Histórico da Cria:** "o que a gente combinou com a Letícia mês passado?" — busca em briefings/comentários antigos.
- **Q&A do Diagnóstico 360:** pergunta sobre o diagnóstico de uma Cria.
- **Playbook do Squad:** "como a gente faz auditoria de mídia?" — base de conhecimento interna.

### 7.5 Voz & multimodal avançado
- **Ata da Roda de Fogo:** transcreve a reunião inteira → resumo + Lenhas automáticas.
- **Ler um print:** cole uma imagem (tela/métrica) e ela extrai os dados.
- **Áudio do cliente:** transcreve + resume um áudio que o cliente enviou.

### 7.6 Agenda (Google Calendar)
- Agenda a Roda de Fogo direto na **agenda dos participantes** (Google Calendar).

### 7.7 Gestão de pessoas
- **"Alguém sobrecarregado?"** → sugere redistribuir Lenhas.
- **"Quem é o melhor pra essa Lenha?"** — por papel, carga e nicho.

### 7.8 Financeiro & comercial
- **MRR da carteira** (soma dos contratos) e **investimento total em mídia** sob gestão.
- **Contratos vencendo/renovação** — alerta com antecedência.

> **Fora do escopo da Faísca (por decisão):** consultar métricas de **Meta/Google Ads**,
> **responder/monitorar grupos de WhatsApp** e **Google Meu Negócio** não passam pela Faísca.
> Essas integrações podem existir em outras partes do produto, mas o assistente não as opera.

---

## Guardrails (limites)

1. **Permissões por papel (RLS):** a Faísca só executa o que o papel do usuário pode — mover
   fase é Projetos/Admin; editar mídia é Tráfego/Admin; concluir a **própria** Lenha é qualquer um.
2. **Sugere, a pessoa decide:** em Início da Forja, avançar fase e plano de gargalo, ela propõe e
   **pede confirmação** antes de gravar.
3. **Confirma ações externas:** antes de escrever no ClickUp/WhatsApp ou disparar algo pro
   cliente, confirma.
4. **Sem invenção de dado:** responde sobre o que está no CRM/ClickUp; quando não sabe, diz.
5. **Segredos no servidor:** todas as chamadas de IA e as ferramentas rodam server-side (chaves
   nunca no cliente).

## Inventário de ferramentas (tool-calling)

Funções do backend que a Faísca aciona — casam com o módulo de orquestração de IA
(`camada-ia.md` §4) e com o roteiro (`roteiro-producao.md` §4.3):

**Núcleo:** `buscarCrias` · `listarForjasAtrasadas` · `resumirCria` · `agendarRodaDeFogo` ·
`avancarFase` · `criarLenha` · `concluirLenha` · `abrirCria` · `comentarNaCria` ·
`registrarGargalo` · `editarInvestimentoMidia` · `setarInicioForja` · `gerarBriefing` ·
`publicarBriefing` · `planoDoGargalo` · `sugerirLenhas` · `extrairContrato` · `classificarAsset`

**Avançadas:** `analisarFunil` · `preverRiscoSLA` · `avaliarRiscoChurn` · `compararDesempenho` ·
`explicarMetrica` · `relatorioExecutivo` · `gerarPautaRoda` · `digestMatinal` ·
`redigirStatusCliente` · `postMortemForja` · `cobrarBriefing` · `nudgeLenha` · `onboardingGuiado` ·
`buscarHistorico` · `perguntarDiagnostico` · `consultarPlaybook` · `ataDaRoda` · `lerImagem` ·
`transcreverAudio` · `agendarNoCalendar` · `sugerirRedistribuicao` · `sugerirResponsavel` ·
`resumoFinanceiro` · `alertarRenovacao`

## Faseamento sugerido

- **V1 (MVP):** consultas (§1), ações-núcleo (`abrirCria`, `agendarRodaDeFogo`, `criarLenha`,
  `concluirLenha`, `comentarNaCria`) e o pipeline do briefing (§3, áudio → briefing → ClickUp).
  Voz de entrada (Gemini).
- **V2:** avançar fase com gate, plano de gargalo, sugerir Lenhas, editar mídia/início da Forja,
  voz de saída (TTS); **alertas proativos** (§7.3: cobrança de briefing, nudge de Lenha);
  **previsão de SLA e risco de churn** (§7.1); **ata da Roda de Fogo** (§7.5); **Google
  Calendar** (§7.6).
- **V3:** **inteligência** completa (§7.1 comparativos/explicar métrica); **relatórios** (§7.2:
  executivo semanal, pauta, digest, post-mortem); **memória/RAG** (§7.4); **ler print/áudio**
  (§7.5); **gestão de pessoas** (§7.7); **financeiro** (§7.8); organização da Biblioteca (§5) e
  rascunho de mensagens.

> Este catálogo é a referência de escopo da Faísca — ajuste conforme a operação for pedindo.
