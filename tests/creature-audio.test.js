import test from 'node:test';
import assert from 'node:assert/strict';
import { CreatureAudio } from '../src/creature-audio.js';
import { planWorld, validateWorldPlan, worldAction } from '../src/world-planner.js';

function fixture() {
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => ({ gain: parameter(), pan: parameter(), frequency: parameter(), connect() { return this; }, disconnect() {}, start() {}, stop() { this.onended?.(); } });
  const context = { currentTime: 10, state: 'running', createBufferSource: node, createGain: node, createStereoPanner: node, createBiquadFilter: node, async decodeAudioData() { return { duration: 80 }; } };
  const sound = { context, enabled: true, unlocked: true, paused: false, voices: new Set(), effectsGain: node(), musicGain: node(), reverb: node(), levels: { music: 0.8 }, onChange() {} };
  const audio = new CreatureAudio(sound);
  audio.buffers.set('mermaid-song', { duration: 78 }); audio.buffers.set('distant-whale', { duration: 48 }); audio.status = 'ready';
  const actor = { species: 'mermaid', root: { userData: {} }, distance: 25, pan: 0.2 };
  return { audio, sound, actor };
}

test('lyrical songs use recorded buffers, animate the singer, and never overlap whale calls', () => {
  const { audio, sound, actor } = fixture();
  audio.update([actor]); assert.equal(audio.inspect().singing, true); assert.equal(actor.root.userData.singing, true);
  for (let frame = 0; frame < 60; frame++) audio.update([actor]);
  assert.equal(sound.voices.size, 1); assert.equal(audio.whale({ force: true }), false);
  audio.activeSong.source.onended(); assert.equal(actor.root.userData.singing, false);
  sound.context.currentTime = 75; assert.equal(audio.whale(), true);
  assert.equal(audio.sing(actor, { force: true }), false);
});

test('departing singers fade out, and pause or mute stops foreground creature audio', () => {
  const { audio, sound, actor } = fixture(); audio.sing(actor);
  audio.update([]); assert.equal(audio.activeSong, null); assert.equal(actor.root.userData.singing, false);
  sound.context.currentTime = 140; audio.whale(); sound.paused = true; audio.update([]);
  assert.equal(audio.activeWhale, null);
  sound.paused = false; sound.enabled = false; assert.equal(audio.sing(actor, { force: true }), false);
});

test('missing song asset is a visible error, never a synthesized substitute, and supports retry', async () => {
  const { audio } = fixture(); const original = globalThis.fetch;
  audio.buffers.clear(); audio.status = 'idle'; globalThis.fetch = async () => ({ ok: false });
  try {
    await audio.prepare(); assert.equal(audio.status, 'error'); assert.equal(audio.sing(), false);
    assert.equal(audio.missing.length, 2);
    globalThis.fetch = async () => ({ ok: true, headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => new ArrayBuffer(4) });
    await audio.prepare(); assert.equal(audio.status, 'ready'); assert.equal(audio.missing.length, 0);
  } finally { globalThis.fetch = original; }
});

test('singing is a bounded mermaid action and requires an available character', () => {
  const plan = planWorld('让人鱼唱歌'); assert.equal(plan.kind, 'sing');
  assert.equal(validateWorldPlan(plan, { actors: ['mermaid'] }).args.species, 'mermaid');
  assert.throws(() => validateWorldPlan(plan, { actors: [] }), /附近/);
  assert.throws(() => validateWorldPlan(worldAction('sing', { species: 'whale' }), { actors: ['whale'] }), /只属于/);
});
