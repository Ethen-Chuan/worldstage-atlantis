import test from 'node:test';
import assert from 'node:assert/strict';
import { VideoBridge, mediaConfig, publicMediaConfig, validateVideoInput } from '../video-bridge.js';
import { requestModelPlan } from '../model-bridge.js';
import { operation } from '../src/creation.js';

const bytes = Buffer.alloc(256); bytes[0] = 255; bytes[1] = 216; bytes[254] = 255; bytes[255] = 217;
const input = { consent: true, model: 'gen4.5', prompt: 'Atlantis', image: `data:image/jpeg;base64,${bytes.toString('base64')}` };
test('media services default to unavailable and never expose credentials', () => {
  assert.equal(publicMediaConfig(mediaConfig({})).video.available, false);
  const config = mediaConfig({ RUNWAYML_API_SECRET: '[REDACTED_SECRET]', WORLDSTAGE_SCOPE_URL: 'http://127.0.0.1:8000', WORLDSTAGE_SCOPE_KEY: '[REDACTED_SECRET]' });
  assert.equal(JSON.stringify(publicMediaConfig(config)).includes('REDACTED_SECRET'), false);
  for (const url of ['file:///tmp/a', 'http://example.com', 'https://example.com/?token=test']) assert.equal(mediaConfig({ WORLDSTAGE_SCOPE_URL: url }).scope, '');
});

test('the distributed placeholder cannot activate paid video requests', () => {
  const config = mediaConfig({ RUNWAYML_API_SECRET: '[REDACTED_SECRET]', WORLDSTAGE_SCOPE_KEY: '[REDACTED_SECRET]' });
  assert.equal(publicMediaConfig(config).video.available, false); assert.equal(config.scopeAuthorization, '');
});
test('video consent, valid JPEG input and whitelisted models are mandatory', () => {
  assert.equal(validateVideoInput(input).duration, 5);
  for (const patch of [{ consent: false }, { image: 'https://example.com/private.jpg' }, { image: 'data:image/jpeg;base64,YQ==' }, { model: '__proto__' }]) assert.throws(() => validateVideoInput({ ...input, ...patch }));
});
test('mock Runway transport creates once, polls and cancels only known tasks', async () => {
  const calls = [];
  const bridge = new VideoBridge({ runway: '[REDACTED_SECRET]' }, async (url, request) => {
    calls.push([url, request.method]);
    assert.equal(request.headers['X-Runway-Version'], '2024-11-06');
    return { ok: true, status: request.method === 'DELETE' ? 204 : 200, json: async () => request.method === 'POST' ? { id: 'mock-task', estimatedCost: { credits: 25 } } : { status: 'RUNNING', progress: 0.5 } };
  });
  const task = await bridge.create(input); assert.equal(task.estimatedCredits, 25);
  await assert.rejects(bridge.create(input), /等待或取消/);
  assert.equal((await bridge.status(task.id)).progress, 0.5);
  await assert.rejects(bridge.status('unknown'), /未找到/);
  assert.equal((await bridge.cancel(task.id)).status, 'CANCELLED');
  assert.equal(calls.length, 3);
});
test('no credentials never attempts a real network request', async () => {
  let called = false; const bridge = new VideoBridge({}, async () => { called = true; });
  await assert.rejects(bridge.create(input), /未配置/); await assert.rejects(bridge.realtimeStatus(), /未配置/); assert.equal(called, false);
});
test('Scope protocol filters input and only forwards candidates for known sessions', async () => {
  const calls = []; const bridge = new VideoBridge({ scope: 'http://127.0.0.1:8000' }, async (url, request) => {
    calls.push({ url, body: request.body && JSON.parse(request.body) });
    return { ok: true, status: 200, json: async () => url.endsWith('/offer') ? { sessionId: 'mock-session', type: 'answer', sdp: 'mock-sdp' } : url.endsWith('/status') ? { status: 'loaded', pipeline_id: 'longlive', load_params: { width: 576, height: 320 } } : {} };
  });
  assert.equal((await bridge.realtimeStatus()).pipeline, 'longlive');
  await bridge.offer({ consent: true, type: 'offer', sdp: 'mock-offer', prompt: 'Atlantis', arbitrary: 'not forwarded' });
  assert.equal(calls[1].body.initialParameters.input_mode, 'video'); assert.equal(calls[1].body.arbitrary, undefined);
  await assert.rejects(bridge.candidates('unknown', { candidates: [] }), /会话不存在/);
  await bridge.candidates('mock-session', { candidates: [{ candidate: 'candidate:mock', sdpMid: '0', sdpMLineIndex: 0 }] });
  assert.equal(calls.length, 3);
});
test('creation model route uses the creation schema and not the old exploration grammar', async () => {
  const plan = { operations: [operation('create', { asset: 'temple', count: 1, placement: 'front' })], issues: [] };
  const result = await requestModelPlan({ mode: 'creation', text: '创造一座神殿' }, { available: true, endpoint: 'https://example.com', authorization: '[REDACTED_SECRET]', model: 'mock' }, async (url, request) => {
    const body = JSON.parse(request.body); assert.ok(body.response_format.json_schema.schema.properties.operations.items.properties.kind.enum.includes('create'));
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(plan) } }] }) };
  });
  assert.equal(result.operations[0].asset, 'temple');
});
