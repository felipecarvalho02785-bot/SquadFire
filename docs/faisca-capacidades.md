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

`buscarCrias` · `listarForjasAtrasadas` · `resumirCria` · `agendarRodaDeFogo` · `avancarFase` ·
`criarLenha` · `concluirLenha` · `abrirCria` · `comentarNaCria` · `registrarGargalo` ·
`editarInvestimentoMidia` · `setarInicioForja` · `gerarBriefing` · `publicarBriefing` ·
`planoDoGargalo` · `sugerirLenhas` · `extrairContrato` · `classificarAsset`

## Faseamento sugerido

- **V1 (MVP):** consultas (§1), ações-núcleo (`abrirCria`, `agendarRodaDeFogo`, `criarLenha`,
  `concluirLenha`, `comentarNaCria`) e o pipeline do briefing (§3, áudio → briefing → ClickUp).
  Voz de entrada (Gemini).
- **V2:** avançar fase com gate, plano de gargalo, sugerir Lenhas, editar mídia/início da Forja,
  voz de saída (TTS), alertas proativos.
- **V3:** organização da Biblioteca, resumo pelo WhatsApp, rascunho de mensagens, resumo
  executivo do Covil.

> Este catálogo é a referência de escopo da Faísca — ajuste conforme a operação for pedindo.
