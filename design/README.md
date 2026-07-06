# Design — SquadFire

Protótipo de interface (clicável, self-contained) do CRM Squad 8.

- **[`prototipo.html`](prototipo.html)** — abra no navegador. Não tem dependências; roda direto.

## Direção visual

Identidade **Dragão / fogo / forja** traduzida numa "forja à noite":

- **Tema:** escuro por padrão (fundo preto-quente, accent laranja incandescente); tema claro também desenhado. Toggle no topo.
- **Assinatura:** o funil de 7 fases é um **termômetro** — o cliente esquenta (ferro frio → branco incandescente) conforme avança na Estruturação. Casa com "Forja Quente / Têmpera / Brasa Viva".
- **Cor semântica separada do accent:** no prazo = têmpera (teal), atenção = ouro, risco = sangue de dragão (carmim).

## Telas no protótipo

| Tela | O que mostra |
|---|---|
| **Covil** | Dashboard **por papel** — troque o papel no topo (Contas/Projetos/Tráfego/Admin) e o Covil se remonta (KPIs, listas, alertas). |
| **Crias** | Lista com filtros, fase (ponto de calor), flag de contrato e status. |
| **Nova Cria** | Cadastro + anexo de contrato com **IA extraindo a data de início** (gatilho da Estruturação). |
| **Detalhe da Cria** | Hub do cliente: termômetro embutido + abas (Visão geral, Contrato, Comentários, Gargalos, **Briefing por áudio**). |
| **Briefing por áudio** | Gravar → IA estrutura os 6 campos → enviar ao ClickUp. |
| **Forja** | O termômetro em tela cheia + checklist da fase (avanço travado até concluir). |
| **Linha de Fogo** | Kanban com as 7 fases como colunas. |
| **Membros** | Múltiplos papéis por membro + papel primário + Admin como flag. |

> Protótipo de layout/UX — dados são mock. Vira componentes reais no scaffold Next.js.
