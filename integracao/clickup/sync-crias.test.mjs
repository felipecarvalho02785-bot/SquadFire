// Testes do mapeamento ClickUp → cria. Rodar: `node --test integracao/clickup/`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTaskToCria, isSquad08, getSemana } from './sync-crias.js';
import { CLICKUP } from './config.js';

const SQUAD = CLICKUP.fields.squad.id;
const SEMANA = CLICKUP.fields.semana.id;
const SQUAD08_OPT = CLICKUP.fields.squad.squad08OptionId;
const SQUAD08_IDX = CLICKUP.fields.squad.squad08OrderIndex;
const STATUS_CRIA = new Set(['ativa', 'pausada', 'encerrada']);

function task(name, status, semanaIdx, squadIdx = SQUAD08_IDX) {
  const cf = [
    {
      id: SQUAD,
      value: squadIdx,
      type_config: { options: [{ id: SQUAD08_OPT, name: 'Squad 08', orderindex: SQUAD08_IDX }] },
    },
  ];
  if (semanaIdx !== undefined) {
    cf.push({
      id: SEMANA,
      value: semanaIdx,
      type_config: { options: [{ orderindex: semanaIdx, name: `Semana ${semanaIdx + 1}` }] },
    });
  }
  return { id: `t_${name}`, name, url: 'http://x', status: { status }, custom_fields: cf };
}

test('status sempre pertence ao enum status_cria', () => {
  const casos = [
    ['em execução', 2],
    ['Backlog', undefined],
    ['Churn / Cancelado', 3],
    ['Finalizado', 6],
    ['Em espera / Hold', 1],
    ['Onboarding', 0],
  ];
  for (const [status, semana] of casos) {
    const c = mapTaskToCria(task('c', status, semana));
    assert.ok(STATUS_CRIA.has(c.status), `status inválido: ${c.status} (${status})`);
  }
});

test('churn e finalizada → encerrada, com motivo preservado', () => {
  const churn = mapTaskToCria(task('a', 'Churn', 3));
  assert.equal(churn.status, 'encerrada');
  assert.equal(churn._source.motivo, 'churn');

  const fim = mapTaskToCria(task('b', 'Finalizado', 6));
  assert.equal(fim.status, 'encerrada');
  assert.equal(fim._source.motivo, 'finalizada');
});

test('hold → pausada', () => {
  const c = mapTaskToCria(task('h', 'Em espera / Hold', 1));
  assert.equal(c.status, 'pausada');
});

test('Semana (orderindex) → fase 1..7; backlog sem fase', () => {
  assert.equal(getSemana(task('s', 'exec', 0)), 1);
  assert.equal(getSemana(task('s', 'exec', 6)), 7);
  const bk = mapTaskToCria(task('bk', 'Backlog', undefined));
  assert.equal(bk.fase, null);
  assert.equal(bk.backlog, true);
});

test('isSquad08 filtra corretamente', () => {
  assert.equal(isSquad08(task('ok', 'exec', 2, SQUAD08_IDX)), true);
  // outro squad (orderindex diferente e id diferente)
  const outro = {
    id: 't_o',
    name: 'outro',
    status: { status: 'exec' },
    custom_fields: [
      { id: SQUAD, value: 0, type_config: { options: [{ id: 'zzz', name: 'Squad 01', orderindex: 0 }] } },
    ],
  };
  assert.equal(isSquad08(outro), false);
});
