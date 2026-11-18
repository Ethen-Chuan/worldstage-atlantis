import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { initialCreation, interpretCreation, executeCreation, ASSETS, CREATION_SCHEMA } from '../src/creation.js';
import { CreationScene } from '../src/creation-scene.js';
import { createAncientFish, createTurtle, createNautilus, createMermaid } from '../src/mythic-creatures.js';
import { habitatAnchors, avoidPosition, OceanEcology } from '../src/ecology.js';
import { wonderEnvelope, WonderScene, fanGeometry } from '../src/wonder-scene.js';
import { createJellies } from '../src/creatures.js';
import { LANDMARKS, wonderRequest, ecologyViewRequest } from '../src/landmarks.js';
import { writeMemory, readMemory } from '../src/world-memory.js';
import { EndlessOcean } from '../src/endless-ocean.js';

const say = (state, text) => executeCreation(state, interpretCreation(text, state), text);
const dispose = root => {
  const geometry = new Set(); const materials = new Set();
  root.traverse(object => { if (object.geometry) geometry.add(object.geometry); if (object.material) materials.add(object.material); if (object.isInstancedMesh) object.dispose(); });
  geometry.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
};

test('new living assets create, follow, recolor, undo and survive manual world memory', () => {
  for (const [name, asset] of [['远古巨鱼', 'ancient'], ['海龟', 'turtle'], ['鹦鹉螺', 'nautilus'], ['人鱼', 'mermaid']]) {
    const result = say(initialCreation(), `创造两只${name}，然后让它们跟随我`);
    assert.deepEqual(result.issues, []); assert.equal(result.state.entities.length, 6);
    assert.ok(result.state.entities.slice(-2).every(item => item.asset === asset && item.following));
    assert.ok(CREATION_SCHEMA.properties.operations.items.properties.asset.enum.includes(asset));
    let state = say(result.state, '让它们变成金色').state;
    assert.ok(state.entities.slice(-2).every(item => item.params.color === 'gold'));
    state = say(state, '撤销').state; assert.deepEqual(state.entities, result.state.entities);
    const memory = readMemory(writeMemory(state, { position: [73, 26, 174], target: [0, 30, 0] }, ['palace']));
    assert.deepEqual(memory.state.entities, state.entities);
  }
  assert.equal(Object.keys(ASSETS).length, 14);
  assert.equal(say(initialCreation(), '创造三位美人鱼').state.entities.length, 7);
  assert.equal(say(initialCreation(), '不要创造海龟').changed, false);
});

test('creature geometry remains finite and articulated after animation', () => {
  for (const factory of [createAncientFish, createTurtle, createNautilus, createMermaid]) {
    const creature = factory(); creature.animate(0); creature.root.updateMatrixWorld(true); const before = creature.root.toJSON().object;
    creature.animate(2.4); creature.root.updateMatrixWorld(true); const after = creature.root.toJSON().object;
    assert.notDeepEqual(before, after);
    creature.root.traverse(object => {
      if (!object.isMesh) return;
      assert.ok(object.geometry?.attributes.position);
      assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
      assert.ok(Array.from(object.geometry.attributes.normal.array).every(Number.isFinite));
    });
    const bounds = new THREE.Box3().setFromObject(creature.root); assert.ok(bounds.getSize(new THREE.Vector3()).length() > 3);
    dispose(creature.root);
  }
});

test('new editable creature motion freezes, survives world rebasing and releases', () => {
  for (const name of ['远古巨鱼', '海龟', '鹦鹉螺', '人鱼']) {
    const state = say(initialCreation(), `创造一只${name}，然后让它跟随我`).state;
    state.entities = state.entities.slice(-1);
    const graph = new CreationScene(new THREE.Scene(), {}); graph.sync(state, true);
    const view = { position: new THREE.Vector3(15, 30, -1600), forward: new THREE.Vector3(0, 0, -1) };
    for (let frame = 0; frame < 120; frame++) graph.update(1 / 30, false, view);
    const entry = graph.objects.get(state.selected); const before = entry.root.position.clone();
    graph.paused = true; graph.update(1, false, view); assert.deepEqual(entry.root.position.toArray(), before.toArray());
    graph.offset.set(0, 0, -1680); graph.update(0, false, view); assert.ok(entry.root.position.clone().add(graph.offset).distanceTo(before) < 0.001);
    graph.sync(say(graph.captureFollowing(state), '让它停止跟随').state); graph.update(0, false, view);
    assert.ok(entry.root.position.clone().add(graph.offset).distanceTo(before) < 8);
    graph.sync({ ...state, entities: [] }); dispose(graph.root);
  }
});

test('habitat footprints are deterministic, bounded and continue far from the city', () => {
  for (const position of [[73, 26, 174], [-1300, 20, -3300], [21000, 25, 41000]]) {
    const anchors = habitatAnchors(position);
    assert.deepEqual(anchors, habitatAnchors(position)); assert.ok(anchors.length > 0 && anchors.length <= 10);
    assert.equal(new Set(anchors.map(anchor => anchor.key)).size, anchors.length);
    assert.ok(anchors.every(anchor => anchor.center.every(Number.isFinite)));
  }
});

