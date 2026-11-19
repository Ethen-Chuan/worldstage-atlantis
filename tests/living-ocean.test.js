import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { keyboardViewport } from '../src/viewport.js';
import { whaleFallStage } from '../src/whale-fall.js';
import { FoodWeb } from '../src/food-web.js';
import { CollisionWorld } from '../src/collision-world.js';
import { createMermaid } from '../src/mermaid.js';
import { starOrbit } from '../src/star-shoal.js';
import { bioluminescentCurrent, playMarkup } from '../src/tide-play.js';

test('keyboard accommodation follows visual viewport without treating pinch zoom as a keyboard', () => {
  assert.deepEqual(keyboardViewport({ height: 844, visualHeight: 480, offsetTop: 40, editing: true }), { keyboard: true, bottom: 324, height: 480 });
  assert.equal(keyboardViewport({ height: 844, visualHeight: 400, scale: 2, editing: true }).keyboard, false);
  assert.equal(keyboardViewport({ height: 844, visualHeight: 480, editing: false }).bottom, 0);
  assert.equal(keyboardViewport({ height: 480, visualHeight: 480, editing: true }).keyboard, false);
});

test('viewpoint select is absent and the light shader has no launches or explosive sphere', () => {
  assert.doesNotMatch(playMarkup(), /<select|盛典|CEREMONY/);
  const light = bioluminescentCurrent();
  assert.doesNotMatch(light.material.vertexShader, /launch|acos|burst|rise \* rise/);
  assert.equal(light.geometry.attributes.position.count, 14000);
  light.geometry.dispose(); light.material.dispose();
});

test('whale fall has bounded phases and no live-call stage after sinking starts', () => {
  assert.equal(whaleFallStage(0).phase, 'memory');
  assert.equal(whaleFallStage(10).phase, 'descent');
  assert.equal(whaleFallStage(38).phase, 'settle');
  assert.equal(whaleFallStage(48).phase, 'succession');
  for (const age of [-1, 76, Infinity, NaN]) assert.equal(whaleFallStage(age).phase, 'idle');
});

test('star lanes are continuous, tilted, distinct and finite throughout long sessions', () => {
  for (const lane of [0, 1, 2]) for (const time of [0, 10, 100, 10000]) {
    const fish = { lane, angle: 1.2, layer: 0.6, depth: 0.2, speed: 0.045 };
    const current = new THREE.Vector3(...starOrbit(time, fish));
    const next = new THREE.Vector3(...starOrbit(time + 1 / 60, fish));
    assert.ok(current.toArray().every(Number.isFinite)); assert.ok(current.distanceTo(next) < 0.2);
  }
  assert.notDeepEqual(starOrbit(10, { lane: 0, angle: 1, layer: 0.5, depth: 0, speed: 0.045 }), starOrbit(10, { lane: 2, angle: 1, layer: 0.5, depth: 0, speed: 0.045 }));
});

test('mermaid flukes stay attached to the deforming tail throughout the swim cycle', () => {
  const mermaid = createMermaid();
  const tail = mermaid.root.getObjectByName('mermaid-tail-body');
  const fins = mermaid.root.getObjectByName('mermaid-tail-fins');
  const vertices = tail.geometry.attributes.position;
  for (const time of [0, 0.7, 2, 4, 6, 12, 50, 1000]) {
    mermaid.animate(time);
    const center = new THREE.Vector3();
    for (let index = vertices.count - 33; index < vertices.count - 1; index++) center.add(new THREE.Vector3().fromBufferAttribute(vertices, index));
    center.divideScalar(32);
    assert.ok(center.distanceTo(fins.position) < 0.005, `Detached flukes at ${time}s`);
  }
  const geometries = new Set(); const materials = new Set();
  mermaid.root.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
});

function foodFixture() {
  const root = new THREE.Group(); const predator = { root };
  const mesh = new THREE.Group();
  const prey = Array.from({ length: 6 }, (_, index) => ({ mesh, index, alive: true, position: new THREE.Vector3(0, 0, 2 + index) }));
  return { web: new FoodWeb(), predator, prey };
}

test('capture consumes actual prey and satiation prevents continuous killing', () => {
  const { web, predator, prey } = foodFixture();
  for (let frame = 0; frame < 1800; frame++) web.update(1 / 60, [predator], prey, null, new THREE.Vector3());
  assert.equal(web.captures, 1); assert.equal(prey.filter(fish => !fish.alive).length, 1);
  assert.equal(web.inspect(prey).predators[0].mode, '饱食休息');
});

test('nearby prey cannot be captured through a solid wall', () => {
  const { web, predator, prey } = foodFixture();
  const camera = new THREE.Vector3();
  web.update(0.01, [predator], [], null, camera);
  web.predators.get(predator.root).hunger = 1;
  const wall = new THREE.Group();
  wall.userData.collisionBoxes = [{ min: [-10, -10, 0.8], max: [10, 10, 1.2] }];
  const collisions = new CollisionWorld({ floor: () => -100 });
  collisions.rebuild([wall]);
  web.update(0.01, [predator], prey, null, camera, collisions);
  assert.equal(web.captures, 0);
  assert.ok(prey.every(fish => fish.alive));
  collisions.rebuild([]);
  web.update(0.01, [predator], prey, null, camera, collisions);
  assert.equal(web.captures, 1);
});

test('failed pursuit remains recovery rather than being relabeled as satiation', () => {
  const { web, predator, prey } = foodFixture();
  const camera = new THREE.Vector3();
  web.update(0.01, [predator], [], null, camera);
  const state = web.predators.get(predator.root);
  prey[0].position.z = 50;
  Object.assign(state, { hunger: 1, target: prey[0], pursuit: 19 });
  web.update(0.01, [predator], prey, null, camera);
  web.update(0.01, [predator], prey, null, camera);
  assert.equal(state.mode, '追捕后恢复');
  assert.equal(web.captures, 0);
});

test('pause and player protection prevent background predation', () => {
  const { web, predator, prey } = foodFixture();
  for (let frame = 0; frame < 3600; frame++) web.update(1 / 60, [predator], prey, { root: prey[0].mesh }, new THREE.Vector3());
  assert.equal(web.captures, 0);
  const before = JSON.stringify(web.inspect(prey)); web.update(0, [predator], prey, null, new THREE.Vector3());
  assert.equal(JSON.stringify(web.inspect(prey)), before);
});

test('visible dead prey never respawn in front of the viewer', () => {
  const { web, prey } = foodFixture(); prey[0].alive = false; prey[0].consumedAt = 0;
  for (let frame = 0; frame < 18000; frame++) web.update(1 / 60, [], prey, null, new THREE.Vector3());
  assert.equal(prey[0].alive, false);
  for (let frame = 0; frame < 3600; frame++) web.update(1 / 60, [], prey, null, new THREE.Vector3(300, 0, 0));
  assert.equal(prey[0].alive, true); assert.equal(web.arrivals, 1);
});
