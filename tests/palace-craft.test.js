import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PalaceWorkshop, palaceMaterials } from '../src/palace-craft.js';
import { PalaceDistrict, PALACE_CENTER, PALACE_ROOMS } from '../src/palace-district.js';
import { Embodiment } from '../src/embodiment.js';
import { CollisionWorld } from '../src/collision-world.js';

function preparedPalace() {
  const palace = new PalaceDistrict(new THREE.Scene()); palace.prepare();
  const global = point => new THREE.Vector3(...point).add(new THREE.Vector3(PALACE_CENTER[0], palace.base, PALACE_CENTER[2]));
  for (const room of PALACE_ROOMS) palace.update(global(room.view), new THREE.Vector3());
  return { palace, global };
}

test('palace craft shares finite geometry while keeping names for each batched instance', () => {
  const materials = palaceMaterials(); const first = new PalaceWorkshop(materials); const second = new PalaceWorkshop(materials);
  assert.equal(first.geometries, second.geometries);
  for (const geometry of Object.values(first.geometries)) {
    for (const attribute of [geometry.attributes.position, geometry.attributes.normal]) for (const value of attribute.array) assert.ok(Number.isFinite(value));
    for (const index of geometry.index?.array || []) assert.ok(index < geometry.attributes.position.count);
  }
  first.add('soft', 'velvet', [0, 2, 0], [3, 4, 3], [0, 0, 0], true, '雕花扶手椅');
  first.add('soft', 'velvet', [200, 2, 0], [10, 4, 3], [0, 0, 0], true, '蓝绒长沙发');
  const root = first.finish('客厅'); assert.equal(root.children.length, 1);
  assert.deepEqual(root.children[0].userData.instanceNames, ['雕花扶手椅', '蓝绒长沙发']);
  assert.equal(root.userData.collisionBoxes.length, 2);
});

test('new decorative geometry leaves the reception and side doorways visibly open', () => {
  const { palace, global } = preparedPalace(); palace.root.updateWorldMatrix(true, true);
  const rays = [
    { room: 'reception', origin: [0, 7, 65], direction: [0, 0, -1], distance: 70 },
    ...PALACE_ROOMS.slice(1).map(room => ({ room: room.id, origin: [0, 7, room.center[1]], direction: [Math.sign(room.center[0]), 0, 0], distance: 15 })),
  ];
  for (const sample of rays) {
    const root = palace.rooms.get(sample.room); root.updateWorldMatrix(false, true);
    const ray = new THREE.Raycaster(global(sample.origin), new THREE.Vector3(...sample.direction), 0, sample.distance);
    assert.equal(ray.intersectObject(root, true).length, 0, sample.room);
  }
});

test('palace detail has bounded batches and is not duplicated when rooms are revisited', () => {
  const { palace, global } = preparedPalace();
  let triangles = 0; let batches = 0;
  palace.root.traverse(object => {
    if (!object.isMesh) return;
    batches++; triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3 * (object.count || 1);
  });
  assert.ok(batches < 315, `seven-space batches: ${batches}`); assert.ok(triangles < 1900000, `triangles: ${triangles}`);
  const children = palace.root.children.slice();
  for (let visit = 0; visit < 3; visit++) for (const room of PALACE_ROOMS) palace.update(global(room.view), new THREE.Vector3());
  assert.deepEqual(palace.root.children, children);
});

test('stone material coordinates remain local through floating-origin rebasing', () => {
  const materials = palaceMaterials();
  const shader = { vertexShader: '#include <worldpos_vertex>', fragmentShader: '#include <color_fragment>' };
  materials.ivory.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /palacePoint=palaceLocal.xyz/);
  assert.doesNotMatch(shader.vertexShader, /modelMatrix/);
  assert.equal(materials.gold.envMap, materials.ivory.envMap);
});

test('rooms hidden behind solid partitions are culled without hiding aligned open doorways', () => {
  const { palace, global } = preparedPalace(); const offset = new THREE.Vector3();
  palace.update(global([18, 9, -13]), offset);
  assert.equal(palace.rooms.get('banquet').visible, true);
  assert.equal(palace.rooms.get('salon').visible, true);
  for (const room of ['reception', 'bedroom', 'club']) assert.equal(palace.rooms.get(room).visible, false, room);
  palace.update(global([0, 8, -27]), offset);
  assert.equal(palace.rooms.get('salon').visible, true); assert.equal(palace.rooms.get('banquet').visible, true);
  palace.update(global([-19, 9, -72]), offset);
  assert.equal(palace.rooms.get('bedroom').visible, true); assert.equal(palace.rooms.get('salon').visible, false);
});

