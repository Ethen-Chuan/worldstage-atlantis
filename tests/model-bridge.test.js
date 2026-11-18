import test from 'node:test';
import assert from 'node:assert/strict';
import { modelConfig, publicConfig, safeContext, requestModelPlan } from '../model-bridge.js';
import { interpretUtterance, executeUtterance, initialState } from '../src/dialogue.js';

test('no credentials means no model call, not a pretend fallback', async () => {
  let called = false;
  await assert.rejects(requestModelPlan({ text: '靠近' }, modelConfig({}), async () => { called = true; }), /未配置/);
  assert.equal(called, false);
});

test('model endpoint must use HTTPS except explicit local endpoints', () => {
  const values = { WORLDSTAGE_MODEL_NAME: 'test', WORLDSTAGE_MODEL_KEY: '[REDACTED_SECRET]-TEST_ONLY' };
  const credentialed = new URL('https://example.com/chat');
  credentialed.username = '[REDACTED_SECRET]';
  credentialed.password = '[REDACTED_SECRET]';
  for (const endpoint of ['file:///etc/passwd', 'http://example.com/chat', credentialed.href, 'https://example.com/chat?key=test', 'http://localhost:8888/chat?key=test']) assert.equal(modelConfig({ ...values, WORLDSTAGE_MODEL_ENDPOINT: endpoint }).available, false);
  assert.equal(modelConfig({ ...values, WORLDSTAGE_MODEL_ENDPOINT: 'http://127.0.0.1:8888/chat' }).available, true);
});

test('the distributed placeholder does not enable a language model service', () => {
  assert.equal(modelConfig({ WORLDSTAGE_MODEL_ENDPOINT: 'https://example.com/chat', WORLDSTAGE_MODEL_NAME: 'test', WORLDSTAGE_MODEL_KEY: '[REDACTED_SECRET]' }).available, false);
});

test('public configuration contains no credential or private endpoint path', () => {
  const config = { available: true, endpoint: 'https://example.com/private/chat', authorization: '[REDACTED_SECRET]', model: 'test' };
  assert.deepEqual(publicConfig(config), { available: true, mode: 'model-ready', provider: 'example.com' });
});

test('unneeded state is stripped before forwarding to a model', () => {
  const context = safeContext({ selected: '__proto__', location: 'arbitrary', history: ['reef', 'secret'], arbitrary: 'not forwarded', events: { crown: true, private: true } });
  assert.equal(context.selected, 'manta');
  assert.equal(context.location, 'threshold');
  assert.deepEqual(context.history, ['reef']);
  assert.equal(Object.hasOwn(context, 'arbitrary'), false);
  assert.equal(Object.hasOwn(context.events, 'private'), false);
});

test('stub transport exercises model JSON to validated scene commands without a real paid call', async () => {
  const expected = interpretUtterance('让鲸鱼远一点，慢慢带我去海沟，但保持明亮');
  const plan = await requestModelPlan({ text: '请让那位巨大的伙伴和我保持一点距离，缓缓去海沟，别变暗', context: { selected: 'whale' } }, { available: true, endpoint: 'https://example.com/chat', authorization: '[REDACTED_SECRET]', model: 'test' }, async (url, request) => {
    assert.equal(url, 'https://example.com/chat');
    const body = JSON.parse(request.body);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.messages.length, 2);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ operations: expected.operations, issues: [] }) } }] }) };
  });
  const result = executeUtterance(initialState(), plan);
  assert.equal(result.state.destination, 'trench');
  assert.equal(result.state.speed, 0.55);
  assert.equal(result.state.mood, 'day');
  assert.equal(result.state.distances.whale, 1.38);
});

test('provider rejection and malformed output never become actions', async () => {
  const config = { available: true, endpoint: 'https://example.com/chat', authorization: '[REDACTED_SECRET]', model: 'test' };
  await assert.rejects(requestModelPlan({ text: '你好' }, config, async () => ({ ok: false, status: 401 })), /401/);
  await assert.rejects(requestModelPlan({ text: '你好' }, config, async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) })), /有效/);
});
