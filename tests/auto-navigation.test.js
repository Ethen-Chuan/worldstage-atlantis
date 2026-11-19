import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld } from '../src/collision-world.js';
import { AutoNavigation, PassagePlanner, clearPassage, movingObstacleAhead } from '../src/auto-navigation.js';
import { PalaceDistrict, PALACE_CENTER, PALACE_ROOMS } from '../src/palace-district.js';
import { Ocean } from '../src/ocean.js';

const vector = values => new THREE.Vector3(...values);
function worldWith(boxes = [], floor = () => -20) {
  const root = new THREE.Group(); root.userData.collisionBoxes = boxes.map(([min, max]) => ({ min, max }));
  const world = new CollisionWorld({ floor }); world.rebuild([root]); return { world, root };
}
function solve(world, start, finish, options) {
  const planner = new PassagePlanner(world, vector(start), vector(finish), options);
  for (let step = 0; step < 300 && planner.status === 'planning'; step++) planner.step(128, Infinity);
  return planner;
}
function sail(world, start, finish, options = {}) {
  const navigation = new AutoNavigation(world); let position = vector(start); navigation.start(position, vector(finish), options);
  let largestStep = 0; const statuses = new Set();
  for (let frame = 0; frame < 15000; frame++) {
    const next = navigation.step(1 / 60, position); largestStep = Math.max(largestStep, next.distanceTo(position));
    assert.ok(clearPassage(world, position, next, { radius: 2.01 }), `unsafe movement ${position.toArray()} -> ${next.toArray()}`);
    position = next; statuses.add(navigation.status);
    if (['arrived', 'blocked'].includes(navigation.status)) break;
  }
  return { navigation, position, largestStep, statuses };
}

test('unobstructed travel uses a direct route and arrives by distance, not an elapsed timer', () => {
  const { world } = worldWith(); const planner = solve(world, [0, 10, 0], [100, 10, 0]);
  assert.equal(planner.status, 'ready'); assert.equal(planner.points.length, 2);
  const result = sail(world, [0, 10, 0], [100, 10, 0]);
  assert.equal(result.navigation.status, 'arrived'); assert.ok(result.position.distanceTo(vector([100, 10, 0])) < 0.05);
  assert.ok(result.largestStep <= 48 / 60 + 1e-6);
});

test('a wall produces a collision-safe detour, including the rounded corners', () => {
  const { world } = worldWith([[[28, -20, -15], [42, 70, 15]]]);
  assert.equal(clearPassage(world, vector([0, 10, 0]), vector([80, 10, 0])), false);
  const route = solve(world, [0, 10, 0], [80, 10, 0]); assert.equal(route.status, 'ready');
  assert.ok(route.points.some(point => Math.abs(point.z) > 17));
  for (let index = 1; index < route.points.length; index++) assert.ok(clearPassage(world, route.points[index - 1], route.points[index]));
  const result = sail(world, [0, 10, 0], [80, 10, 0]); assert.equal(result.navigation.status, 'arrived');
  assert.ok(result.navigation.detour); assert.equal(result.navigation.replans, 1);
});

test('terrain clearance applies to the entire route, not only its endpoints', () => {
  const { world } = worldWith([], horizontal => horizontal > 20 && horizontal < 55 ? 18 : -20);
  const route = solve(world, [0, 10, 0], [80, 10, 0]); assert.equal(route.status, 'ready');
  assert.ok(route.points.some(point => point.y >= 23));
  for (let index = 1; index < route.points.length; index++) assert.ok(clearPassage(world, route.points[index - 1], route.points[index]));
});

test('a narrow doorway is followed at room height instead of passing through a wall or roof', () => {
  const { world } = worldWith([[[20, -20, -35], [24, 30, -5]], [[20, -20, 5], [24, 30, 35]]]);
  const result = sail(world, [0, 7, -12], [45, 7, 12], { indoor: true });
  assert.equal(result.navigation.status, 'arrived'); assert.ok(Math.abs(result.position.y - 7) < 0.01);
});

