import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, resolveIntent, respond, readMemory, seededRandom } from '../src/core.js';

test('names route invitations to the correct marine creature', () => {
  assert.deepEqual(resolveIntent('澜，靠近一点', 'whale'), { creature: 'manta', text: '澜，靠近一点', kind: 'approach' });
  assert.equal(resolveIntent('溯，游到我身边').creature, 'whale');
  assert.equal(resolveIntent('让水母亮起来').creature, 'jelly');
});

test('guidance resolves destinations before general creature keywords', () => {
  assert.equal(resolveIntent('带我去神殿').destination, 'sanctuary');
  assert.equal(resolveIntent('带我去水母花园').destination, 'garden');
  assert.equal(resolveIntent('回到入口').kind, 'return');
});

test('stop and negative requests override movement', () => {
  assert.equal(resolveIntent('等等，别去神殿了').kind, 'stop');
  assert.equal(resolveIntent('不要靠近我').kind, 'stop');
  assert.equal(resolveIntent('不要带我去神殿').kind, 'stop');
  assert.equal(resolveIntent('不要唱了').kind, 'stop');
  assert.equal(resolveIntent('不要发光').kind, 'glow-off');
});

test('unknown language is not claimed as understood or applied', () => {
  const start = initialState();
  const response = respond(start, resolveIntent('请帮我编写一个排序算法'));
  assert.equal(response.effect, '');
  assert.match(response.line, /不支持任意对话/);
  assert.equal(response.state.intent, 'idle');
  assert.equal(response.state.met.length, 0);
  assert.equal(resolveIntent('   ').kind, 'empty');
});

test('responses preserve earlier world changes', () => {
  const glowing = respond(initialState(), resolveIntent('让水母亮起来')).state;
  const night = respond(glowing, resolveIntent('暗一点', 'jelly')).state;
  const guide = respond(night, resolveIntent('澜，带我去神殿')).state;
  assert.equal(guide.glow, true);
  assert.equal(guide.mood, 'night');
  assert.equal(guide.location, 'sanctuary');
  assert.equal(guide.memories.length, 2);
  const stopped = respond(guide, resolveIntent('等等')).state;
  assert.equal(stopped.intent, 'stop');
  assert.equal(stopped.glow, true);
  assert.equal(stopped.mood, 'night');
});

test('memory changes later dialogue and remains bounded', () => {
  let state = initialState();
  const first = respond(state, resolveIntent('澜，靠近一点'));
  const again = respond(first.state, resolveIntent('澜，靠近一点'));
  assert.notEqual(first.line, again.line);
  assert.match(again.line, /认出/);
  for (let index = 0; index < 25; index++) state = respond(state, resolveIntent('唱一首鲸歌')).state;
  assert.equal(state.memories.length, 12);
  assert.match(respond(state, resolveIntent('你记得刚才吗')).line, /鲸歌/);
});

test('stored memory is validated and never restores arbitrary app state', () => {
  assert.equal(readMemory('not-json'), null);
  assert.equal(readMemory('{"version":2}'), null);
  assert.deepEqual(readMemory(JSON.stringify({ version: 1, met: ['manta', 'invalid', 'manta', '__proto__'], memories: ['相遇', 88], script: 'ignored' })), { met: ['manta'], memories: ['相遇'] });
  assert.equal(readMemory(JSON.stringify({ version: 1, met: [], memories: ['a'.repeat(500)] })).memories[0].length, 100);
});

test('procedural scene random sequence is deterministic', () => {
  const first = seededRandom(77);
  const second = seededRandom(77);
  for (let index = 0; index < 50; index++) assert.equal(first(), second());
});

test('pure state transition does not mutate prior encounters', () => {
  const start = initialState();
  respond(start, resolveIntent('让水母亮起来'));
  assert.equal(start.glow, false);
  assert.deepEqual(start.met, []);
  assert.deepEqual(start.memories, []);
});
