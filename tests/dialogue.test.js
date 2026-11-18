import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, interpretUtterance, executeUtterance, arriveAt, interruptJourney, validatePlan } from '../src/dialogue.js';
import { EVENTS, EXAMPLES } from '../src/world.js';

const say = (state, text) => executeUtterance(state, interpretUtterance(text, state));

test('one utterance composes creature distance, speed, destination and preserved light', () => {
  const result = say(initialState(), '让鲸鱼远一点，慢慢带我去海沟，但保持明亮');
  assert.deepEqual(result.effects.map(action => action.kind), ['distance', 'speed', 'guide', 'day']);
  assert.equal(result.state.selected, 'whale');
  assert.equal(result.state.distances.whale, 1.38);
  assert.equal(result.state.speed, 0.55);
  assert.equal(result.state.destination, 'trench');
  assert.equal(result.state.location, 'threshold');
  assert.equal(result.state.mood, 'day');
  assert.deepEqual(result.issues, []);
});

test('relative follow-up keeps the current creature, travel and lighting', () => {
  const start = say(initialState(), '让鲸鱼远一点，慢慢带我去海沟，但保持明亮').state;
  const next = say(start, '它再近一点，快一点').state;
  assert.equal(next.selected, 'whale');
  assert.equal(next.distances.whale, 1.16);
  assert.equal(next.distances.manta, 1);
  assert.equal(next.destination, 'trench');
  assert.equal(next.mood, 'day');
  assert.equal(next.speed, 1.65);
});

test('deferred events execute on arrival, not when travel is requested', () => {
  const result = say(initialState(), '澜，慢慢带我去珊瑚浅海，到达后让珊瑚绽放');
  assert.equal(result.state.events.coral, undefined);
  assert.equal(result.state.pending.length, 1);
  const arrival = arriveAt(result.state, 'reef');
  assert.equal(arrival.state.events.coral, true);
  assert.equal(arrival.state.pending.length, 0);
  assert.equal(arrival.state.location, 'reef');
  assert.deepEqual(arrival.state.history, ['threshold']);
});

test('travel and event in the same clause are ordered safely', () => {
  const result = say(initialState(), '去海沟寻找沉船');
  assert.equal(result.issues.length, 0);
  assert.equal(result.state.pending[0].event, 'wreck');
  assert.equal(result.state.destination, 'trench');
});

test('global stop cancels queued operations but preserves prior world state', () => {
  const start = say(initialState(), '用鲸歌唤醒潮汐之环').state;
  const journey = say(start, '去花园，到达后点亮小径').state;
  const stopped = say(journey, '等等，别去花园了').state;
  assert.equal(stopped.destination, null);
  assert.deepEqual(stopped.pending, []);
  assert.equal(stopped.events.crown, true);
  const interrupted = interruptJourney(journey);
  assert.equal(interrupted.pending.length, 0);
  assert.equal(interrupted.events.crown, true);
});

test('negative clauses do not accidentally trigger positive actions', () => {
  assert.equal(say(initialState(), '不要唱歌').effects[0].kind, 'stop');
  assert.equal(say(initialState(), '不要发光').state.glow, false);
  assert.equal(say(initialState(), '不要变暗').state.mood, 'day');
  assert.equal(say(initialState(), '不要去海沟，去花园').state.destination, 'garden');
});

test('previous destination is contextual instead of always returning to the entrance', () => {
  let state = arriveAt(initialState(), 'reef').state;
  state = arriveAt(state, 'garden').state;
  assert.equal(say(state, '回刚才那里').state.destination, 'reef');
  assert.equal(say(initialState(), '回刚才那里').effects.length, 0);
});

test('resume uses the interrupted destination without replaying cancelled events', () => {
  let state = say(initialState(), '带我去神殿，到达后唱歌').state;
  state = say(state, '停一下').state;
  state = say(state, '继续带路').state;
  assert.equal(state.destination, 'sanctuary');
  assert.deepEqual(state.pending, []);
});

