import test from 'node:test';
import assert from 'node:assert/strict';
import { GateEcho, voiceEnvelope } from '../src/gate-echo.js';
import { gateText, hasAudiblePCM } from '../gate-voice.js';
import { planWorld, validateWorldPlan } from '../src/world-planner.js';
import { gateInvocation, GATE_LINES } from '../src/gate-language.js';
import { OceanSound } from '../src/sound.js';

function fixture() {
  const parameter = () => ({ value: 0, setTargetAtTime() {} });
  const node = () => ({ gain: parameter(), frequency: parameter(), delayTime: parameter(), playbackRate: parameter(), connect() { return this; }, disconnect() { this.disconnected = true; }, start() {}, stop() {} });
  const sound = { enabled: true, context: { currentTime: 1, state: 'running', async decodeAudioData() { return { duration: 1 }; }, createBufferSource: node, createBiquadFilter: node, createGain: node, createDelay: node }, levels: { music: 0.8 }, musicGain: node(), effectsGain: node(), reverb: node(), onChange() {}, creatureAudio: { restoreMusic() {} } };
  return { sound, echo: new GateEcho(sound) };
}

test('gate light follows PCM syllable energy and the audio clock, including silence and mute', () => {
  const samples = new Float32Array(22050 * 3);
  for (let index = 22050 / 2; index < 22050; index++) samples[index] = Math.sin(index * 0.2) * 0.4;
  const envelope = voiceEnvelope({ sampleRate: 22050, duration: 3, numberOfChannels: 1, getChannelData: () => samples });
  assert.equal(envelope[10], 0); assert.ok(envelope[45] > 0.8); assert.ok(envelope[160] < 0.001);
  const { echo, sound } = fixture(); echo.status = 'speaking'; echo.envelope = envelope; echo.startedAt = 1;
  sound.context.currentTime = 0.9; assert.equal(echo.amplitude(), 0); sound.context.currentTime = 1.75; assert.ok(echo.amplitude() > 0.8);
  sound.context.state = 'suspended'; assert.equal(echo.amplitude(), 0); sound.context.state = 'running'; sound.levels.effects = 0; assert.equal(echo.amplitude(), 0);
  sound.levels.effects = 0.65; sound.userMuted = true; assert.equal(echo.amplitude(), 0); echo.stop(); assert.equal(echo.amplitude(), 0);
});

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

test('ancient Greek male recording is routed, cached and fully disconnected when stopped', async () => {
  const { sound, echo } = fixture(); const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url, options) => { requests++; assert.equal(url, './audio/gate/grc-answer.mp3'); assert.equal(options.body, undefined); return { ok: true, headers: { get: () => 'audio/mpeg' }, async arrayBuffer() { return new ArrayBuffer(1); } }; };
  try { assert.equal(await echo.speak('古城'), true); assert.equal(echo.status, 'speaking'); assert.equal(echo.source.playbackRate.value, 1); const nodes = [...echo.nodes]; echo.stop(); assert.ok(nodes.every(node => node.disconnected)); await echo.speak('古城'); assert.equal(requests, 1); sound.userMuted = true; assert.equal(await echo.speak('古城'), false); }
  finally { echo.stop(); globalThis.fetch = original; }
});

test('missing ancient Greek audio never falls back to Chinese speech; stale requests cannot speak', async () => {
  const { sound, echo } = fixture(); const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  sound.chant = () => { assert.fail('Chinese device speech is forbidden for the gate'); };
  try {
    assert.equal(await echo.speak('古城'), false); assert.equal(echo.status, 'unavailable');
    let resolve; globalThis.fetch = () => new Promise(done => { resolve = done; });
    const pending = echo.speak('旧的请求'); echo.stop(); resolve({ ok: false }); assert.equal(await pending, false); assert.equal(echo.status, 'idle');
  } finally { echo.stop(); globalThis.fetch = original; }
});

test('semantic invocations select ancient Greek only and never turn arbitrary input into a path', () => {
  assert.equal(gateInvocation('唤醒鲸鱼').id, 'whale'); assert.equal(gateInvocation('沉睡的光').id, 'light'); assert.equal(gateInvocation('回忆').id, 'memory');
  for (const text of ['../../private', '一个陌生人的名字', 'https://example.invalid']) assert.equal(gateInvocation(text).file, 'audio/gate/grc-answer.mp3');
  for (const line of Object.values(GATE_LINES)) { assert.doesNotMatch(line.ancient, /[\u4e00-\u9fffA-Za-z]/); assert.match(line.ancient, /[\u0370-\u03ff\u1f00-\u1fff]/); assert.ok(line.meaning); }
});

test('optional Chinese narration cannot play at the gate even when explicitly enabled', () => {
  const sound = new OceanSound(); sound.enabled = true; sound.narration = true; sound.site = 'gate';
  assert.equal(sound.chant('这句话不能发声', { explicit: true }), false);
  sound.site = 'palace'; sound.gateEcho.status = 'speaking';
  assert.equal(sound.chant('这句话也不能发声', { explicit: true }), false);
});

test('gate audio unlock does not wait for the orchestral sample download', async () => {
  const originalDocument = globalThis.document; globalThis.document = { hidden: false };
  const { sound } = fixture(); let finishMusic; let setScene = false;
  Object.setPrototypeOf(sound, OceanSound.prototype);
  sound.master = { gain: { setTargetAtTime() {} } };
  sound.creatureAudio.prepare = () => Promise.resolve();
  sound.orchestra = { load: () => new Promise(resolve => { finishMusic = resolve; }), setScene() { setScene = true; }, setIntensity() {} };
  try {
    assert.equal(await sound.activateFromGesture({ waitForMusic: false }), true);
    assert.equal(setScene, false); finishMusic(); await Promise.resolve(); assert.equal(setScene, true);
  } finally { globalThis.document = originalDocument; }
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