test('interior lighting settles at the chandelier rather than following camera motion', () => {
  const { palace, global } = preparedPalace(); const offset = new THREE.Vector3();
  for (let frame = 0; frame < 300; frame++) palace.update(global([0, 8, 43]), offset, 1 / 60);
  assert.ok(palace.fill.position.distanceTo(new THREE.Vector3(0, 17, 26)) < 0.001);
  const anchor = palace.fill.position.clone(); palace.update(global([20, 8, 38]), offset, 1 / 60);
  assert.ok(palace.fill.position.distanceTo(anchor) < 0.001);
  const before = palace.fill.intensity; palace.update(global([0, 8, 100]), offset, 1 / 60);
  assert.ok(Math.abs(palace.fill.intensity - before) < 5); assert.ok(palace.fill.intensity > 0);
});

test('the bedroom chandelier stays outside the four-poster canopy', () => {
  const { palace } = preparedPalace(); const matrix = new THREE.Matrix4(); let lamps = 0;
  palace.rooms.get('bedroom').traverse(object => {
    if (!object.isInstancedMesh) return;
    for (let instance = 0; instance < object.count; instance++) {
      if (object.userData.instanceNames[instance] !== '珍珠树灯') continue;
      object.getMatrixAt(instance, matrix); const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert.ok(position.x > -32 && position.z > -74); lamps++;
    }
  });
  assert.equal(lamps, 36);
});

test('room bounds exclude furniture behind the camera and survive a world-origin shift', () => {
  const { palace, global } = preparedPalace();
  const position = global([18, 9, -13]); const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 1000);
  camera.position.copy(position); camera.lookAt(global([37, 7, -32]));
  palace.update(position, new THREE.Vector3(), 1 / 60, camera);
  assert.equal(palace.rooms.get('banquet').visible, true); assert.equal(palace.rooms.get('salon').visible, false);
  const collision = new CollisionWorld({ floor: () => palace.base - 12 }); collision.rebuild([palace.root]);
  assert.ok(collision.penetration(global([-36, 2.7, -27]), [{ radius: 1, offset: new THREE.Vector3() }]) > 0.9);
  const offset = new THREE.Vector3(-480, 0, 480); camera.position.sub(offset); camera.lookAt(global([37, 7, -32]).sub(offset));
  palace.update(position, offset, 1 / 60, camera);
  assert.equal(palace.rooms.get('banquet').visible, true); assert.equal(palace.rooms.get('salon').visible, false);
});

test('clicking batched furniture uses its identity and size instead of the whole room', () => {
  const shop = new PalaceWorkshop(palaceMaterials());
  shop.add('soft', 'velvet', [0, 2, 0], [3, 4, 3], [0, 0, 0], false, '雕花扶手椅');
  shop.add('soft', 'velvet', [200, 2, 0], [10, 4, 3], [0, 0, 0], false, '蓝绒长沙发');
  const root = shop.finish('客厅'); const scene = new THREE.Scene(); scene.add(root); scene.updateMatrixWorld(true);
  const ocean = { scene, palace: { root }, renderer: { domElement: { addEventListener() {} } }, worldOffset: new THREE.Vector3(), creationScene: { root: new THREE.Group(), objects: new Map() }, ecology: { root: new THREE.Group() }, landmarks: { entries: [] }, wonders: { entries: new Map() }, endless: { chunks: new Map() } };
  const embodiment = new Embodiment(ocean);
  const candidate = embodiment.pick(new THREE.Raycaster(new THREE.Vector3(0, 2, 10), new THREE.Vector3(0, 0, -1)));
  assert.equal(candidate.name, '雕花扶手椅'); assert.equal(candidate.living, false);
  assert.ok(candidate.focusRadius >= 3 && candidate.focusRadius < 4); assert.equal(candidate.instance, undefined);
});