test('unreachable and embedded destinations fail in bounded work without fake arrival', () => {
  const { world } = worldWith([[[15, -20, -10], [25, 30, 10]]]);
  const result = sail(world, [0, 10, 0], [20, 10, 0]);
  assert.equal(result.navigation.status, 'blocked'); assert.deepEqual(result.position.toArray(), [0, 10, 0]);
  const planner = solve(world, [0, 10, 0], [60, 10, 0], { maxNodes: 1 });
  assert.equal(planner.status, 'blocked'); assert.ok(planner.expanded <= 1);
});

test('pause freezes planning, acceleration and position; cancellation discards the destination route', () => {
  const { world } = worldWith(); const navigation = new AutoNavigation(world); const position = vector([0, 10, 0]);
  navigation.start(position, vector([100, 10, 0]));
  const before = navigation.inspect(position); assert.deepEqual(navigation.step(0, position), position); assert.deepEqual(navigation.inspect(position), before);
  navigation.cancel(); assert.equal(navigation.status, 'cancelled');
  assert.deepEqual(navigation.step(1, position), position); assert.equal(navigation.points.length, 0);
});

test('arrival brakes gently across frame rates and zero-length palace segments complete immediately', () => {
  for (const delta of [1 / 60, 1 / 30, 0.1]) {
    const { world } = worldWith(); const navigation = new AutoNavigation(world); let position = vector([0, 10, 0]); let previousSpeed = 0;
    navigation.start(position, vector([200, 10, 0]));
    for (let frame = 0; frame < 3000 && navigation.status !== 'arrived'; frame++) {
      previousSpeed = navigation.speed; position = navigation.step(delta, position);
    }
    assert.equal(navigation.status, 'arrived'); assert.ok(previousSpeed < 0.2, `final speed ${previousSpeed}`);
    navigation.start(position, position); navigation.step(delta, position); assert.equal(navigation.status, 'arrived');
  }
});

test('intermediate corridor waypoints retain a slow continuous pace instead of docking at every door', () => {
  const { world } = worldWith(); const result = sail(world, [0, 10, 0], [40, 10, 0], { indoor: true, through: true });
  assert.equal(result.navigation.status, 'arrived'); assert.ok(result.navigation.speed > 1); assert.ok(result.navigation.speed <= 4);
  result.navigation.start(result.position, vector([80, 10, 0]), { indoor: true, speed: result.navigation.speed });
  assert.ok(result.navigation.speed > 1);
});

test('an occupied destination waits, resumes after clearance, and does not wait forever', () => {
  for (const clears of [true, false]) {
    const { world } = worldWith(); world.bodies.set({}, { position: vector([40, 10, 0]), velocity: new THREE.Vector3(), hull: [{ offset: new THREE.Vector3(), radius: 8 }], extent: 8 });
    const navigation = new AutoNavigation(world); let position = vector([0, 10, 0]); navigation.start(position, vector([40, 10, 0]));
    const statuses = new Set();
    for (let frame = 0; frame < 4000 && !['arrived', 'blocked'].includes(navigation.status); frame++) {
      if (clears && frame === 600) world.bodies.clear();
      position = navigation.step(1 / 60, position); statuses.add(navigation.status);
    }
    assert.ok(statuses.has('waiting')); assert.equal(navigation.status, clears ? 'arrived' : 'blocked');
    if (!clears) assert.ok(position.distanceTo(vector([40, 10, 0])) > 10);
  }
});

test('predictive avoidance detects a crossing swimmer and ignores receding marine life', () => {
  const { world } = worldWith(); const body = { position: vector([20, 10, 10]), velocity: vector([0, 0, -10]), hull: [{ offset: new THREE.Vector3(), radius: 3 }], extent: 3 };
  world.bodies.set({}, body);
  assert.equal(movingObstacleAhead(world, vector([0, 10, 0]), vector([40, 10, 0]), 2), true);
  body.velocity.z = 10;
  assert.equal(movingObstacleAhead(world, vector([0, 10, 0]), vector([40, 10, 0]), 2), false);
});

test('a resting animal is routed around without removing its physical body', () => {
  const { world } = worldWith(); world.bodies.set({}, { position: vector([28, 10, 0]), velocity: new THREE.Vector3(), hull: [{ offset: new THREE.Vector3(), radius: 5 }], extent: 5 });
  const result = sail(world, [0, 10, 0], [90, 10, 0]);
  assert.equal(result.navigation.status, 'arrived'); assert.ok(result.statuses.has('avoiding'));
  assert.ok(result.navigation.replans >= 2); assert.equal(world.bodies.size, 1);
  assert.equal(world.dynamicContacts, 0);
});

