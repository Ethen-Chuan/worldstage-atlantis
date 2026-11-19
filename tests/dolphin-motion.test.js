import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dolphinPath, SEA_LEVEL, DOLPHIN_GRAVITY, DOLPHIN_CYCLE, waveHeight, waterCrossing, DolphinPilot } from '../src/dolphin-motion.js';
import { SunsetSea, createDolphin } from '../src/sunset-sea.js';
import { CollisionWorld, actorHull } from '../src/collision-world.js';
import { BreachEffects } from '../src/breach-effects.js';

test('dolphins accelerate below water, follow a ballistic flight, enter head-first and recover underwater', () => {
  const first = dolphinPath(0, 0); const midpoint = first.launch + first.flightDuration / 2;
  assert.equal(first.stage, 'cruise'); assert.ok(first.position[1] < SEA_LEVEL - 8);
  assert.ok(dolphinPath(first.launch + 0.2, 0).pitch > 0.5);
  assert.ok(dolphinPath(first.launch + first.flightDuration - 0.2, 0).pitch < -0.5);
  assert.ok(dolphinPath(midpoint, 0).position[1] > SEA_LEVEL + 7);
  for (let time = first.launch + 0.1; time < first.launch + first.flightDuration - 0.1; time += 0.1) {
    const before = dolphinPath(time - 0.001, 0); const after = dolphinPath(time + 0.001, 0);
    assert.ok(Math.abs((after.velocity[1] - before.velocity[1]) / 0.002 + DOLPHIN_GRAVITY) < 1e-7);
  }
  assert.equal(dolphinPath(first.launch + first.flightDuration + 1, 0).stage, 'recovery');
});

test('position and velocity remain continuous at every stage and loop seam', () => {
  for (let index = 0; index < 9; index++) {
    for (let time = -0.001; time < 95; time += 0.017) {
      const before = dolphinPath(time, index); const after = dolphinPath(time + 0.001, index);
      const velocity = new THREE.Vector3(...after.position).sub(new THREE.Vector3(...before.position)).divideScalar(0.001);
      assert.ok(velocity.length() < 30); assert.ok(velocity.distanceTo(new THREE.Vector3(...before.velocity)) < 0.05);
      assert.ok(before.position.every(Number.isFinite));
    }
    const first = dolphinPath(0, index); const nextCycle = dolphinPath(DOLPHIN_CYCLE, index);
    assert.ok(new THREE.Vector3(...first.position).distanceTo(new THREE.Vector3(...nextCycle.position)) < 1e-8);
  }
});

test('the pod keeps separated lanes, staggered jumps and most animals submerged', () => {
  let mostAirborne = 0; let minimumDistance = Infinity;
  for (let time = 0; time < DOLPHIN_CYCLE; time += 0.1) {
    const animals = Array.from({ length: 9 }, (_, index) => dolphinPath(time, index));
    mostAirborne = Math.max(mostAirborne, animals.filter(animal => animal.position[1] > SEA_LEVEL).length);
    for (let first = 0; first < animals.length; first++) for (let second = first + 1; second < animals.length; second++) {
      minimumDistance = Math.min(minimumDistance, new THREE.Vector3(...animals[first].position).distanceTo(new THREE.Vector3(...animals[second].position)));
    }
  }
  assert.ok(mostAirborne <= 3); assert.ok(minimumDistance > 14);
});

test('the actual collision pipeline preserves leap orientation and trajectory instead of freezing pitch', () => {
  const scene = new THREE.Scene(); const surface = new SunsetSea(scene); surface.prepare();
  const world = new CollisionWorld({ floor: () => -20 }); const offset = new THREE.Vector3();
  const actors = surface.animals.map(animal => ({ root: animal.root, shape: animal.root, species: 'dolphin', motion: 'surface' }));
  let highestPitch = 0; let lowestPitch = 0;
  for (let frame = 0; frame < 720; frame++) {
    const time = frame / 60; surface.update(new THREE.Vector3(48, 198, 130), offset, time, false);
    world.beginBodies(actors, offset);
    for (const actor of actors) world.natural(actor, offset, 1 / 60);
    surface.afterSimulation(time, false);
    const animal = surface.animals[0]; const path = dolphinPath(time, 0);
    assert.ok(animal.root.position.distanceTo(new THREE.Vector3(...path.position)) < 1e-5);
    if (frame) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(animal.root.quaternion);
      assert.ok(forward.dot(new THREE.Vector3(...path.velocity).normalize()) > 0.999);
    }
    highestPitch = Math.max(highestPitch, animal.root.rotation.x); lowestPitch = Math.min(lowestPitch, animal.root.rotation.x);
  }
  assert.ok(highestPitch > 0.6 && lowestPitch < -0.6); assert.equal(world.dynamicContacts, 0); assert.ok(surface.effects.count >= 2);
});

