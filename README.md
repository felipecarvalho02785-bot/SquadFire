# 🐉 SquadFire — CRM Squad 8

CRM interno da **Squad 8 / E3 Digital** para gestão de **escritórios de advocacia**
(foco previdenciário/jurídico). O sistema é organizado por uma identidade temática
**Dragão / fogo / forja**, que vira o vocabulário do produto.

> **Produto:** Estruturação (produto único) · **Clientes:** escritórios de advocacia
> **Documento vivo** — vai sendo preenchido conforme cada módulo fecha.

---

## Do que se trata

A ideia central do CRM é que **a interface se monta a partir do papel de quem faz login**.
Não é esconder botões: cada função tem a sua própria tela-casa, as suas próprias tarefas
e as suas próprias permissões. Um único CRM, mas com experiências diferentes por papel.

O fluxo de negócio gira em torno de uma jornada fixa: **cadastrar um cliente (Cria) dispara
automaticamente a Estruturação (Forja)** — um funil de **7 fases × 7 dias = 49 dias**.

## Glossário (identidade → conceito)

| Termo | Significado |
|---|---|
| **Cria** | Cliente (escritório de advocacia) |
| **Forja** | Projeto = a *Estruturação* (produto único) |
| **Lenha** | Tarefa |
| **Covil** | Dashboard (tela-casa por papel) |
| **Linha de Fogo** | Kanban |
| **Fogueira** | Entidade que orbita a Forja (papel a definir) |
| **Forja Quente / Brasa Viva** | Flag de contrato: Setup / Manutenção |

## Papéis

| Papel | Função-núcleo | Foco |
|---|---|---|
| **Gestor de Contas** | Relação com a Cria — briefing, aprovações, alinhamento | Cliente |
| **Gestor de Projetos** | Andamento da Forja — mover fases, distribuir Lenha, SLA | Execução |
| **Gestor de Tráfego** | Campanhas — setup, otimização, métricas | Tráfego |
| **Admin / Líder (Felipe)** | Gestão de membros, allowlist, visão total | Squad inteira |

## Módulos

1. **Acesso e Membros** — experiência por papel; Lenha de Forja x Lenha de Rotina; motor de recorrência.
2. **Crias (Clientes)** — cadastro dispara a Estruturação; contrato lido por IA; abas de Comentários, Gargalos/Gaps e Briefing Semanal.
3. **Forja (Estruturação)** — funil de 7 fases × 7 dias (49 dias).
4. **Covil (Dashboard)** — por papel.
5. **Backlog** — Kanban, automação do funil, formulários, IA de entregáveis, NPS, notificações, analytics, portal do cliente, compliance OAB.

## Stack prevista (implícita na spec)

- **Next.js** (front + rotas de API server-side)
- **Supabase** (banco + Storage para contratos/documentos)
- **API Anthropic** (leitura de contrato, briefing por áudio, sugestões de plano de ação)
- **Google SSO + JWT** (login com allowlist)
- **Integrações:** ClickUp (push de briefing), WhatsApp (Evolution API / Criativivo — SLA de grupos), Google (Meu Negócio, Drive/Storage)

## Decisões já fechadas

- Só **3 papéis** operacionais (Contas, Projetos, Tráfego) + Admin.
- **1 Cria = 1 Estruturação**, criada automaticamente no cadastro (sem escolha de produto).
- Funil de **7 fases × 7 dias = 49 dias** (substitui o antigo de 6 fases). Nomes **operacionais** das fases.
- Todos veem tudo; o que diferencia cada papel é a **tarefa delegada**, não a visibilidade.
- **Múltiplos papéis por membro**, com um **papel primário** (define a tela-casa do Covil).
- **Admin** é uma **flag à parte** (Felipe), por cima dos papéis.
- **Avanço de fase manual + checklist**; o prazo de 7 dias é SLA/alerta, não trava.
- **Status da Cria:** Ativa / Pausada / Encerrada; "em risco" é flag **derivada**.
- **Fogueira = Kanban (Linha de Fogo)**, em **aba separada**.
- **Campo Produto travado** em "Estruturação".
- **Covil V1** = listas + alertas + KPIs (calendário no backlog).
- **Contrato opcional no cadastro** — Forja nasce sem prazos; a IA os calcula ao confirmar o contrato.
- **Permissões por papel** (leitura total, edição por função) — matriz base pra RLS definida.
- **Checklist por fase** — Lenha de Forja padrão semeada (fases 1–2 concretas; 3–7 placeholder).

## Em aberto (aguardando input do Felipe)

- Rotinas reais de cada papel (o rascunho da spec vale como versão de trabalho).
- Deliverable concreto de cada fase (além do já mapeado).
- Material/POP oficial de referência da Estruturação.
- Validar a proposta de KPIs e os blocos do Covil por papel.

## Documentação

- 📄 [Especificação Funcional completa](docs/especificacao-funcional.md) — o documento vivo, organizado por módulo.
- 🗂️ [Modelo de Dados](docs/modelo-de-dados.md) — entidades, enums, relacionamentos e regras de negócio (base Supabase/Postgres).
- 🔁 [Catálogo de Rotinas](docs/rotinas.md) — Lenha de Rotina por papel, pronta pra seed (com pendências marcadas).
- 🎨 [Protótipo de interface](design/prototipo.html) — layout clicável (tema forja escura); ver [design/README](design/README.md).

---

> _Status: projeto em fase de estruturação. Este repositório ainda não tem código de aplicação — a base é a especificação funcional._
