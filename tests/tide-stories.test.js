import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STORY_ENTRIES, STORY_SOURCES, TIDE_READINGS, initialStoryState, restoreStoryState, advanceStory, storyObjective, storyForObject } from '../src/tide-stories.js';
import { planWorld, validateWorldPlan, worldAction } from '../src/world-planner.js';
import { PalaceDistrict, PALACE_CENTER } from '../src/palace-district.js';

test('the invitation has a complete ordered route, persistent consequences and replay-safe choices', () => {
  let state = initialStoryState();
  const origin = structuredClone(state);
  const route = [['inscription', 'accept', 'reception', 'accepted'], ['garden-keeper', 'care', 'conservatory', 'garden'], ['dining-host', 'welcome', 'dining', 'table'], ['inscription', 'finish', 'reception', 'ending']];
  for (const [entry, choice, room, flag] of route) {
    const result = advanceStory(state, entry, choice, { palaceRoom: room }); state = result.state;
    assert.ok(state.flags.includes(flag)); assert.ok(result.effect);
    const replay = advanceStory(state, entry, choice, { palaceRoom: room }); assert.deepEqual(replay.state, state);
  }
  assert.equal(state.flags.length, 4); assert.equal(state.choices.length, 4);
  assert.match(storyObjective(state).label, /已完成/);
  assert.deepEqual(origin, initialStoryState());
});

test('a reader cannot change remote rooms, skip prerequisites or issue unknown choices', () => {
  const state = initialStoryState();
  assert.throws(() => advanceStory(state, 'garden-keeper', 'care', { palaceRoom: 'conservatory' }), /前一|尚未/);
  assert.throws(() => advanceStory(state, 'inscription', 'accept', { palaceRoom: 'dining' }), /抵达/);
  assert.throws(() => advanceStory(state, 'mermaid-memory', 'song', { actors: [] }), /游远/);
  assert.throws(() => advanceStory(state, 'inscription', '__proto__', { palaceRoom: 'reception' }), /没有这个/);
  assert.throws(() => advanceStory(state, 'arbitrary-script', null), /没有这条/);
  assert.deepEqual(advanceStory(state, 'inscription', null).state.discovered, []);
  assert.deepEqual(advanceStory(state, 'inscription', null, { palaceRoom: 'reception' }).state.discovered, ['inscription']);
});

test('saves use a bounded whitelist, drop prose and reject incompatible data', () => {
  assert.throws(() => restoreStoryState({ version: 7 }));
  const restored = restoreStoryState({ version: 1, discovered: ['inscription', 'inscription', '<script>'], flags: ['ending', 'garden'], choices: ['inscription:accept', 'eval:script'], input: 'must not survive', apiKey: 'not a real key' });
  assert.deepEqual(restored.discovered, ['inscription']); assert.deepEqual(restored.flags, []);
  assert.deepEqual(restored.choices, ['inscription:accept']); assert.equal(restored.input, undefined); assert.equal(restored.apiKey, undefined);
});

test('world planning validates the same story actions used by scene controls', () => {
  for (const command of ['打开潮汐手记', '阅读历史札记', '阅读铭文', '接受邀约', '与守园人对话']) {
    const plan = planWorld(command); assert.equal(plan.kind, 'story');
    assert.ok(validateWorldPlan(plan, { palaceRoom: 'reception', story: initialStoryState() }));
  }
  assert.equal(planWorld('不要接受邀约'), null);
  assert.equal(planWorld('toString'), null); assert.equal(planWorld('__proto__'), null);
  for (const args of [{ entry: 'journal', choice: 'accept' }, { entry: 'inscription', choice: '' }, { entry: 'inscription', effect: 'shell' }, { entry: '../private' }]) {
    assert.throws(() => validateWorldPlan(worldAction('story', args), { palaceRoom: 'reception' }));
  }
});

test('entries bind actual objects or species and every reading has primary-source attribution', () => {
  assert.equal(storyForObject({ name: '潮汐邀约铭文' }, 'reception').id, 'inscription');
  assert.equal(storyForObject({ name: '内花园实体种植池' }, 'conservatory').id, 'garden-keeper');
  assert.equal(storyForObject({ name: '水晶高脚杯' }, 'dining').id, 'dining-host');
  assert.equal(storyForObject({ name: '水晶高脚杯' }, 'banquet').id, 'banquet-memory');
  assert.equal(storyForObject({ living: true, species: 'mermaid' }).id, 'mermaid-memory');
  assert.equal(storyForObject({ name: 'unrelated mesh' }), null);
  assert.ok(STORY_ENTRIES.every(entry => entry.choices.length >= 2));
  assert.equal(TIDE_READINGS.length, 6);
  for (const entry of STORY_ENTRIES) for (const id of entry.lore) assert.ok(TIDE_READINGS.some(reading => reading.id === id));
  for (const reading of TIDE_READINGS) {
    assert.equal(reading.paragraphs.length, 3); assert.ok(reading.category);
    assert.equal(new URL(STORY_SOURCES[reading.source].url).hostname, 'classics.mit.edu');
  }
});

test('story props are real named geometry and feedback eases in without ignoring pause', () => {
  const palace = new PalaceDistrict(new THREE.Scene()); palace.prepare();
  const global = point => new THREE.Vector3(...point).add(new THREE.Vector3(PALACE_CENTER[0], palace.base, PALACE_CENTER[2]));
  for (const [room, point, name] of [['reception', [0, 8, 43], '潮汐邀约铭文'], ['conservatory', [-18, 8, -124], '守园人的留声贝'], ['dining', [18, 8, -124], '侍宴者的留名贝']]) {
    palace.update(global(point), new THREE.Vector3());
    assert.ok(palace.rooms.get(room).children.some(mesh => mesh.userData.instanceNames.includes(name)));
  }
  palace.setStoryState({ flags: ['accepted', 'garden', 'table', 'ending'] });
  const before = palace.materials.gardenGlow.emissiveIntensity;
  palace.update(global([-18, 8, -124]), new THREE.Vector3(), 0);
  assert.equal(palace.materials.gardenGlow.emissiveIntensity, before);
  palace.update(global([-18, 8, -124]), new THREE.Vector3(), 1 / 60);
  assert.ok(palace.materials.gardenGlow.emissiveIntensity > before);
  assert.ok(palace.materials.gardenGlow.emissiveIntensity < 1.65);
  for (let frame = 0; frame < 300; frame++) palace.update(global([-18, 8, -124]), new THREE.Vector3(), 1 / 60);
  assert.ok(palace.materials.guestGlow.emissiveIntensity > 1.69);
  assert.ok(palace.materials.invitationGlow.emissiveIntensity > 1.99);
});