test('newly streamed obstacles trigger replanning without losing the chosen destination', () => {
  const { world, root } = worldWith(); const navigation = new AutoNavigation(world); let position = vector([0, 10, 0]);
  navigation.start(position, vector([160, 10, 0]));
  for (let frame = 0; frame < 40; frame++) position = navigation.step(1 / 60, position);
  root.userData.collisionBoxes = [{ min: [45, -20, -18], max: [60, 70, 18] }]; world.rebuild([root]);
  for (let frame = 0; frame < 6000 && navigation.status !== 'arrived'; frame++) {
    const next = navigation.step(1 / 60, position); assert.ok(clearPassage(world, position, next, { radius: 2.01 })); position = next;
  }
  assert.equal(navigation.status, 'arrived'); assert.ok(navigation.replans >= 2); assert.ok(position.distanceTo(vector([160, 10, 0])) < 0.05);
});

test('navigation remains translation invariant across a floating world origin', () => {
  const offset = vector([1440, 0, -2160]); const { world } = worldWith([[[28, -20, -15], [42, 70, 15]]]);
  const original = solve(world, [0, 10, 0], [80, 10, 0]);
  const shifted = worldWith([[[28, -20, -15], [42, 70, 15]].map(point => vector(point).add(offset).toArray())]).world;
  const route = solve(shifted, vector([0, 10, 0]).add(offset).toArray(), vector([80, 10, 0]).add(offset).toArray());
  assert.equal(route.status, 'ready'); assert.equal(route.points.length, original.points.length);
  route.points.forEach((point, index) => assert.ok(point.sub(offset).distanceTo(original.points[index]) < 1e-8));
});

test('real palace routes still enter through the gates and reach the garden and dining room', () => {
  const palace = new PalaceDistrict(new THREE.Scene()); palace.prepare(); const offset = new THREE.Vector3();
  const global = point => vector(point).add(vector([PALACE_CENTER[0], palace.base, PALACE_CENTER[2]]));
  for (const room of PALACE_ROOMS) palace.update(global(room.view), offset);
  for (const room of palace.rooms.values()) room.visible = true;
  const world = new CollisionWorld({ floor: () => palace.base - 12 }); world.rebuild([palace.root]);
  let position = global([0, 7, 80]);
  for (const destination of ['conservatory', 'dining', 'exit']) {
    const route = palace.route(position, destination); assert.ok(route);
    for (const waypoint of route.points) {
      const result = sail(world, position.toArray(), waypoint, { indoor: true });
      assert.equal(result.navigation.status, 'arrived', `${destination} ${position.toArray()} -> ${waypoint}`); position = result.position;
    }
    if (destination !== 'exit') assert.equal(palace.roomAt(position)?.id, destination);
  }
});

test('sailing from inside the palace preserves the destination and first uses the real exit corridor', () => {
  const palace = new PalaceDistrict(new THREE.Scene()); palace.prepare();
  const position = vector(PALACE_ROOMS.find(room => room.id === 'dining').view).add(vector([PALACE_CENTER[0], palace.base, PALACE_CENTER[2]]));
  const ocean = Object.create(Ocean.prototype); let direct = false; let corridor = false;
  Object.assign(ocean, { palace, navigator: { cancel() {} }, navigationVelocity: new THREE.Vector3(), worldPosition: () => position, embodiment: { exit() {} }, play: { stop() {} }, advancePalaceRoute: () => { corridor = true; }, travelTo: () => { direct = true; } });
  const destination = [545, 31, -88]; ocean.sailTo(destination, [495, 55, -245]);
  assert.equal(direct, false); assert.equal(corridor, true); assert.deepEqual(ocean.travelAfterPalace.point, destination);
  assert.deepEqual(ocean.palaceRoute.points.at(-1), [PALACE_CENTER[0], palace.base + 7, PALACE_CENTER[2] + 80]);
  ocean.cancelTravel(); assert.equal(ocean.travelAfterPalace, null); assert.equal(ocean.palaceRoute, null);
});
