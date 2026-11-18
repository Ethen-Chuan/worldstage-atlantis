import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCreation, interpretCreation, executeCreation, operation, validateCreationPlan, creationContext } from '../src/creation.js';
import { activeChunks, CHUNK_SIZE, seaHeight, chunkLandmarks } from '../src/terrain.js';
const say = (state, text) => executeCreation(state, interpretCreation(text, state), text);

test('creation, refinement, relationship and partial undo keep object identities', () => {
  const original = initialCreation();
  let result = say(original, '在左侧创造一座巨大的环形神殿');
  assert.equal(result.changed, true); assert.deepEqual(result.issues, []);
  const temple = result.state.selected;
  result = say(result.state, '让它破损一些，裂缝里长出金色的珊瑚');
  assert.deepEqual(result.issues, []); assert.equal(result.state.selected, temple);
  result = say(result.state, '在神殿上方创造一头发光的鲸鱼');
  assert.equal(result.changed, true); assert.deepEqual(result.issues, []);
  const whale = result.state.selected;
  result = say(result.state, '让它绕着神殿游');
  assert.equal(result.state.entities.find(item => item.id === whale).orbit, temple);
  const templeBefore = structuredClone(result.state.entities.find(item => item.id === temple));
  result = say(result.state, '鲸鱼小一点，游慢一点，其他都别变');
  assert.equal(result.state.entities.find(item => item.id === whale).params.scale, 0.8);
  assert.deepEqual(result.state.entities.find(item => item.id === temple), templeBefore);
  result = say(result.state, '只撤销鲸鱼的修改');
  assert.equal(result.state.entities.find(item => item.id === whale).params.scale, 1);
  assert.deepEqual(result.state.entities.find(item => item.id === temple), templeBefore);
  assert.equal(original.entities.length, 4);
});

test('batch color applies to all new creations and undo redo preserves ids', () => {
  let state = say(initialCreation(), '在前方创造三丛金色珊瑚').state;
  assert.equal(state.entities.length, 7); const ids = [...state.lastCreated];
  state = say(state, '让它们变成粉色').state;
  assert.equal(state.entities.filter(item => ids.includes(item.id) && item.params.color === 'rose').length, 3);
  state = say(state, '撤销').state;
  assert.equal(state.entities.filter(item => ids.includes(item.id) && item.params.color === 'gold').length, 3);
  state = say(state, '重做').state;
  assert.deepEqual(state.lastCreated, ids);
});

test('unknown assets and negative commands do not mutate the world', () => {
  const initial = initialCreation();
  for (const text of ['生成宇宙飞船', '不要生成鲸鱼', '鲸鱼不要变大', '创造十头鲸鱼']) {
    const result = say(initial, text); assert.equal(result.changed, false, text); assert.deepEqual(result.state.entities, initial.entities);
  }
});

test('invalid transaction rolls back all changes and unsafe model instructions are rejected', () => {
  const initial = initialCreation();
  const result = executeCreation(initial, { operations: [operation('create', { asset: 'whale', count: 1, placement: 'front' }), operation('orbit', { target: '$new', reference: 'form-999' })], issues: [] });
  assert.equal(result.changed, false); assert.deepEqual(result.state, initial);
  for (const action of [operation('eval'), operation('modify', { property: 'scale', value: NaN }), operation('create', { asset: '__proto__', count: 1, placement: 'front' }), operation('modify', { property: 'color', value: 'javascript:alert(1)' })]) assert.throws(() => validateCreationPlan({ operations: [action], issues: [] }));
});

test('streaming returns exactly 25 tiles at negative, positive and distant coordinates', () => {
  for (const point of [[0, 0], [-1, -1], [10000000, -20000000]]) { const tiles = activeChunks(...point); assert.equal(tiles.length, 25); assert.equal(new Set(tiles.map(tile => tile.key)).size, 25); }
});

