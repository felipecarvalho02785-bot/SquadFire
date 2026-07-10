// ─────────────────────────────────────────────────────────────
// SquadFire · Integração ClickUp — runner manual do sync
// ─────────────────────────────────────────────────────────────
// Uso:  CLICKUP_API_TOKEN=pk_xxx node integracao/clickup/run-sync.js
// Só imprime as Crias mapeadas (não grava em banco). Serve pra validar o
// filtro Squad 08 e o mapeamento contra o ClickUp real.

import { syncCrias } from './sync-crias.js';

const result = await syncCrias();

console.log(`Tasks na lista-mestre: ${result.total_tasks}`);
console.log(`Squad 08 (viram Cria): ${result.squad08_count}\n`);

for (const c of result.crias) {
  const fase = c.fase ? `Fase ${c.fase}` : 'Backlog';
  console.log(`- ${c.nome_cliente.padEnd(48)} ${fase.padEnd(10)} ${c.status}`);
}
