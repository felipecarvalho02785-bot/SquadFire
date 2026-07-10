// ─────────────────────────────────────────────────────────────
// SquadFire · Integração ClickUp — push do briefing (CRM → ClickUp)
// ─────────────────────────────────────────────────────────────
// Único fluxo de ESCRITA da integração: o briefing semanal (6 campos) é
// publicado como COMENTÁRIO na task-mestre do cliente no ClickUp
// (= cria.clickup_task_id). Todo o resto é leitura (ClickUp → CRM).
// Ver docs/modelo-de-dados.md § briefing e § Integração ClickUp.

import { createTaskComment } from './client.js';

// Rótulos dos 6 campos do briefing, na ordem do modelo do Squad 8.
const CAMPOS = [
  ['c1_o_que_aconteceu', 'O que aconteceu essa semana'],
  ['c2_satisfacao', 'Satisfação'],
  ['c3_campanhas', 'Campanhas'],
  ['c4_nosso_desempenho', 'Nosso desempenho'],
  ['c5_pontos_atencao', 'Pontos de atenção'],
  ['c6_proximos_passos', 'Próximos passos'],
];

// Monta o texto do comentário a partir do registro de briefing.
export function formatBriefingComment(briefing) {
  const cabecalho = briefing.semana_referencia
    ? `📋 Briefing semanal — semana de ${briefing.semana_referencia}`
    : '📋 Briefing semanal';
  const corpo = CAMPOS.filter(([k]) => briefing[k])
    .map(([k, label]) => `*${label}*\n${briefing[k]}`)
    .join('\n\n');
  return `${cabecalho}\n\n${corpo}`;
}

// Publica o briefing como comentário na task do cliente.
// `cria` precisa ter clickup_task_id (vínculo com a task-mestre).
// Devolve { clickup_comment_id } pra gravar no briefing (idempotência).
export async function pushBriefing(cria, briefing, opts = {}) {
  if (!cria?.clickup_task_id) {
    throw new Error('Cria sem clickup_task_id: não dá pra publicar o briefing no ClickUp.');
  }
  const text = formatBriefingComment(briefing);
  const res = await createTaskComment(cria.clickup_task_id, text, opts);
  return { clickup_comment_id: res?.id ?? null };
}
