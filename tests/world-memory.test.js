import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCreation, interpretCreation, executeCreation } from '../src/creation.js';
import { writeMemory, readMemory, MEMORY_LIMIT } from '../src/world-memory.js';
import { LANDMARKS, landmarkRequest, localLandmark, nearestLandmark, withinLandmark } from '../src/landmarks.js';
import { seaHeight } from '../src/terrain.js';

const view = { position: [545, 31, -88], target: [495, 55, -245] };
const record = () => JSON.parse(writeMemory(initialCreation(), view, new Set(['palace', 'gate'])));
const say = (state, text) => executeCreation(state, interpretCreation(text, state), text);

test('manual world memory roundtrips objects, relations, global viewpoint and discoveries', () => {
  let state = say(initialCreation(), '创造一只蝠鲼，然后让它跟随我').state;
  state = say(state, '让它变成金色').state;
  const decoded = readMemory(writeMemory(state, view, new Set(['palace', 'choir'])));
  assert.deepEqual(decoded.state.entities, state.entities);
  assert.deepEqual(decoded.view, view);
  assert.deepEqual(decoded.visited, ['palace', 'choir']);
  assert.equal(decoded.state.paused, true);
  assert.equal(decoded.state.nextId, 6);
  assert.equal(decoded.state.selected, state.selected);
});

test('world memory excludes raw language, histories, consent flags and model configuration', () => {
  const state = say(initialCreation(), '创造一头鲸鱼').state;
  state.privateNote = 'not-for-storage'; state.model = 'not-for-storage';
  const raw = writeMemory(state, view, new Set(['palace']));
  assert.equal(raw.includes('创造一头鲸鱼'), false);
  assert.equal(raw.includes('not-for-storage'), false);
  const restored = readMemory(raw).state;
  assert.deepEqual(restored.past, []); assert.deepEqual(restored.future, []);
  assert.equal(restored.viewpoint, null); assert.equal(restored.anchor, null);
});

test('corrupt, oversized, future-version and unknown memory keys are rejected', () => {
  for (const raw of ['', null, '{broken', ' '.repeat(MEMORY_LIMIT + 1), JSON.stringify({ ...record(), version: 100 }), JSON.stringify({ ...record(), command: 'ignored' }), JSON.stringify({ ...record(), savedAt: 'bad' })]) assert.throws(() => readMemory(raw));
  assert.throws(() => readMemory(JSON.stringify(record()).replace('"version":1', '"__proto__":{},"version":1')));
});

test('invalid identities, material values, coordinates and excessive entity counts are rejected', () => {
  const mutations = [
    value => { value.entities[0].asset = '__proto__'; },
    value => { value.entities[0].id = 'form-99999'; },
    value => { value.entities.push(value.entities[0]); },
    value => { value.entities[0].position[0] = Infinity; },
    value => { value.entities[0].params.scale = -2; },
    value => { value.entities[0].params.color = 'unknown'; },
    value => { value.entities[0].params.glow = 'true'; },
    value => { value.entities[0].params.code = 'not-allowed'; },
    value => { value.view.position[0] = 10000001; },
    value => { value.view.target = [...value.view.position]; },
    value => { value.entities = Array(21).fill(value.entities[0]); },
    value => { value.selected = 'form-99'; },
  ];
  for (const mutate of mutations) { const value = record(); mutate(value); assert.throws(() => readMemory(JSON.stringify(value))); }
});

test('memory rejects dangling, self, cyclic or incompatible behavior relationships', () => {
  for (const mutate of [
    value => { value.entities[3].orbit = 'form-99'; },
    value => { value.entities[3].orbit = 'form-04'; },
    value => { value.entities[0].orbit = 'form-04'; },
    value => { value.entities[3].resonance = 'form-01'; },
    value => { value.entities[0].following = true; },
    value => { value.entities[3].following = true; value.entities[3].orbit = 'form-01'; },
    value => { value.visited.push('unknown'); },
  ]) { const value = record(); mutate(value); assert.throws(() => readMemory(JSON.stringify(value))); }
});

test('an empty authored world can still be remembered without losing its view', () => {
  const state = initialCreation(); state.entities = [];
  const decoded = readMemory(writeMemory(state, view, new Set()));
  assert.equal(decoded.state.entities.length, 0); assert.equal(decoded.state.nextId, 1);
});

test('every authored arrival is inside its own discovery radius', () => {
  for (const landmark of LANDMARKS) {
    assert.equal(localLandmark(landmark.camera)?.id, landmark.id);
    assert.equal(nearestLandmark(landmark.center).id, landmark.id);
    assert.equal(landmarkRequest(`带我去${landmark.name}`)?.id, landmark.id);
  }
  assert.equal(localLandmark([20000, 30, -15000]), null);
  assert.equal(landmarkRequest('创造一个回声天门'), null);
  assert.equal(landmarkRequest('前往回声天门，然后删除鲸鱼'), null);
});

test('authored footprints have continuous foundations and avoid procedural overlap', () => {
  for (const landmark of LANDMARKS.filter(item => item.kind !== 'city')) {
    const [horizontal, , depth] = landmark.center;
    assert.ok(withinLandmark(horizontal, depth));
    assert.ok(Math.abs(seaHeight(horizontal, depth) - seaHeight(horizontal + 45, depth)) < 0.000001);
    assert.ok(Math.abs(seaHeight(horizontal + 125, depth) - seaHeight(horizontal + 125.001, depth)) < 0.01);
  }
});
