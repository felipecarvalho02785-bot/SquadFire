# Camada de IA — Squad 8

> Como a inteligência artificial é usada no Squad 8. Duas IAs — **Gemini** e **Claude** —
> trabalhando **em conjunto**, mais o assistente global **Faísca**.

O Squad 8 usa IA de forma intensiva. A diretriz é: **não** colocar as duas IAs para
fazer a mesma coisa competindo, e sim como **especialistas encadeados** — cada uma no que
é melhor, uma entregando trabalho para a outra.

---

## 1. Modelos e acesso

| IA | Papel | Acesso no produto |
|---|---|---|
| **Google Gemini** | Ingestão e multimodal | API (Google AI / Vertex AI), conta paga com limites elevados |
| **Anthropic Claude** | Raciocínio e escrita | API Anthropic, conta paga com limites elevados |

Ambos operam no **melhor plano pago**.

> ⚠️ **Nota prática importante:** para um SaaS, o que liga a IA ao produto é a **API**
> (cobrança por uso, com chaves e limites de conta), **não** as assinaturas de consumidor
> (Gemini Advanced / Claude Pro). As assinaturas de consumidor não dão acesso de API a um
> app. Então o "melhor plano pago" aqui = **conta de API paga com limites/tier elevados**
> nas duas plataformas.

Modelos sugeridos (fixar a versão exata na implementação):
- **Gemini** — *Flash* para ingestão barata em volume (áudio, PDF, imagem); *Pro* para
  tarefas multimodais mais pesadas.
- **Claude** — *Sonnet* (`claude-sonnet-5`) para o dia a dia de raciocínio/escrita;
  *Opus* (`claude-opus-4-8`) para o mais difícil; *Haiku* (`claude-haiku-4-5`) para
  tarefas leves e de alto volume.

---

## 2. Divisão de tarefas

Regra geral: **Gemini ingere, Claude raciocina e escreve.**

| Tarefa do Squad 8 | IA | Motivo |
|---|---|---|
| Transcrever o áudio do briefing | **Gemini** | multimodal, contexto gigante, custo baixo |
| Ler contrato → extrair dados da Cria | **Gemini** | extração de documento (PDF) |
| Ler o Diagnóstico 360 (PDF) | **Gemini** | documento longo |
| "Ver" criativos da Biblioteca (classificar por nicho/tese) | **Gemini** | visão |
| Montar o **briefing semanal** no modelo padrão | **Claude** | escrita pt-BR seguindo template |
| **Plano sugerido** para gargalos | **Claude** | raciocínio |
| Cruzar Diagnóstico × briefing → sugerir **Lenhas** | **Claude** | raciocínio |
| Assistente/chat do CRM (Faísca) | **Claude** | conversa + ações (tool-calling) |

---

## 3. Como trabalham juntas

Três padrões, usados conforme a tarefa:

1. **Pipeline / handoff (o principal).** Gemini transforma áudio/PDF/imagem em texto ou
   dados estruturados → Claude raciocina em cima e escreve o resultado final.
   Ex.: *áudio do briefing → (Gemini transcreve) → (Claude monta o briefing semanal)*.
2. **Roteador por tarefa.** A camada de IA escolhe o modelo certo por tipo de tarefa —
   ingestão vai pra Gemini, raciocínio/escrita vai pra Claude.
3. **Cross-check (só em coisas críticas).** Uma IA valida a saída da outra — usado
   pontualmente onde o erro custa caro (ex.: conferir a extração de dados do contrato).
   Dobra o custo, então é seletivo.

---

## 4. Arquitetura técnica

Na stack do produto (**Next.js 15 + TypeScript + Prisma + Supabase**):

- **Camada de orquestração de IA** no backend: um módulo que expõe funções por tarefa
  (`extrairContrato`, `briefingSemanal`, `planoDoGargalo`, `sugerirLenhas`, `faiscaChat`…).
  Cada função **roteia** para o modelo certo e **encadeia** quando necessário.
- **Vercel AI SDK** (`ai` + `@ai-sdk/google` + `@ai-sdk/anthropic`): interface única para
  os dois provedores, streaming e **saída estruturada com schema (Zod)**.
- **Saída estruturada sempre que houver dados** (campos do contrato, seções do briefing,
  itens de plano) — validada por schema, para o resultado ser confiável e cair direto no
  banco/UI.
- **Tool-calling** para a Faísca **agir** (agendar Roda de Fogo, avançar fase, distribuir Lenha,
  abrir uma Cria) — as ferramentas são funções do próprio backend do CRM.
- **Templates versionados** (modelo do briefing semanal, schema de extração do contrato,
  regras da marca) — ficam no código, não no prompt solto.
- **Prompt caching no Claude** para o contexto repetido (regras da marca, vocabulário de
  fogo, templates) — reduz custo e latência.

---

## 5. Faísca — assistente global

**Faísca** é o assistente de IA que vive **na navegação**, disponível em **qualquer aba**.

- **Botão fixo no rail** (sempre visível, inclusive no menu recolhido).
- Abre um **chat lateral** onde dá pra conversar por **texto ou voz**.
- **Voz de ponta a ponta:** o usuário fala, a Faísca **responde por voz** (além do texto),
  dando o direcionamento ou **já resolvendo a pendência**.
- **Age no CRM** via tool-calling: "agenda uma Roda de Fogo com o Mendes quinta 15h" → ela cria
  a Roda de Fogo, gera a Lenha e sincroniza no ClickUp; "quais Forjas estão atrasadas?" → ela
  responde e oferece abrir/avisar.

Pipeline da Faísca:
1. **Voz → texto:** Gemini (transcrição).
2. **Entender + decidir + agir:** Claude (com as ferramentas do CRM).
3. **Texto → voz:** TTS (voz de resposta).

Contexto: a Faísca enxerga a Cria/Forja/tela em que o usuário está, para respostas certeiras.

---

## 6. IA na organização

Como a IA vai ser muito usada, ela também **ajuda a manter a casa organizada**:

- **Biblioteca (Drive):** a IA classifica automaticamente cada roteiro/criativo por
  **nicho** e **tese** (lendo o conteúdo do arquivo), e sinaliza itens **sem categoria** ou
  fora do padrão de pastas — mantendo os filtros sempre corretos.
- **Padronização de pastas:** sugere a estrutura `Tipo / Nicho / Tese / arquivo` e aponta o
  que está fora dela.
- **Deduplicação e nomes:** sugere renomear/organizar arquivos soltos.
- **Vínculo com a Forja:** relaciona os assets da Biblioteca ao nicho da Cria, sugerindo
  roteiros/criativos prontos para cada cliente.

---

## 7. Cuidados

- **Segredos:** chaves de API no servidor (nunca no cliente); variáveis de ambiente.
- **Custo:** Gemini Flash para volume, Claude para qualidade; cross-check só onde precisa;
  prompt caching.
- **Confiabilidade:** saída estruturada com schema + validação; a IA **sugere**, a pessoa
  **decide** (especialmente em plano de gargalos e Início da Forja).
- **Privacidade / LGPD:** dados de clientes (contratos, briefings) trafegam para as APIs —
  revisar termos de uso/retenção dos provedores e o consentimento; considerar Vertex AI
  (região) para o Gemini se precisar de dado em território/contrato empresarial.
