import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { habitatRoute, schoolTarget, SCHOOL_LANES } from '../src/habitat-motion.js';
import { SchoolMotion } from '../src/school-motion.js';
import { CollisionWorld, actorHull } from '../src/collision-world.js';
import { initialCreation } from '../src/creation.js';

test('large ambient animals occupy separate outer and upper routes, without shrinking the whale', () => {
  const whale = initialCreation().entities.find(entity => entity.asset === 'whale');
  assert.equal(whale.params.scale, 1.5); assert.ok(whale.position[1] > 90);
  for (let time = 0; time < 300; time += 0.5) {
    const ancient = habitatRoute('ancient', 0, time, [0, 0, 0]);
    const mermaid = habitatRoute('mermaid', 0, time, [0, 0, 0]);
    assert.ok(ancient.position[0] < -70 && ancient.position[1] > 100);
    assert.ok(new THREE.Vector3(...ancient.position).distanceTo(new THREE.Vector3(...mermaid.position)) > 45);
    for (const species of ['ancient', 'mermaid', 'turtle', 'shark', 'nautilus']) {
      const route = habitatRoute(species, 0, time, [0, 0, 0]);
      const next = habitatRoute(species, 0, time + 0.001, [0, 0, 0]);
      const velocity = new THREE.Vector3(...next.position).sub(new THREE.Vector3(...route.position)).setY(0).normalize();
      const forward = new THREE.Vector3(-Math.sin(route.heading), 0, -Math.cos(route.heading));
      assert.ok(forward.dot(velocity) > 0.9999, `${species} must face its actual route`);
    }
  }
});

test('ancient fish and turtles use articulated clearances instead of oversized enclosing spheres', () => {
  for (const species of ['ancient', 'turtle', 'nautilus']) {
    const root = new THREE.Group(); root.scale.setScalar(1.85);
    const hull = actorHull({ root, species });
    assert.ok(hull.length >= 3);
    assert.ok(Math.max(...hull.map(probe => probe.radius)) < 9);
    if (species === 'ancient') {
      assert.ok(hull.some(probe => Math.abs(probe.offset.x) > 18));
      assert.ok(hull.some(probe => Math.abs(probe.offset.y) > 12 && probe.offset.z > 28));
    }
  }
});

test('school routes are deterministic, layered and leave the central arrival view open', () => {
  for (const habitat of ['city', 'reef']) {
    assert.equal(SCHOOL_LANES[habitat].length, 6);
    for (let group = 0; group < 6; group++) for (let time = 0; time < 180; time += 3) {
      const fish = { group, phase: 1.7, radius: 14, height: 2 };
      const first = schoolTarget(fish, time, habitat, [0, 0, 0], new THREE.Vector3());
      const second = schoolTarget(fish, time, habitat, [960, 0, -960], new THREE.Vector3());
      assert.ok(second.sub(new THREE.Vector3(960, 0, -960)).distanceTo(first) < 1e-8);
      assert.ok(first.toArray().every(Number.isFinite));
      if (first.z > 30 && first.z < 150) assert.ok(Math.abs(first.x) > 25);
    }
  }
});

test('school steering limits acceleration, follows actual motion and freezes when paused', () => {
  const motion = new SchoolMotion(); const fish = { size: 0.5, phase: 1, alive: true };
  const target = new THREE.Vector3(0, 10, 0); motion.advance(fish, target, 0, null);
  target.set(80, 10, 0);
  let previousSpeed = 0;
  for (let frame = 0; frame < 240; frame++) {
    motion.begin([fish]); const before = fish.position.clone();
    motion.advance(fish, target, 1 / 60, null);
    const speed = fish.velocity.length();
    assert.ok(speed <= 5.5 + 1e-8);
    assert.ok(Math.abs(speed - previousSpeed) <= 7 / 60 + 1e-8);
    assert.ok(fish.position.distanceTo(before) <= 5.5 / 60 + 1e-8);
    previousSpeed = speed;
  }
  assert.ok(Math.abs(fish.heading + Math.PI / 2) < 0.001);
  const position = fish.position.clone(); motion.advance(fish, new THREE.Vector3(-200, 50, 0), 0, null);
  assert.deepEqual(fish.position.toArray(), position.toArray());
});

test('local school spacing separates neighbors without an all-pairs scan or positional teleport', () => {
  const motion = new SchoolMotion();
  const members = [0, 1].map(index => ({ size: 0.6, phase: index * Math.PI, alive: true, position: new THREE.Vector3(index * 0.3, 10, 0), velocity: new THREE.Vector3(), heading: 0 }));
  for (let frame = 0; frame < 120; frame++) {
    motion.begin(members);
    for (const fish of members) motion.advance(fish, new THREE.Vector3(0, 10, 0), 1 / 60, null);
  }
  assert.ok(members[0].position.distanceTo(members[1].position) > 1);
  assert.ok(motion.cells.size <= 2);
});

