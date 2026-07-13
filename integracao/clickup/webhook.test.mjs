// Testes do handler de webhook (comentário ClickUp → CRM + assinatura).
// Rodar: `node --test integracao/clickup/`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const SECRET = 'test-secret';
process.env.CLICKUP_WEBHOOK_SECRET = SECRET;

const { handleWebhook } = await import('./webhook.js');

function assinar(bodyObj) {
  const rawBody = JSON.stringify(bodyObj);
  const signature = createHmac('sha256', SECRET).update(rawBody).digest('hex');
  return { rawBody, signature, payload: bodyObj };
}

test('taskCommentPosted → action comment com texto e autor', async () => {
  const r = await handleWebhook(
    assinar({
      event: 'taskCommentPosted',
      task_id: 't_123',
      history_items: [{ id: 'h1', comment: { id: 'c_9', comment_text: 'Oi, tudo certo?' }, user: { email: 'zaza@e3.com', username: 'Zaza' } }],
    }),
  );
  assert.equal(r.action, 'comment');
  assert.equal(r.clickup_task_id, 't_123');
  assert.equal(r.comment.id, 'c_9');
  assert.equal(r.comment.texto, 'Oi, tudo certo?');
  assert.equal(r.comment.autor_email, 'zaza@e3.com');
  assert.equal(r.comment.autor_nome, 'Zaza');
});

test('texto rico (array comment) é concatenado; sem user → nome ClickUp', async () => {
  const r = await handleWebhook(
    assinar({
      event: 'taskCommentPosted',
      task_id: 't_1',
      history_items: [{ comment: { id: 'c1', comment: [{ text: 'parte 1 ' }, { text: 'parte 2' }] } }],
    }),
  );
  assert.equal(r.comment.texto, 'parte 1 parte 2');
  assert.equal(r.comment.autor_nome, 'ClickUp');
});

test('assinatura inválida é rejeitada', async () => {
  const r = await handleWebhook({ rawBody: '{}', signature: 'errada', payload: {} });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});