test('surface movement still respects solid obstacles and has a bounded anatomical collision hull', () => {
  const scene = new THREE.Scene(); const dolphin = createDolphin(); scene.add(dolphin.root);
  const wall = new THREE.Group(); wall.userData.collisionBoxes = [{ min: [-30, 170, -10], max: [30, 230, -9] }]; scene.add(wall);
  const world = new CollisionWorld({ floor: () => -20 }); world.rebuild([wall]); const actor = { root: dolphin.root, species: 'dolphin', motion: 'surface' };
  const hull = actorHull(actor); assert.ok(Math.max(...hull.map(probe => probe.radius)) < 1.1);
  for (let frame = 0; frame < 240; frame++) {
    dolphin.root.position.set(0, 195, -frame / 10); world.beginBodies([actor], new THREE.Vector3()); world.natural(actor, new THREE.Vector3(), 1 / 60);
    assert.ok(dolphin.root.position.z > -8); assert.ok(world.penetration(dolphin.root.position, actorHull(actor)) < 0.05);
  }
});

test('splash emission is anchored to the crossed water surface, not to the moving dolphin', () => {
  const before = new THREE.Vector3(0, 195, 0); const after = new THREE.Vector3(1, 187, -1);
  const crossing = waterCrossing(before, after, 1, 1.1); assert.ok(crossing.entering);
  assert.ok(Math.abs(crossing.position.y - waveHeight(crossing.position.x, crossing.position.z, crossing.time)) < 1e-8);
  const effects = new BreachEffects(new THREE.Group()); effects.emit(crossing); effects.update(1.4, false);
  const foam = effects.events[0]; const origin = foam.mesh.position.clone(); after.x += 100; effects.update(1.7, false);
  assert.equal(foam.mesh.position.x, origin.x); assert.equal(foam.mesh.position.z, origin.z);
  effects.update(4, false); assert.equal(foam.mesh.visible, false);
  assert.equal(waterCrossing(before, after, 1, 1), null); assert.equal(waterCrossing(before, after, 1, 20), null);
});

test('reduced motion does not reset the route phase and pause freezes the complete effect state', () => {
  const surface = new SunsetSea(new THREE.Scene()); const observer = new THREE.Vector3(0, 198, 130); const offset = new THREE.Vector3(960, 0, -960);
  surface.update(observer, offset, 6, false); surface.afterSimulation(6, false);
  const position = surface.animals[0].root.position.clone(); const rotation = surface.animals[0].root.quaternion.clone();
  surface.update(observer, offset, 6, true); surface.afterSimulation(6, true);
  assert.deepEqual(surface.animals[0].root.position.toArray(), position.toArray()); assert.deepEqual(surface.animals[0].root.quaternion.toArray(), rotation.toArray());
  assert.deepEqual(surface.root.position.toArray(), offset.clone().negate().toArray());
});

test('a player-driven dolphin must gain speed and surface to leap, then falls without mid-air steering', () => {
  let position = new THREE.Vector3(0, SEA_LEVEL - 8, 0); const pilot = new DolphinPilot(position); const keys = new Set(['forward', 'up']); let enteredAir = false; let enteredWater = false;
  for (let frame = 0; frame < 500; frame++) {
    const before = position.clone();
    const previouslyAirborne = pilot.airborne; const horizontalVelocity = pilot.velocity.x;
    position = pilot.step(position, previouslyAirborne ? 1.5 : 0, keys, 1 / 60, frame / 60);
    assert.ok(position.distanceTo(before) < 0.55, 'entry must not snap down to a submerged depth');
    if (pilot.airborne) { enteredAir = true; keys.clear(); }
    if (previouslyAirborne) assert.equal(pilot.velocity.x, horizontalVelocity);
    if (previouslyAirborne && !pilot.airborne) enteredWater = true;
  }
  assert.ok(enteredAir && enteredWater); assert.ok(position.y < SEA_LEVEL - 5);
  const paused = position.clone(); assert.deepEqual(pilot.step(position, 0, keys, 0, 20).toArray(), paused.toArray());
});

test('holding ascent without enough swimming speed cannot turn a dolphin into a flying camera', () => {
  let position = new THREE.Vector3(0, SEA_LEVEL - 8, 0); const pilot = new DolphinPilot(position);
  for (let frame = 0; frame < 600; frame++) {
    position = pilot.step(position, 0, new Set(['up']), 1 / 60, frame / 60);
    assert.equal(pilot.airborne, false); assert.ok(position.y <= waveHeight(position.x, position.z, frame / 60) + 0.05);
  }
});

test('water renders before foam, droplets sink out of view, and the effects pool stays bounded', () => {
  const surface = new SunsetSea(new THREE.Scene()); assert.equal(surface.water.renderOrder, -20);
  const crossing = { position: new THREE.Vector3(0, 190, 0), time: 1, entering: true, velocity: new THREE.Vector3(0, -12, -14) };
  for (let index = 0; index < 50; index++) surface.effects.emit(crossing);
  assert.equal(surface.effects.events.length, 12); assert.equal(surface.effects.spray.geometry.attributes.position.count, 336);
  assert.match(surface.effects.spray.material.vertexShader, /life\*=smoothstep/);
});