test('fish avoidance moves close fish away while leaving distant fish unchanged', () => {
  assert.deepEqual(avoidPosition([40, 0, 0], [0, 0, 0], 18), [40, 0, 0]);
  assert.ok(avoidPosition([4, 0, 0], [0, 0, 0], 18)[0] > 4);
  assert.ok(avoidPosition([0, 0, 0], [0, 0, 0], 18).every(Number.isFinite));
});

test('ecology animates, pauses at the same time, and keeps a bounded patch pool', () => {
  const scene = new THREE.Scene(); const ecology = new OceanEcology(scene); const offset = new THREE.Vector3();
  const position = new THREE.Vector3(73, 26, 174);
  ecology.update(position, offset, 1, 0.1); const before = ecology.inspect();
  ecology.update(position, offset, 3, 0.1); const after = ecology.inspect(); assert.notDeepEqual(before.ancient.position, after.ancient.position);
  ecology.update(position, offset, 3, 0); assert.deepEqual(ecology.inspect(), after);
  for (let step = 0; step < 12; step++) {
    position.set(step * 190, 25, -step * 310); ecology.update(position, offset, 4, 0.1);
    assert.ok(ecology.patches.size + ecology.pool.length <= 10);
  }
  offset.set(2160, 0, -3360); ecology.update(position, offset, 4, 0);
  assert.ok(ecology.root.position.distanceTo(new THREE.Vector3(-2160, 0, 3360)) < 0.0001);
  dispose(scene); ecology.templates.forEach(dispose);
});

test('wonder requests and ecology viewpoints never swallow mixed or negative commands', () => {
  const nearby = LANDMARKS.find(landmark => landmark.id === 'vortex');
  assert.deepEqual(wonderRequest('唤醒眼前的奇观', nearby), { id: 'vortex', kind: 'awaken' });
  assert.equal(wonderRequest('不要唤醒星海之眼', nearby), null);
  assert.equal(wonderRequest('唤醒星海之眼，然后删除鲸鱼', nearby), null);
  assert.equal(ecologyViewRequest('前往珊瑚近岸')?.id, 'reef-closeup');
  assert.equal(ecologyViewRequest('前往珊瑚近岸，然后删除鲸鱼'), null);
  assert.equal(ecologyViewRequest('不要前往古鱼巡游'), null);
});

test('wonder effects require proximity and naturally expire without changing creations', () => {
  const wonders = new WonderScene(new THREE.Scene(), {});
  assert.equal(wonders.activate('vortex', new THREE.Vector3()).ok, false);
  assert.equal(wonders.activate('unknown', new THREE.Vector3()).ok, false);
  const nearby = LANDMARKS.find(landmark => landmark.id === 'vortex');
  const entry = { pulseStart: -Infinity }; wonders.entries.set('vortex', entry); wonders.time = 10;
  assert.equal(wonders.activate('vortex', new THREE.Vector3(...nearby.camera)).ok, true); assert.equal(entry.pulseStart, 10);
  assert.equal(wonderEnvelope(-1), 0); assert.equal(wonderEnvelope(0), 0); assert.ok(wonderEnvelope(2) > 0.9); assert.equal(wonderEnvelope(14), 0);
  wonders.activate('vortex', new THREE.Vector3(...nearby.camera), 'calm'); assert.equal(entry.pulseStart, -Infinity);
});

test('terrain cache reuses returned chunks without retaining unbounded active tiles', () => {
  const materials = Object.fromEntries(['stone', 'pale', 'dark', 'gold', 'copper', 'coral', 'coralLight', 'glow', 'rock', 'sand', 'coralPurple'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const scene = new THREE.Scene(); const ocean = new EndlessOcean(scene, materials); const offset = new THREE.Vector3();
  ocean.update(new THREE.Vector3(0, 20, 0), offset, 0, true);
  ocean.update(new THREE.Vector3(480, 20, 0), offset, 0, true);
  ocean.update(new THREE.Vector3(0, 20, 0), offset, 0, true);
  assert.ok(ocean.cacheHits > 0);
  for (let step = 0; step < 10; step++) {
    ocean.update(new THREE.Vector3(step * 480, 20, -step * 240), offset, 0, true);
    assert.ok(ocean.chunks.size <= 25); assert.ok(ocean.cache.size <= 32);
  }
  dispose(scene); for (const tile of ocean.cache.values()) dispose(tile.root);
});

test('coral fans have finite vertex colors and UVs, and jelly groups add no global lights', () => {
  const geometry = fanGeometry(24, '#cb6b92');
  for (const attribute of Object.values(geometry.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite));
  assert.equal(geometry.attributes.uv.count, geometry.attributes.position.count);
  assert.equal(geometry.attributes.color.count, geometry.attributes.position.count);
  geometry.computeBoundingBox(); assert.ok(geometry.boundingBox.max.y > 20); geometry.dispose();
  const jellies = createJellies(); let lights = 0; jellies.root.traverse(object => { if (object.isLight) lights++; });
  assert.equal(lights, 0); jellies.setGlow(true); jellies.animate(1, 0.1); dispose(jellies.root);
});
