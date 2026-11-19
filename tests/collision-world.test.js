import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld, actorHull, separateSphere } from '../src/collision-world.js';

function fixture(boxes = [{ min: [-1, -20, -30], max: [1, 60, 30] }]) {
  const root = new THREE.Group(); root.userData.collisionBoxes = boxes;
  const world = new CollisionWorld({ floor: () => -100 }); world.rebuild([root]);
  return { world, root };
}

test('swept movement cannot cross a thin wall even at high speed', () => {
  const { world } = fixture();
  const result = world.move(new THREE.Vector3(-30, 10, 0), new THREE.Vector3(60, 10, 0), { radius: 2 });
  assert.ok(result.x <= -3 && result.x > -3.2);
  const slide = world.move(result, result.clone().add(new THREE.Vector3(20, 0, 20)), { radius: 2 });
  assert.ok(slide.x <= -3 && slide.z > 19);
});

test('individual columns leave a real doorway, not one solid building bounding box', () => {
  const { world } = fixture([{ min: [-8, -10, -1], max: [-4, 30, 1] }, { min: [4, -10, -1], max: [8, 30, 1] }]);
  const result = world.move(new THREE.Vector3(0, 5, 10), new THREE.Vector3(0, 5, -10), { radius: 1 });
  assert.ok(result.z < -9.9);
});

test('sphere inside an obstacle is resolved with a finite deterministic normal', () => {
  const box = new THREE.Box3(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2));
  const correction = separateSphere(new THREE.Vector3(), 1, box);
  assert.ok(correction.toArray().every(Number.isFinite)); assert.ok(correction.length() > 3);
});

test('whale hull includes its long body, flukes and pectoral fins at authored scale', () => {
  const root = new THREE.Group(); root.scale.setScalar(2);
  const shape = new THREE.Group(); shape.scale.setScalar(1.35); root.add(shape);
  const hull = actorHull({ root, shape, species: 'whale' });
  assert.ok(Math.max(...hull.map(probe => probe.offset.x + probe.radius)) > 35);
  assert.ok(Math.max(...hull.map(probe => probe.offset.z + probe.radius)) > 60);
  const { world } = fixture();
  const start = new THREE.Vector3(-80, 20, 0);
  const result = world.move(start, new THREE.Vector3(15, 20, 0), { hull });
  assert.ok(world.penetration(result, hull) < 0.05); assert.ok(result.x < -35);
});

test('moving into another creature is blocked and self collision is ignored', () => {
  const { world } = fixture([]); const scene = new THREE.Group();
  const root = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial()); scene.add(root);
  root.position.set(0, 10, 0); const actor = { root, species: 'fish' };
  world.beginBodies([actor], new THREE.Vector3());
  const result = world.move(new THREE.Vector3(-20, 10, 0), new THREE.Vector3(20, 10, 0), { radius: 2 });
  assert.ok(result.x < -4 || Math.abs(result.z) > 5);
  for (const probe of actorHull(actor)) assert.ok(result.distanceTo(root.position.clone().add(probe.offset)) >= probe.radius + 2);
  assert.ok(world.dynamicContacts > 0);
  const self = world.move(root.position, root.position.clone().add(new THREE.Vector3(2, 0, 0)), { ignore: root });
  assert.equal(self.x, 2);
});

test('world origin rebasing preserves collisions and does not rebuild unchanged geometry', () => {
  const { world, root } = fixture(); const count = world.rebuilds;
  world.rebuild([root]); assert.equal(world.rebuilds, count);
  root.position.x = -960; world.rebuild([root], new THREE.Vector3(960, 0, 0));
  assert.equal(world.rebuilds, count);
  assert.ok(world.move(new THREE.Vector3(-10, 5, 0), new THREE.Vector3(10, 5, 0)).x < -2.9);
  root.visible = false; world.rebuild([root]); assert.equal(world.entries.length, 0);
});

test('floor clearance applies to fins and tail, not just the root point', () => {
  const world = new CollisionWorld({ floor: () => 0 });
  const hull = [{ offset: new THREE.Vector3(0, -6, 5), radius: 2 }];
  const result = world.move(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -10, 0), { hull });
  assert.ok(result.y >= 8);
});

test('small schooling fish clear a large body rather than moving through it', () => {
  const { world } = fixture([]); const root = new THREE.Group();
  world.bodies.set(root, { position: new THREE.Vector3(0, 10, 0), extent: 8, hull: [{ offset: new THREE.Vector3(), radius: 8 }] });
  for (const point of [new THREE.Vector3(0, 10, 0), new THREE.Vector3(3, 10, 1)]) {
    const safe = world.avoidSmall(point, 0.7);
    assert.ok(safe.toArray().every(Number.isFinite)); assert.ok(safe.distanceTo(new THREE.Vector3(0, 10, 0)) >= 9.29);
  }
});

test('paused natural actors do not move and overlapping initial spawns recover above solid structures', () => {
  const { world } = fixture(); const scene = new THREE.Group(); const root = new THREE.Group(); scene.add(root);
  root.position.set(0, 10, 0); const actor = { root, species: 'mermaid' };
  world.beginBodies([actor], new THREE.Vector3()); world.natural(actor, new THREE.Vector3(), 0);
  assert.equal(root.position.y, 10);
  world.natural(actor, new THREE.Vector3(), 1 / 60);
  assert.ok(world.penetration(root.position, actorHull(actor)) < 0.05);
});
