import test from 'node:test';
import assert from 'node:assert/strict';
import { queuedReply } from '../src/ai.js';

test('chat skips a missing model and retries a temporary Gemini failure once', async (t) => {
  t.mock.method(console, 'warn', () => {});
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'configured-model';
  const attempts = [];
  const models = 'gemini-3.5-flash-lite';
  t.mock.method(globalThis, 'fetch', async (url) => {
    const model = url.split('/').at(-1).split(':')[0];
    attempts.push(model);
    if (model === 'configured-model') return new Response('{}', { status: 404 });
    if (model !== models || attempts.filter((current) => current === model).length === 1) {
      return new Response('{}', { status: 503 });
    }
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'Internal', thought: true }, { text: 'Ready' }] } }],
    });
  });
  assert.equal(await queuedReply('hello'), 'Ready');
  assert.equal(attempts.filter((model) => model === models).length, 2);
  assert.equal(await queuedReply('again'), 'Ready');
  assert.equal(attempts.filter((model) => model === 'configured-model').length, 1);
  assert.ok(!attempts.some((model) => model.startsWith('gemini-2.5')));
});