test('twenty-hertz schooling simulation interpolates positions on every rendered frame and pauses exactly', () => {
  const motion = new SchoolMotion(); const fish = { size: 0.5, phase: 0, alive: true };
  motion.advance(fish, new THREE.Vector3(0, 10, 0), 0, null);
  let previous = fish.position.clone(); let visibleChanges = 0; let simulationTicks = 0;
  for (let frame = 0; frame < 120; frame++) {
    motion.begin([fish], 1 / 60);
    if (motion.step) simulationTicks++;
    const rendered = motion.advance(fish, new THREE.Vector3(30, 10, 0), 1 / 60, null);
    if (rendered.distanceToSquared(previous) > 1e-10) visibleChanges++;
    assert.ok(rendered.distanceTo(previous) < 0.1);
    previous.copy(rendered);
  }
  assert.equal(simulationTicks, 40);
  assert.ok(visibleChanges > 110);
  motion.begin([fish], 0);
  assert.deepEqual(motion.advance(fish, new THREE.Vector3(-200, 30, 0), 0, null).toArray(), previous.toArray());
});

test('school motion cannot cross a thin obstacle or a large creature', () => {
  const motion = new SchoolMotion(); const world = new CollisionWorld({ floor: () => -100 });
  const wall = new THREE.Group(); wall.userData.collisionBoxes = [{ min: [-1, -20, -20], max: [1, 30, 20] }]; world.rebuild([wall]);
  const fish = { size: 0.6, phase: 0, position: new THREE.Vector3(-8, 10, 0), velocity: new THREE.Vector3(), heading: -Math.PI / 2 };
  for (let frame = 0; frame < 360; frame++) { motion.begin([fish]); motion.advance(fish, new THREE.Vector3(8, 10, 0), 1 / 60, world); assert.ok(fish.position.x < -1.5); }
  world.rebuild([]);
  world.bodies.set(wall, { position: new THREE.Vector3(0, 10, 0), extent: 6, hull: [{ offset: new THREE.Vector3(), radius: 6 }] });
  fish.position.set(-12, 10, 0); fish.velocity.set(0, 0, 0);
  for (let frame = 0; frame < 360; frame++) { motion.begin([fish]); motion.advance(fish, new THREE.Vector3(12, 10, 0), 1 / 60, world); assert.ok(fish.position.distanceTo(new THREE.Vector3(0, 10, 0)) >= 6.59); }
});

test('natural actors anticipate approaching neighbors before contact and ignore distant actors', () => {
  const world = new CollisionWorld({ floor: () => -100 });
  const scene = new THREE.Group(); const actors = [];
  for (const horizontal of [-8, 8]) {
    const root = new THREE.Group(); root.userData.collisionProfile = [[0, 0, 0, 2]]; root.position.set(horizontal, 10, 0); scene.add(root); actors.push({ root, species: 'fish' });
  }
  world.beginBodies(actors, new THREE.Vector3());
  const first = world.bodies.get(actors[0].root); const second = world.bodies.get(actors[1].root);
  second.velocity.set(-5, 0, 0);
  assert.ok(world.anticipate(first, new THREE.Vector3(5, 0, 0)).length() > 0);
  assert.equal(world.dynamicContacts, 0);
  second.position.x = 150;
  assert.equal(world.anticipate(first, new THREE.Vector3(5, 0, 0)).length(), 0);
});

test('natural acceleration and turning stay bounded despite a scripted destination reversal', () => {
  const world = new CollisionWorld({ floor: () => -100 }); const scene = new THREE.Group(); const root = new THREE.Group(); scene.add(root);
  root.userData.collisionProfile = [[0, 0, 0, 1]]; root.position.set(0, 10, 0);
  const actor = { root, species: 'fish' }; const offset = new THREE.Vector3();
  world.beginBodies([actor], offset); world.natural(actor, offset, 1 / 60);
  let previousPosition = root.position.clone(); let previousHeading = root.rotation.y; let previousVelocity = new THREE.Vector3();
  for (let frame = 0; frame < 240; frame++) {
    root.position.set(frame < 120 ? 30 : -30, 10, 0); root.rotation.y = frame < 120 ? Math.PI : -Math.PI;
    world.beginBodies([actor], offset); world.natural(actor, offset, 1 / 60);
    const velocity = root.position.clone().sub(previousPosition).multiplyScalar(60);
    assert.ok(velocity.length() <= 5.001);
    assert.ok(velocity.distanceTo(previousVelocity) <= 9 / 60 + 0.001);
    assert.ok(Math.abs(root.rotation.y - previousHeading) <= 1.6 / 60 + 0.001);
    previousPosition.copy(root.position); previousVelocity.copy(velocity); previousHeading = root.rotation.y;
  }
});

test('slow drifting creatures do not alternate between stopping and catching up at sub-centimeter steps', () => {
  const world = new CollisionWorld({ floor: () => -100 }); const scene = new THREE.Group(); const root = new THREE.Group(); scene.add(root);
  root.userData.collisionProfile = [[0, 0, 0, 1]]; root.position.set(0, 10, 0);
  const actor = { root, species: 'fish' }; const offset = new THREE.Vector3();
  world.beginBodies([actor], offset); world.natural(actor, offset, 1 / 60);
  let previous = root.position.clone();
  for (let frame = 1; frame <= 240; frame++) {
    root.position.set(frame * 0.15 / 60, 10, 0);
    world.beginBodies([actor], offset); world.natural(actor, offset, 1 / 60);
    if (frame > 60) assert.ok(Math.abs(root.position.distanceTo(previous) * 60 - 0.15) < 0.001);
    previous.copy(root.position);
  }
});
