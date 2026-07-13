# Integrações — ligar as APIs (ClickUp · Claude · Gemini)

Runbook para sair do "modo demonstração" e virar operação real. Todas as chaves
vão em **Vercel → Settings → Environment Variables** (escopo **Production**, e
**Preview** se quiser testar no preview). Nada de segredo no cliente/navegador.

> Depois de adicionar/alterar variáveis na Vercel, **Redeploy** (as `NEXT_PUBLIC_*`
> entram no build; as demais valem no próximo deploy/execução).

## Mapa das variáveis

| Variável | Para quê | Onde pegar | Escopo |
|---|---|---|---|
| `CLICKUP_API_TOKEN` | ler as Crias (sync) | ClickUp → Settings → Apps → API Token (`pk_...`) | server |
| `CLICKUP_WEBHOOK_SECRET` | validar o webhook (HMAC) | você gera (segredo forte) | server |
| `CRON_SECRET` | proteger `/api/clickup/sync` e `/api/rotinas/gerar` | você gera (já definido no launch) | server |
| `ANTHROPIC_API_KEY` | Faísca: estruturar briefing | console.anthropic.com → API Keys (`sk-ant-...`) | server |
| `ANTHROPIC_MODEL` | modelo do Claude (opcional) | default `claude-sonnet-5` | server |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Faísca: transcrever áudio | aistudio.google.com/apikey | server |

Os IDs do workspace (team, lista-mestre "Estruturação", custom fields Squad/Semana)
já estão em `integracao/clickup/config.js` — não precisa configurar.

---

## 1. ClickUp — a fonte das Crias

**O que faz:** materializa cada task da lista-mestre "Estruturação" (filtro Squad 08)
como uma **Cria** no banco. No primeiro insert, um trigger cria a **Forja** (7 fases
× 7 dias) e as Lenhas iniciais. É isso que enche Covil, Meu Dia, Crias e Linha de Fogo.

**Passos**
1. ClickUp → **Settings → Apps → API Token** → gere um Personal Token (`pk_...`).
2. Vercel → adicione `CLICKUP_API_TOKEN` = esse token.
3. Gere um segredo forte e adicione `CLICKUP_WEBHOOK_SECRET` (só será usado no passo 5).
4. **Redeploy**.
5. **Rode o primeiro sync** (materializa as Crias):
   ```bash
   curl -X POST https://squadfire.vercel.app/api/clickup/sync \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
   Resposta esperada: `{"ok":true,"upserts":N,...}`. Abra `/crias` — devem aparecer.
6. **Cron diário** (Hobby): já configurado em `vercel.json` → `/api/clickup/sync` às 09:00.
   Para tempo real, crie um **webhook** no ClickUp apontando para
   `https://squadfire.vercel.app/api/clickup/webhook` (assinado com `CLICKUP_WEBHOOK_SECRET`).

**Caminho:** ClickUp (lista Estruturação, Squad 08) → `/api/clickup/sync` → upsert em
`cria` → trigger cria Forja + fases + Lenhas → telas do app.

---

## 2. Anthropic (Claude) — o cérebro da Faísca

**O que faz:** transforma a transcrição do briefing nos **6 campos** do modelo semanal
(pt-BR), sem inventar números. Também raciocina sobre risco, gargalos, etc.

**Passos**
1. console.anthropic.com → **API Keys** → crie uma chave (`sk-ant-...`). Garanta crédito/billing.
2. Vercel → `ANTHROPIC_API_KEY` = a chave. (Opcional: `ANTHROPIC_MODEL`, default `claude-sonnet-5`.)
3. **Redeploy**. Sem a chave, os endpoints de IA respondem `501` (desligados) — não quebram o app.

**Caminho:** transcrição → Claude (`estruturarBriefing`) → 6 campos → salvos no briefing.

---

## 3. Gemini (Google AI Studio) — transcrição de áudio

**O que faz:** transcreve o áudio do briefing (gravado na página da Cria) em texto,
que a Faísca (Claude) então estrutura.

**Passos**
1. aistudio.google.com/apikey → gere uma API key.
2. Vercel → `GOOGLE_GENERATIVE_AI_API_KEY` = a chave.
3. **Redeploy**.

**Caminho:** áudio (Cria) → `/api/faisca/briefing` → Gemini transcreve → Claude estrutura
→ briefing salvo → (push pro ClickUp como comentário).

---

## Pipeline completo do briefing (juntando tudo)

Gravar áudio na Cria → **Gemini** transcreve → **Claude** monta os 6 campos →
salva `briefing` no Supabase → publica no **ClickUp** (comentário na task da Cria).

## Motor de recorrência + risco (cron)

`/api/rotinas/gerar` (cron diário, 09:30) gera as Lenhas de Rotina do dia por papel e
recalcula `em_risco` das Crias por SLA. Protegido por `CRON_SECRET`.

## Verificação rápida

Abra **Forjaria** no app: cada integração mostra **conectado / pendente** conforme a
env estiver setada. É o jeito mais rápido de conferir o que já entrou.

## Ainda P1 (não bloqueia)

Google Calendar (agenda do dia + Roda de Fogo) e os 2 custom fields extras do ClickUp.
Ver `docs/roteiro-producao.md`.
