import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { initialCreation, interpretCreation, executeCreation, ASSETS } from '../src/creation.js';
import { CreationScene } from '../src/creation-scene.js';
import { createWhale } from '../src/creatures.js';
import { StoneWorkshop } from '../src/sculptures.js';
const say = (state, text) => executeCreation(state, interpretCreation(text, state), text);

test('manta and celestial gate are distinct supported creations', () => {
  assert.equal(Object.keys(ASSETS).length, 14);
  let result = say(initialCreation(), '在前方创造一座星门');
  assert.equal(result.changed, true); assert.equal(result.state.entities.at(-1).asset, 'gate');
  result = say(result.state, '创造一只蝠鲼，然后让它环绕星门游');
  assert.deepEqual(result.issues, []); assert.equal(result.state.entities.at(-1).asset, 'manta');
  assert.equal(result.state.entities.at(-1).orbit, 'form-05');
});

test('follow, release, orbit and undo preserve a companion identity', () => {
  let state = say(initialCreation(), '创造一只蝠鲼，然后让它跟随我').state;
  const identity = state.selected;
  assert.equal(state.entities.at(-1).following, true);
  state = say(state, '让它环绕神殿游').state;
  assert.equal(state.entities.at(-1).following, false); assert.equal(state.entities.at(-1).orbit, 'form-01');
  state = say(state, '让它跟着我').state;
  assert.equal(state.entities.at(-1).orbit, null);
  state = say(state, '别跟着我').state;
  assert.equal(state.entities.at(-1).following, false);
  state = say(state, '撤销').state;
  assert.equal(state.entities.at(-1).following, true); assert.equal(state.entities.at(-1).id, identity);
});

test('stationary scenery cannot follow and negative instructions do not create companions', () => {
  for (const text of ['让神殿跟随我', '让鲸鱼不要跟随我']) {
    const state = initialCreation(); const result = say(state, text);
    assert.equal(result.changed, false); assert.deepEqual(result.state, state);
  }
});

test('whale body faces outward rather than rendering as a hollow inside-out mesh', () => {
  const whale = createWhale();
  const body = whale.root.children.find(part => part.geometry?.attributes.color)?.geometry;
  let outward = 0;
  for (let index = 0; index < body.attributes.position.count; index++) {
    const position = body.attributes.position; const normal = body.attributes.normal;
    if (position.getX(index) * normal.getX(index) + position.getY(index) * normal.getY(index) > 0) outward++;
  }
  assert.ok(outward / body.attributes.position.count > 0.99);
  whale.root.traverse(part => { part.geometry?.dispose(); part.material?.dispose(); });
});

test('intact column shafts meet their capitals instead of leaving a floating gap', () => {
  const materials = Object.fromEntries(['stone', 'pale', 'gold'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const shop = new StoneWorkshop(materials);
  shop.column(0, 0, 0, 90, 3);
  const shaft = shop.parts.get('pale')[2]; shaft.computeBoundingBox();
  assert.ok(Math.abs(shaft.boundingBox.max.y - 88.75) < 0.001);
  const finished = shop.finish('column-test');
  finished.traverse(part => part.geometry?.dispose()); Object.values(materials).forEach(material => material.dispose());
});

test('rendered companions move, pause, survive rebasing and release where they are', () => {
  const state = say(initialCreation(), '创造一只蝠鲼，然后让它跟随我').state;
  state.entities = state.entities.filter(item => item.asset === 'manta');
  const graph = new CreationScene(new THREE.Scene(), {}); graph.sync(state, true);
  const viewpoint = { position: new THREE.Vector3(900, 32, -1700), forward: new THREE.Vector3(0, 0, -1) };
  for (let frame = 0; frame < 120; frame++) graph.update(1 / 30, false, viewpoint);
  const entry = graph.objects.get(state.selected);
  assert.ok(entry.root.position.distanceTo(viewpoint.position) < 170);
  const before = entry.root.position.clone(); graph.paused = true; graph.update(1, false, viewpoint);
  assert.deepEqual(entry.root.position.toArray(), before.toArray());
  graph.offset.set(960, 0, -1680); graph.update(0, false, viewpoint);
  assert.ok(entry.root.position.clone().add(graph.offset).distanceTo(before) < 0.001);
  const captured = graph.captureFollowing(state);
  assert.ok(captured.entities[0].position[0] > 500);
  const released = say(captured, '让它停止跟随').state;
  graph.sync(released); graph.update(0, false, viewpoint);
  assert.ok(entry.root.position.clone().add(graph.offset).distanceTo(before) < 8);
  assert.equal(released.entities[0].following, false);
  graph.sync({ ...released, entities: [] });
});
