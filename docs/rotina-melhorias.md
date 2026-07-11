# Diagnóstico de rotina & melhorias

Diagnóstico focado em **facilitar o dia a dia** do Squad e o que foi feito no protótipo pra isso.
Base: [`rotinas.md`](rotinas.md) (o que o time faz) × o que o app cobre.

## A rotina que o app precisa servir
- **Diário:** Daily (squad) · Projetos nos grupos/execução/acompanhamento · Contas fecha relatório
  no fim do expediente · Tráfego checa campanhas.
- **Quinta:** relatório de saúde no ClickUp = **briefing semanal** (Projetos + Tráfego).
- **Sexta:** Weekly + Planilha BSC. **Mensal:** NPS. **Sprint:** ciclo S1→S4.
- **Contas:** check-in semanal **por Cria** + renovação/contrato.

## O atrito central
O app era **visão de gestão** (Covil = panorama). Faltava (1) um **foco diário pessoal** ("o que eu
faço agora") e (2) os **rituais recorrentes operacionalizados** (o app não gerava/cobrava sozinho).
Resultado: o time **pensava a rotina** em vez de **executar** o que o app já sabe.

## O que foi implementado no protótipo (em sessão)

| # | Melhoria | Onde |
|---|---|---|
| 1 · 6 · 9 | **"Meu Dia"** — cockpit diário por membro: banner do ritual, KPIs do dia, Lenhas de hoje com tags de **recorrência**, rituais da semana (Daily/Briefing/Weekly/NPS ou sprint) | nova tela (landing) |
| 2 · 3 | **Briefings & check-ins da semana** — lista de Crias pendentes, 1 clique abre a Cria | bloco no Meu Dia |
| 7 | **Fechar o dia** — a Faísca gera o rascunho do relatório de fim de expediente | Meu Dia |
| 4 | **Ações rápidas nas Tarefas** — "✓ todas" por grupo + "abrir →" a Cria no hover | Tarefas |
| 5 | **Atalho do grupo (WhatsApp)** — "abrir grupo" + último contato | detalhe da Cria |
| 8 | **NPS registrável** — clicar em "registrar mês →" grava o NPS do mês | detalhe da Cria |
| 10 | **Modelos** — templates de comentário (confirmação de call, follow-up NPS, pedido de acesso, alinhamento) | compositor de comentários |
| 12 | **Sprint tracker** — "Sprint S_/4" derivado do dia da Forja | detalhe da Cria |

> Tudo em sessão (sem persistência) — demonstra o comportamento; a versão real depende do backend.

## O que ainda depende de backend (roteiro P1)
- **Motor de recorrência** — as rotinas (diária/quinta/sexta/mensal) **geram as Lenhas do dia
  sozinhas** (hoje o protótipo só exibe as tags "repete"). É o divisor de águas da rotina.
- **Relatório diário automático** de verdade — a partir das Lenhas realmente concluídas.
- **NPS** persistido + tendência + gatilho do risco de churn.
- **Notificações por ritual** — quinta=briefing, sexta=weekly+BSC, fim de dia=relatório
  (o centro de notificações já existe; falta a lógica de agenda).
- **Atalho do grupo** ligado ao campo "Link do grupo" do ClickUp.

## Pendências de decisão (de `rotinas.md`)
- Dia do mês do NPS · data-âncora do ciclo de sprint.
- Cadência do relatório pro cliente (quinzenal? mensal?) · renovação (rotina ou evento).
- Check-in de Contas: dia fixo da semana ou "toda semana, por Cria".
- Tráfego: confirmar diária/diária/semanal das rotinas.
- Admin: rotina recorrente ou nenhuma.

> Ficou fora (por decisão): **command palette (Cmd/Ctrl+K)**.