test('regenerated tiles are deterministic and their terrain joins exactly', () => {
  assert.deepEqual(chunkLandmarks(15, -31), chunkLandmarks(15, -31));
  assert.notDeepEqual(chunkLandmarks(15, -31), chunkLandmarks(16, -31));
  for (let index = 0; index <= 32; index++) { const leftBorder = seaHeight(3 * CHUNK_SIZE, index / 32 * CHUNK_SIZE); const rightBorder = seaHeight(2 * CHUNK_SIZE + CHUNK_SIZE, index / 32 * CHUNK_SIZE); assert.equal(leftBorder, rightBorder); }
});

test('creations are positioned relative to current viewpoint far beyond the initial city', () => {
  const state = initialCreation(); state.viewpoint = { position: [12000, 30, -14000], forward: [0, 0, -1] };
  const result = say(state, '在前方创造一座神殿');
  assert.equal(result.changed, true); const item = result.state.entities.at(-1); assert.equal(item.position[0], 12000); assert.equal(item.position[2], -14115);
});

test('model context drops arbitrary fields and untrusted color values', () => {
  const state = initialCreation(); state.entities[0].params.color = 'PRIVATE_DATA'; state.privateNote = 'NO';
  const context = creationContext(state); assert.equal(context.entities[0].params.color, 'teal'); assert.equal(Object.hasOwn(context, 'privateNote'), false); assert.equal(Object.hasOwn(context, 'past'), false);
});

test('spatial punctuation and successive new object references are preserved', () => {
  const initial = initialCreation();
  const result = say(initial, '在左侧创造一座神殿，然后在神殿上方，创造一头发光的鲸鱼，然后让它环绕神殿游');
  assert.equal(result.changed, true); assert.deepEqual(result.issues, []);
  assert.equal(result.state.entities.at(-1).orbit, 'form-05');
  assert.equal(result.state.entities.at(-1).position[1], result.state.entities.at(-2).position[1] + 56);
});

test('meaningless edits, missing spatial anchors and mixed creations are not silently accepted', () => {
  for (const text of ['让神殿游慢一点', '让鲸鱼更古老', '让神殿散开', '在这里创造神殿', '创造一头鲸鱼和一艘宇宙飞船']) {
    const result = say(initialCreation(), text); assert.equal(result.changed, false, text); assert.ok(result.issues.length, text);
  }
  const result = say(initialCreation(), '让鲸鱼不发光');
  assert.equal(result.changed, true); assert.equal(result.state.entities.at(-1).params.glow, false);
});

test('typed fields and missing create references are rejected without mutation', () => {
  assert.throws(() => validateCreationPlan({ operations: [operation('pause', { value: {} })], issues: [] }));
  assert.throws(() => validateCreationPlan({ operations: [operation('pause', { asset: 'unknown' })], issues: [] }));
  assert.throws(() => validateCreationPlan({ operations: [], issues: [], arbitrary: true }));
  const result = executeCreation(initialCreation(), { operations: [operation('create', { asset: 'whale', placement: 'above', reference: 'form-999', count: 1 })], issues: [] });
  assert.equal(result.changed, false);
});

test('deleting a reference clears relationships and undo restores the complete world', () => {
  let state = say(initialCreation(), '让鲸鱼围绕神殿游').state;
  const before = structuredClone(state.entities);
  state = say(state, '删除神殿').state;
  assert.equal(state.entities.some(item => item.asset === 'temple'), false);
  assert.equal(state.entities.find(item => item.asset === 'whale').orbit, null);
  state = say(state, '撤销').state;
  assert.deepEqual(state.entities, before);
});

test('repeated object-specific undo walks backward instead of toggling the last undo', () => {
  let state = say(initialCreation(), '鲸鱼小一点').state;
  const scaled = structuredClone(state.entities.at(-1));
  state = say(state, '让它变成金色').state;
  state = say(state, '只撤销鲸鱼修改').state;
  assert.deepEqual(state.entities.at(-1), scaled);
  state = say(state, '只撤销鲸鱼修改').state;
  assert.equal(state.entities.at(-1).params.scale, initialCreation().entities.at(-1).params.scale);
  assert.equal(say(state, '只撤销鲸鱼修改').changed, false);
});
