import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PalaceDistrict, PALACE_CENTER } from '../src/palace-district.js';
import { PalaceWorkshop } from '../src/palace-craft.js';
import { CollisionWorld } from '../src/collision-world.js';
import { LANDMARKS, localLandmark } from '../src/landmarks.js';

function fixture() {
  const palace = new PalaceDistrict(new THREE.Scene()); palace.prepare();
  const global = local => new THREE.Vector3(...local).add(new THREE.Vector3(PALACE_CENTER[0], palace.base, PALACE_CENTER[2]));
  palace.update(global([0, 40, 125]), new THREE.Vector3());
  const collision = new CollisionWorld({ floor: () => palace.base - 12 }); collision.rebuild([palace.root]);
  return { palace, global, collision };
}

test('sanctuary replaces tower and dome silhouettes with a supported temple and open galleries', () => {
  const { palace } = fixture();
  const workshop = new PalaceWorkshop(palace.materials);
  const names = palace.exterior.children.flatMap(mesh => mesh.userData.instanceNames);
  for (const name of ['海神殿三角山墙', '环礁弧形柱廊', '侧殿连续承重基座', '海神殿巨型凹槽石柱', '侵蚀礁岩基座', '青铜屋面分片接缝']) assert.ok(names.includes(name), name);
  assert.ok(palace.exterior.children.every(mesh => mesh.geometry !== workshop.geometries.cone && mesh.geometry !== workshop.geometries.dome));
  assert.ok(palace.exterior.children.some(mesh => mesh.castShadow));
  assert.ok(palace.exterior.userData.craft.batches <= 45);
  const triangles = palace.exterior.children.reduce((sum, mesh) => sum + (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * mesh.count, 0);
  assert.ok(triangles < 470000, `exterior triangles: ${triangles}`);
});

test('new shared sanctuary geometries have finite normals, valid indices and bounded instances', () => {
  const { palace } = fixture();
  const workshop = new PalaceWorkshop(palace.materials);
  for (const name of ['reefRock', 'pediment', 'terraceArc']) {
    const geometry = workshop.geometries[name]; assert.ok(geometry);
    for (const attribute of [geometry.attributes.position, geometry.attributes.normal]) for (const value of attribute.array) assert.ok(Number.isFinite(value), name);
    for (const index of geometry.index?.array || []) assert.ok(index < geometry.attributes.position.count, name);
  }
  for (const mesh of palace.exterior.children) {
    assert.equal(mesh.count, mesh.userData.instanceNames.length);
    for (const value of mesh.instanceMatrix.array) assert.ok(Number.isFinite(value));
  }
});

test('the open ring colonnade admits a swimmer but blocks its pillars, paving and roof', () => {
  const { collision, global } = fixture();
  const at = (angle, radius, elevation) => global([Math.cos(angle * Math.PI / 180) * radius, elevation, -36 + Math.sin(angle * Math.PI / 180) * radius]);
  const hull = [{ radius: 1.2, offset: new THREE.Vector3() }];
  assert.equal(collision.penetration(at(5.25, 138, 9), hull), 0);
  assert.ok(collision.penetration(at(1.5, 132.2, 9), hull) > 1);
  assert.ok(collision.penetration(at(5.25, 138, 24.7), hull) > 1);
  let previous = at(-60, 138, 9);
  for (let step = 1; step <= 220; step++) {
    const desired = at(-60 + step * 0.5, 138, 9);
    const actual = collision.move(previous, desired, { radius: 1.2, dynamic: false });
    assert.ok(actual.distanceTo(desired) < 0.01, `gallery angle ${-60 + step * 0.5}`);
    previous = actual;
  }
});

test('the upper sanctuary has an open central approach rather than an invisible arch blocker', () => {
  const { palace, collision, global } = fixture();
  let previous = global([0, 40, 22]);
  for (let depth = 21; depth >= -60; depth--) {
    const desired = global([0, 40, depth]);
    const actual = collision.move(previous, desired, { radius: 1.2, dynamic: false });
    assert.ok(actual.distanceTo(desired) < 0.01, `sanctuary depth ${depth}`); previous = actual;
  }
  palace.root.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster(global([0, 40, 22]), new THREE.Vector3(0, 0, -1), 0, 76);
  assert.equal(ray.intersectObject(palace.exterior, true).length, 0);
});

test('slow surface caustics remain local, share a clock, and respect reduced motion and pause', () => {
  const { palace, global } = fixture(); const offset = new THREE.Vector3();
  const before = palace.tideClock.value;
  palace.update(global([0, 40, 120]), offset, 0.05);
  assert.ok(palace.tideClock.value > before);
  const settled = palace.tideClock.value;
  palace.update(global([0, 40, 120]), offset, 0.1, null, true);
  palace.update(global([0, 40, 120]), offset, 0);
  palace.update(global([0, 40, 120]), offset, NaN);
  assert.equal(palace.tideClock.value, settled);
  const shader = { uniforms: {}, vertexShader: '#include <worldpos_vertex>', fragmentShader: '#include <color_fragment>' };
  palace.materials.limestone.onBeforeCompile(shader);
  assert.equal(shader.uniforms.sanctuaryTime, palace.tideClock);
  assert.equal(palace.materials.bronze.userData.tideClock, palace.tideClock);
  assert.match(shader.vertexShader, /sanctuaryPoint=sanctuaryLocal.xyz/);
  assert.doesNotMatch(shader.vertexShader, /modelMatrix/);
  assert.match(shader.fragmentShader, /sanctuaryMasonry/);
});

test('new arrival camera remains inside the palace landmark and outside solid architecture', () => {
  const { collision } = fixture();
  const landmark = LANDMARKS.find(place => place.id === 'crown');
  assert.equal(localLandmark(landmark.camera)?.id, 'crown');
  assert.equal(collision.penetration(new THREE.Vector3(...landmark.camera), [{ radius: 2, offset: new THREE.Vector3() }]), 0);
});

test('opaque room walls cull exterior drawing without deleting its physical collision', () => {
  const { palace, global } = fixture(); const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 1400);
  camera.position.copy(global([18, 9, -13])); camera.lookAt(global([37, 7, -32]));
  palace.update(camera.position.clone(), new THREE.Vector3(), 1 / 60, camera);
  assert.equal(palace.exterior.visible, false);
  const collision = new CollisionWorld({ floor: () => palace.base - 12 }); collision.rebuild([palace.root]);
  assert.ok(collision.penetration(global([38, 48, 3]), [{ radius: 1, offset: new THREE.Vector3() }]) > 0.9);
  camera.position.copy(global([0, 8, 43])); camera.lookAt(global([0, 7, 85]));
  palace.update(camera.position.clone(), new THREE.Vector3(), 1 / 60, camera);
  assert.equal(palace.exterior.visible, true);
  camera.position.copy(global([35, 8, -82])); camera.lookAt(global([35, 8, -120]));
  palace.update(camera.position.clone(), new THREE.Vector3(), 1 / 60, camera);
  assert.equal(palace.exterior.visible, true);
});
