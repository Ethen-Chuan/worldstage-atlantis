import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORES, composeScore, orchestralMix, scaleNote, scoreFor } from '../src/orchestra-score.js';
import { SceneTap } from '../src/scene-tap.js';
import { OceanSound } from '../src/sound.js';

test('seven complete original scores have distinct melodies and layered orchestration', () => {
  const identities = new Set();
  for (const site of Object.keys(SCORES)) {
    const score = composeScore(site); identities.add(JSON.stringify(score.melody));
    assert.equal(score.beats, 64); assert.ok(score.tempo >= 56 && score.tempo <= 72);
    assert.ok(score.events.length > 220);
    assert.deepEqual(new Set(score.events.map(event => event.layer)), new Set(['foundation', 'melody', 'brass', 'percussion']));
    for (const event of score.events) {
      assert.ok(event.beat >= 0 && event.beat < score.beats);
      assert.ok(event.midi >= 24 && event.midi <= 100);
      assert.ok(event.gain > 0 && event.gain < 0.5);
    }
  }
  assert.equal(identities.size, 7);
});

test('music stays melodic at rest and blossoms at the visual climax', () => {
  const rest = orchestralMix(0); const peak = orchestralMix(1);
  assert.ok(rest.melody > 0.8); assert.ok(peak.brass > rest.brass * 3); assert.ok(peak.percussion > rest.percussion * 6);
  assert.ok(orchestralMix(0, true).percussion > rest.percussion);
  assert.deepEqual(orchestralMix(NaN), rest); assert.deepEqual(orchestralMix(-1), rest); assert.deepEqual(orchestralMix(9), peak);
  assert.equal(scoreFor('open-sea'), SCORES.palace); assert.equal(scaleNote(SCORES.palace, -7), SCORES.palace.root - 12);
});

function pointer(overrides = {}) { return { pointerId: 1, button: 0, isPrimary: true, clientX: 100, clientY: 100, timeStamp: 10, ...overrides }; }
test('only a short primary tap enters a viewpoint', () => {
  const tap = new SceneTap(); tap.down(pointer()); assert.equal(tap.up(pointer({ timeStamp: 100 })), true);
  assert.equal(tap.up(pointer({ timeStamp: 101 })), false);
  tap.down(pointer({ button: 2 })); assert.equal(tap.up(pointer({ timeStamp: 100 })), false);
  tap.down(pointer()); assert.equal(tap.up(pointer({ timeStamp: 1200 })), false);
});
test('dragging back to its origin, cancellation and multi-touch cannot become a click', () => {
  const tap = new SceneTap(); tap.down(pointer()); tap.move(pointer({ clientX: 120 })); tap.move(pointer()); assert.equal(tap.up(pointer({ timeStamp: 100 })), false);
  tap.down(pointer()); tap.cancel(pointer()); assert.equal(tap.up(pointer()), false);
  tap.down(pointer()); tap.down(pointer({ pointerId: 2, isPrimary: false })); assert.equal(tap.up(pointer({ pointerId: 2 })), false); assert.equal(tap.up(pointer()), false);
  tap.down(pointer()); assert.equal(tap.up(pointer({ timeStamp: 100 })), true);
});

test('manual mute prevents later gestures from re-enabling sound', async () => {
  const sound = new OceanSound(); sound.enabled = true; sound.context = { currentTime: 0, state: 'running' };
  let mutedGain = null; sound.master = { gain: { setTargetAtTime(value) { mutedGain = value; } } };
  await sound.toggle(); assert.equal(sound.userMuted, true); assert.equal(mutedGain, 0);
  assert.equal(await sound.activateFromGesture(), false); assert.equal(sound.enabled, false);
});

test('visual pause keeps accompaniment alive instead of suspending all audio', () => {
  const sound = new OceanSound(); const gains = []; let pausedOrchestration = false;
  sound.context = { currentTime: 0, suspend() { assert.fail('visual pause must not suspend audio'); } };
  sound.musicGain = { gain: { setTargetAtTime(value) { gains.push(value); } } };
  sound.orchestra = { setIntensity(_value, _trial, paused) { pausedOrchestration = paused; } };
  sound.setPaused(true); assert.equal(pausedOrchestration, true); assert.equal(gains[0], 0.52);
  sound.setPaused(false); assert.equal(gains.at(-1), 0.8);
});

test('audio mix controls are bounded and do not force playback', () => {
  const sound = new OceanSound(); sound.setLevel('music', 1.5); sound.setLevel('effects', -1); sound.setLevel('ambience', NaN); sound.setLevel('unknown', 1);
  assert.deepEqual(sound.levels, { music: 1, ambience: 0.22, effects: 0 }); assert.equal(sound.context, null); assert.equal(sound.enabled, false);
});
