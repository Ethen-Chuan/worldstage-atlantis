import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PalaceDistrict, PALACE_CENTER, PALACE_ROOMS } from '../src/palace-district.js';
import { CollisionWorld } from '../src/collision-world.js';
import { planWorld, validateWorldPlan, worldAction } from '../src/world-planner.js';
import { travelGaze } from '../src/travel-gaze.js';
import { coralBloomEnvelope } from '../src/coral-bloom.js';
import { dolphinPath } from '../src/sunset-sea.js';
import { humanGeometry } from '../src/human-detail.js';
import { OceanEcology } from '../src/ecology.js';

test('palace rooms load near the observer, with actual doors and collision-safe connected routes', () => {
  const scene = new THREE.Scene(); const palace = new PalaceDistrict(scene); const offset = new THREE.Vector3();
  assert.equal(palace.ready, undefined); palace.prepare();
  const global = point => new THREE.Vector3(...point).add(new THREE.Vector3(PALACE_CENTER[0], palace.base, PALACE_CENTER[2]));
  const entry = global([0, 7, 80]); palace.update(entry, offset);
  assert.ok(palace.rooms.size < PALACE_ROOMS.length);
  for (const room of PALACE_ROOMS) palace.update(global(room.view), offset);
  for (const room of palace.rooms.values()) room.visible = true;
  assert.equal(palace.rooms.size, PALACE_ROOMS.length);
  const collision = new CollisionWorld({ floor: () => palace.base - 12 }); collision.rebuild([palace.root]);
  const locations = [entry, ...PALACE_ROOMS.map(room => global(room.view))];
  for (const origin of locations) for (const destination of [...PALACE_ROOMS.map(room => room.id), 'exit']) {
    const route = palace.route(origin, destination); assert.ok(route, destination); let position = origin.clone();
    for (const waypoint of route.points) {
      const goal = new THREE.Vector3(...waypoint); const begin = position.clone(); const steps = Math.max(1, Math.ceil(begin.distanceTo(goal)));
      for (let index = 1; index <= steps; index++) {
        const desired = begin.clone().lerp(goal, index / steps); position = collision.move(position, desired, { radius: 2, dynamic: false });
        assert.ok(position.distanceTo(desired) < 0.01, `${destination}: ${position.toArray()} / ${desired.toArray()}`);
      }
    }
    if (destination !== 'exit') assert.equal(palace.roomAt(position)?.id, destination);
  }
  const wall = global([30, 8, 54]); assert.ok(collision.penetration(wall, [{ radius: 1, offset }]) > 0.9);
  assert.equal(palace.route(global([0, 8, -180]), 'reception'), null);
});

test('room commands are validated and never interpreted as arbitrary actions', () => {
  const position = [-610, 0, 600];
  for (const command of ['进入城堡', '去客厅', '前往宴会厅', '去寝宫', '去会所', '去花园', '进入潮汐内花园', '去餐厅', '前往珊瑚餐厅', '退出宫殿']) {
    const plan = planWorld(command); assert.equal(plan.kind, 'palace-room'); assert.ok(validateWorldPlan(plan, { position }));
  }
  assert.throws(() => validateWorldPlan(worldAction('palace-room', { room: '../secret' }), { position }));
  assert.throws(() => validateWorldPlan(planWorld('进入城堡'), { position: [0, 0, 0] }));
  assert.equal(planWorld('不要进入城堡'), null);
});

test('the center of a doorway marker is clickable, not only its thin rim', () => {
  const palace = new PalaceDistrict(new THREE.Scene()); palace.prepare(); palace.root.visible = true; palace.root.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 6, 100), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(palace.root, true)[0]; assert.ok(hit); assert.equal(hit.object.userData.palaceDestination, 'reception');
});

test('ambient creatures are not spawned in palace rooms or the visitor corridor', () => {
  const ecology = new OceanEcology(new THREE.Scene());
  for (const time of [0.1, 10, 50, 110]) {
    ecology.update(new THREE.Vector3(-610, 0, 440), new THREE.Vector3(), time, 0.016);
    for (const animal of ecology.animals.filter(animal => animal.root.visible)) assert.ok(Math.abs(animal.root.position.x - PALACE_CENTER[0]) > 110);
  }
});

test('travel gaze follows the route in transit and settles on the destination', () => {
  const origin = new THREE.Vector3(0, 10, 0); const position = new THREE.Vector3(50, 10, 0); const tangent = new THREE.Vector3(1, 0, 0);
  const startLook = new THREE.Vector3(0, 10, -30); const finalLook = new THREE.Vector3(100, 10, -20);
  const look = travelGaze(position, tangent, startLook, finalLook, 0.5, origin);
  assert.ok(look.sub(position).normalize().dot(tangent) > 0.999);
  assert.ok(travelGaze(position, tangent, startLook, finalLook, 1, origin).distanceTo(finalLook) < 1e-8);
});

test('coral has a bounded charge, fast attack and a finite fade', () => {
  assert.equal(coralBloomEnvelope(-1), 0); assert.equal(coralBloomEnvelope(Infinity), 0);
  assert.ok(coralBloomEnvelope(2.58) > coralBloomEnvelope(2.4) * 4);
  assert.ok(coralBloomEnvelope(10) < 0.08); assert.equal(coralBloomEnvelope(14), 0);
});

test('dolphins have continuous looping routes and staggered breaches', () => {
  for (let index = 0; index < 9; index++) {
    let previous = dolphinPath(-0.001, index);
    for (let frame = 0; frame <= 2400; frame++) {
      const next = dolphinPath(frame / 100, index);
      assert.ok(next.position.every(Number.isFinite));
      assert.ok(new THREE.Vector3(...previous.position).distanceTo(new THREE.Vector3(...next.position)) < 0.3);
      previous = next;
    }
  }
  assert.notDeepEqual(dolphinPath(7, 0).position, dolphinPath(7, 2).position);
});

test('anatomical head and hand geometry is bounded, finite and mirrored with consistent winding', () => {
  for (const name of ['head', 'hand', 'irisL', 'scleraR']) {
    const geometry = humanGeometry(name); assert.ok(geometry.attributes.position.count < 15000);
    for (const value of geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    for (const index of geometry.index.array) assert.ok(index >= 0 && index < geometry.attributes.position.count);
    const mirrored = humanGeometry(name, true);
    assert.equal(mirrored.index.array[0], geometry.index.array[2]); geometry.dispose(); mirrored.dispose();
  }
});
