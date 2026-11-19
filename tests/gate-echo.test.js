import test from 'node:test';
import assert from 'node:assert/strict';
import { GateEcho } from '../src/gate-echo.js';
import { gateText, hasAudiblePCM } from '../gate-voice.js';
import { planWorld, validateWorldPlan } from '../src/world-planner.js';

function fixture() {
  const parameter = () => ({ value: 0, setTargetAtTime() {} });
  const node = () => ({ gain: parameter(), frequency: parameter(), delayTime: parameter(), playbackRate: parameter(), connect() { return this; }, disconnect() { this.disconnected = true; }, start() {}, stop() {} });
  const sound = { enabled: true, context: { currentTime: 1, state: 'running', async decodeAudioData() { return { duration: 1 }; }, createBufferSource: node, createBiquadFilter: node, createGain: node, createDelay: node }, levels: { music: 0.8 }, musicGain: node(), effectsGain: node(), reverb: node(), onChange() {}, creatureAudio: { restoreMusic() {} } };
  return { sound, echo: new GateEcho(sound) };
}

test('gate text is bounded plain text, including option-looking text, never a shell command', () => {
  assert.equal(gateText(' --help '), '--help'); assert.equal(gateText(' 古城 '), '古城');
  for (const value of ['', 'a'.repeat(161), 'hello\nworld', {}, null]) assert.throws(() => gateText(value));
  const action = planWorld('回声之门：唤回沉睡的光'); assert.equal(action.args.echo, '唤回沉睡的光');
  assert.ok(validateWorldPlan(action, { position: [495, 38, -245] }));
  assert.throws(() => validateWorldPlan(action, { position: [0, 0, 0] }));
});

test('empty or silent WAV files cannot masquerade as successful speech', () => {
  assert.equal(hasAudiblePCM(Buffer.alloc(4096)), false);
  const audio = Buffer.alloc(44 + 44100); audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(22050, 24); audio.writeUInt32LE(44100, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(44100, 40);
  assert.equal(hasAudiblePCM(audio), false); audio.writeInt16LE(3200, 400); assert.equal(hasAudiblePCM(audio), true);
});

test('decoded echo is audible, pitch-shifted and fully disconnected when stopped', async () => {
  const { sound, echo } = fixture(); const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, headers: { get: () => 'audio/wav' }, async arrayBuffer() { return new ArrayBuffer(1); } });
  try { assert.equal(await echo.speak('古城'), true); assert.equal(echo.status, 'speaking'); assert.equal(echo.source.playbackRate.value, 0.86); const nodes = [...echo.nodes]; echo.stop(); assert.ok(nodes.every(node => node.disconnected)); sound.userMuted = true; assert.equal(await echo.speak('古城'), false); }
  finally { echo.stop(); globalThis.fetch = original; }
});

test('device fallback releases its speaking state and stale requests cannot speak later', async () => {
  const { sound, echo } = fixture(); const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false }); let finish;
  sound.chant = (text, options) => { assert.equal(options.cancelGate, false); finish = options.onend; return true; };
  try {
    assert.equal(await echo.speak('古城'), true); assert.equal(echo.status, 'device-voice'); finish(); assert.equal(echo.status, 'idle');
    let resolve; globalThis.fetch = () => new Promise(done => { resolve = done; });
    const pending = echo.speak('旧的请求'); echo.stop(); resolve({ ok: false }); assert.equal(await pending, false); assert.equal(echo.status, 'idle');
  } finally { echo.stop(); globalThis.fetch = original; }
});

test('an older request cannot clear the timeout of a newer invocation', async () => {
  const { echo } = fixture(); const originalFetch = globalThis.fetch; const originalSet = globalThis.setTimeout; const originalClear = globalThis.clearTimeout;
  const pending = [];
  globalThis.setTimeout = () => ({ cleared: false }); globalThis.clearTimeout = timer => { if (timer) timer.cleared = true; };
  globalThis.fetch = () => new Promise(resolve => pending.push(resolve));
  try {
    const older = echo.speak('先前的回声'); const previousTimer = echo.loadTimer;
    const newer = echo.speak('新的回声'); const currentTimer = echo.loadTimer;
    pending[0]({ ok: false }); await older;
    assert.equal(previousTimer.cleared, true); assert.equal(currentTimer.cleared, false);
    echo.stop(); pending[1]({ ok: false }); await newer; assert.equal(currentTimer.cleared, true);
  } finally { echo.stop(); globalThis.fetch = originalFetch; globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
});
