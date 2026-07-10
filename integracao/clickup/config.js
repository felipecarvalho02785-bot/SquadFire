// ─────────────────────────────────────────────────────────────
// SquadFire · Integração ClickUp — IDs e constantes do workspace
// ─────────────────────────────────────────────────────────────
// Fonte de verdade das Crias: a lista-mestre "Estruturação" no ClickUp.
// Cada task = 1 escritório (cliente). Só entram no CRM os do Squad 08.
// Ver docs/modelo-de-dados.md § Integração ClickUp.

export const CLICKUP = {
  apiBase: 'https://api.clickup.com/api/v2',

  teamId: '9007045289', // E3 Digital
  spaceId: '901312638575', // Projetos

  // Lista-mestre: 1 task = 1 cliente (status = ciclo de vida)
  listaMestre: {
    folderId: '901316177250', // Gestão de Projetos
    listId: '901324100247', // Estruturação (lista-mestre)
  },

  // Folder operacional com listas semanais (Semana 1–7+) — não é a fonte das Crias
  folderSemanal: '901316177650', // Estruturação

  // Custom fields
  fields: {
    squad: {
      id: '280cc0b8-7014-490c-b798-5785b0a9d501',
      // Squad 08 = orderindex 7
      squad08OptionId: '745a8f43-44f1-4060-9270-6da328da77d7',
      squad08Label: 'Squad 08',
      squad08OrderIndex: 7,
    },
    semana: {
      id: '0b75db7c-c23b-404c-a590-4168337fb39d',
      // orderindex 0 = Semana 1 … 6 = Semana 7+  → fase = orderindex + 1
    },
  },
};

// Token da API do ClickUp — SEMPRE via env, nunca hardcoded.
// Personal token (pk_...) ou OAuth access token.
export function getClickUpToken() {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    throw new Error(
      'CLICKUP_API_TOKEN não definido. Copie .env.example → .env.local e preencha (nunca comite o token).',
    );
  }
  return token;
}

// Segredo do webhook (assinatura HMAC do ClickUp) — via env.
export function getWebhookSecret() {
  return process.env.CLICKUP_WEBHOOK_SECRET || '';
}
