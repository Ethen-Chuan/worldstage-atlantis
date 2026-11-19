import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PalaceDistrict, PALACE_CENTER, PALACE_ROOMS } from '../src/palace-district.js';
import { CollisionWorld } from '../src/collision-world.js';
import { planWorld } from '../src/world-planner.js';

function fixture() {
  const palace = new PalaceDistrict(new THREE.Scene()); palace.prepare();
  const global = local => new THREE.Vector3(...local).add(new THREE.Vector3(PALACE_CENTER[0], palace.base, PALACE_CENTER[2]));
  for (const room of PALACE_ROOMS) palace.update(global(room.view), new THREE.Vector3());
  const collision = new CollisionWorld({ floor: () => palace.base - 12 }); collision.rebuild([palace.root]);
  return { palace, global, collision };
}

test('garden and restaurant are independent furnished rooms, not renamed banquet or outdoor whale garden', () => {
  const { palace, global } = fixture();
  assert.equal(PALACE_ROOMS.length, 7);
  for (const id of ['banquet', 'conservatory', 'dining']) assert.ok(palace.rooms.has(id));
  const names = id => palace.rooms.get(id).children.flatMap(mesh => mesh.userData.instanceNames || []);
  assert.ok(names('conservatory').includes('随海流摆动的有根海草'));
  assert.ok(names('conservatory').includes('内花园实体种植池'));
  assert.equal(names('dining').filter(name => name === '珊瑚餐厅独立圆桌').length, 3);
  assert.equal(names('dining').filter(name => name === '水晶高脚杯').length, 6);
  assert.ok(names('dining').includes('备餐台叠放贝瓷碟'));
  assert.equal(palace.roomAt(global([-18, 8, -135])).id, 'conservatory');
  assert.equal(palace.roomAt(global([18, 8, -135])).id, 'dining');
  assert.equal(palace.roomAt(global([0, 8, -150])).id, 'gallery');
  assert.equal(palace.roomAt(global([18, 8, -167])), null);
  assert.equal(planWorld('去花园').args.room, 'conservatory');
  assert.equal(planWorld('去餐厅').args.room, 'dining');
  assert.equal(planWorld('去鲸落花园').args.site, 'garden');
  assert.equal(planWorld('不要去餐厅'), null);
  assert.equal(planWorld('去花园并执行脚本'), null);
});

test('rear corridor and both new door centers are open and immediately pickable', () => {
  const { palace, global, collision } = fixture();
  let previous = global([0, 7, -96]);
  for (let depth = -97; depth >= -154; depth--) {
    const desired = global([0, 7, depth]);
    const actual = collision.move(previous, desired, { radius: 2, dynamic: false });
    assert.ok(actual.distanceTo(desired) < 0.01); previous = actual;
  }
  palace.root.updateWorldMatrix(true, true);
  for (const [side, id] of [[-1, 'conservatory'], [1, 'dining']]) {
    const ray = new THREE.Raycaster(global([0, 6, -135]), new THREE.Vector3(side, 0, 0), 0, 12);
    assert.equal(ray.intersectObject(palace.root, true)[0]?.object.userData.palaceDestination, id);
  }
});

test('flowerbeds, tables, back walls, glazing and floor stay solid even when details are culled', () => {
  const { palace, global, collision } = fixture();
  for (const local of [[-44, 1, -137], [35, 4.1, -121], [0, 8, -162], [-35.5, 29.45, -135], [18, -0.1, -145]]) {
    assert.ok(collision.penetration(global(local), [{ radius: 1, offset: new THREE.Vector3() }]) > 0.5, local.join(','));
  }
  for (const root of palace.rooms.values()) root.visible = false;
  collision.rebuild([palace.root]);
  assert.ok(collision.penetration(global([-44, 1, -137]), [{ radius: 1, offset: new THREE.Vector3() }]) > 0.9);
});

test('living-space geometry remains bounded, finite and shares a pause-safe rooted sway clock', () => {
  const { palace, global } = fixture();
  for (const id of ['conservatory', 'dining']) {
    const root = palace.rooms.get(id);
    const triangles = root.children.reduce((sum, mesh) => sum + (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * mesh.count, 0);
    assert.ok(root.children.length <= 45, id); assert.ok(triangles < 240000, `${id}: ${triangles}`);
    for (const mesh of root.children) {
      for (const value of mesh.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
      for (const value of mesh.instanceMatrix.array) assert.ok(Number.isFinite(value));
    }
  }
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>' };
  palace.materials.seagrass.onBeforeCompile(shader);
  assert.equal(shader.uniforms.gardenTime, palace.tideClock);
  assert.match(shader.vertexShader, /position.y\*position.y/);
  assert.doesNotMatch(shader.vertexShader, /modelMatrix/);
  const previous = palace.tideClock.value;
  palace.update(global([-18, 8, -135]), new THREE.Vector3(), 0.05, null, true);
  palace.update(global([-18, 8, -135]), new THREE.Vector3(), 0);
  assert.equal(palace.tideClock.value, previous);
});

test('garden and restaurant remain discoverable through hall doors after rebasing', () => {
  const { palace, global } = fixture();
  const position = global([0, 8, -135]);
  palace.update(position, new THREE.Vector3());
  for (const id of ['conservatory', 'dining']) assert.equal(palace.rooms.get(id).visible, true);
  const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 1000);
  const offset = new THREE.Vector3(-480, 0, 480);
  camera.position.copy(global([-18, 8, -124])).sub(offset);
  camera.lookAt(global([-43, 6, -138]).sub(offset));
  palace.update(global([-18, 8, -124]), offset, 1 / 60, camera);
  assert.equal(palace.rooms.get('conservatory').visible, true);
  assert.equal(palace.rooms.get('dining').visible, false);
  assert.equal(palace.exterior.visible, true);
});