test('cross-region entry still allows resuming the interrupted camera journey', () => {
  let state = say(initialState(), '带我去海沟').state;
  state = { ...state, location: 'trench' };
  state = say(state, '停一下').state;
  assert.equal(say(state, '继续带路').state.destination, 'trench');
});

test('an invalid back request does not cancel existing deferred events', () => {
  const state = say(initialState(), '去神殿，到达后唱歌').state;
  const result = say(state, '回刚才那里');
  assert.equal(result.effects.length, 0);
  assert.equal(result.state.pending.length, 1);
  assert.equal(result.state.destination, 'sanctuary');
});

test('unknown portions remain visible and are not claimed as executed', () => {
  const result = say(initialState(), '让鲸鱼靠近一点，然后变成潜水艇');
  assert.equal(result.effects.length, 1);
  assert.equal(result.effects[0].kind, 'distance');
  assert.match(result.issues.join(''), /变成潜水艇/);
  assert.equal(say(initialState(), '为我编写排序算法').effects.length, 0);
});

test('events are region-specific and existing events survive revisits', () => {
  assert.equal(say(initialState(), '用声呐寻找沉船').effects.length, 0);
  let state = arriveAt(initialState(), 'trench').state;
  state = say(state, '用声呐寻找沉船').state;
  state = arriveAt(state, 'reef').state;
  assert.equal(state.events.wreck, true);
  state = say(state, '让珊瑚绽放').state;
  state = say(state, '让珊瑚收拢').state;
  assert.equal(state.events.coral, false);
  assert.equal(state.events.wreck, true);
});

test('all surfaced examples and event phrases resolve without unknown fragments', () => {
  for (const examples of Object.values(EXAMPLES)) for (const example of examples) assert.deepEqual(interpretUtterance(example.text).issues, [], example.text);
  for (const event of Object.values(EVENTS)) assert.deepEqual(interpretUtterance(event.command).issues, [], event.command);
});

test('light color and movement target are independent', () => {
  const result = say(initialState(), '让水母靠近一点，发光，变成粉色');
  assert.equal(result.state.jellyColor, 'rose');
  assert.equal(result.state.glow, true);
  assert.equal(result.state.distances.jelly, 0.78);
  assert.deepEqual(result.issues, []);
  const garden = arriveAt(initialState(), 'garden').state;
  const singingJellies = say(garden, '让水母同步发光').state;
  assert.equal(say(singingJellies, '再近一点').state.selected, 'jelly');
});

test('distance limits, bounded memory and immutable prior state', () => {
  const start = initialState();
  let state = start;
  for (let index = 0; index < 30; index++) state = say(state, '鲸鱼再近一点，唱歌').state;
  assert.equal(state.distances.whale, 0.55);
  assert.equal(state.memories.length, 12);
  assert.equal(start.distances.whale, 1);
  assert.equal(start.memories.length, 0);
});

test('model validator rejects code, unknown objects, malformed data and unsafe parameters', () => {
  const valid = interpretUtterance('让鲸鱼远一点，慢慢带我去海沟，但保持明亮');
  assert.equal(validatePlan({ operations: valid.operations, issues: [] }).operations.length, 4);
  const operation = { kind: 'distance', creature: 'whale', destination: null, event: null, value: 0.38, afterArrival: false };
  for (const patch of [{ kind: 'eval' }, { creature: '__proto__' }, { value: 999 }, { value: NaN }, { value: '0.3' }, { code: 'alert(1)' }, { afterArrival: 'false' }]) assert.throws(() => validatePlan({ operations: [{ ...operation, ...patch }], issues: [] }));
  assert.throws(() => validatePlan({ operations: [{ ...operation, kind: 'guide', destination: '__proto__' }], issues: [] }));
  assert.throws(() => validatePlan({ operations: [{ ...operation, kind: 'event', event: 'crown', value: 'yes' }], issues: [] }));
  assert.throws(() => validatePlan({ operations: Array(13).fill(operation), issues: [] }));
});
