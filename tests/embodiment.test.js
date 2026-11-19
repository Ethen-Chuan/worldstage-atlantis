import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Embodiment } from '../src/embodiment.js';

function fixture() {
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 50, 80);
  const ocean = { scene, camera, renderer: { domElement: { addEventListener() {} } }, worldOffset: new THREE.Vector3(), controls: { target: new THREE.Vector3(0, 50, 0), enabled: true, autoRotate: false }, movement: new Set(), navigationVelocity: new THREE.Vector3(), time: 0, reduced: false, creationScene: { objects: new Map() }, captureView: () => ({ position: [0, 50, 80], target: [0, 50, 0] }), travelTo() {} };
  const root = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshStandardMaterial()); root.position.set(0, 50, 0); scene.add(root);
  const embodiment = new Embodiment(ocean); return { ocean, root, embodiment };
}

test('natural creatures rejoin their route without a release-frame teleport or cumulative drift', () => {
  const { ocean, root, embodiment } = fixture();
  embodiment.enter({ root, shape: root, living: true, species: 'shark', name: 'test' });
  for (let frame = 0; frame < 120; frame++) { embodiment.beforeSimulation(); embodiment.update(1 / 60); }
  ocean.movement.add('forward');
  for (let frame = 0; frame < 180; frame++) { embodiment.beforeSimulation(); embodiment.update(1 / 60); }
  const released = root.position.clone(); embodiment.exit(false);
  embodiment.beforeSimulation(); embodiment.update(1 / 60);
  assert.ok(root.position.distanceTo(released) < 0.2);
  for (let frame = 0; frame < 1800; frame++) { embodiment.beforeSimulation(); embodiment.update(1 / 60); }
  assert.equal(embodiment.releases.length, 0); assert.ok(root.position.distanceTo(new THREE.Vector3(0, 50, 0)) < 1e-8);
});

test('pause preserves an ongoing viewpoint transition and movement position', () => {
  const { ocean, embodiment, root } = fixture(); embodiment.enter({ root, shape: root, living: true, species: 'turtle', name: 'test' });
  embodiment.beforeSimulation(); embodiment.update(0.2);
  const position = ocean.camera.position.clone(); const elapsed = embodiment.blend.elapsed;
  for (let frame = 0; frame < 60; frame++) { embodiment.beforeSimulation(); embodiment.update(0); }
  assert.equal(embodiment.blend.elapsed, elapsed); assert.deepEqual(ocean.camera.position.toArray(), position.toArray());
});

test('entering a living object goes straight to first person without confirmation', () => {
  const { embodiment, root } = fixture();
  embodiment.enter({ root, shape: root, living: true, species: 'shark', name: 'shark' });
  assert.equal(embodiment.firstPerson, true); assert.ok(embodiment.blend);
  for (let frame = 0; frame < 120; frame++) { embodiment.beforeSimulation(); embodiment.update(1 / 60); }
  assert.equal(embodiment.blend, null); assert.equal(root.visible, false);
});

test('switching targets preserves the original free-exploration return view', () => {
  const { embodiment, root, ocean } = fixture();
  embodiment.enter({ root, shape: root, living: true, species: 'shark', name: 'shark' });
  const saved = embodiment.savedView; ocean.captureView = () => ({ position: [100, 100, 100] });
  const statue = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), new THREE.MeshStandardMaterial()); ocean.scene.add(statue);
  embodiment.enter({ root: statue, living: false, point: new THREE.Vector3(0, 40, -40), name: 'statue' });
  assert.equal(embodiment.savedView, saved); assert.equal(embodiment.firstPerson, false); assert.equal(root.visible, true);
  embodiment.update(2); assert.equal(ocean.controls.autoRotate, true);
});

test('clicking an airborne dolphin does not freeze its leap during the first-person transition', () => {
  const { ocean, root, embodiment } = fixture(); root.position.set(0, 197, 0); root.userData.surfaceVelocity = new THREE.Vector3(0, 9, -14);
  embodiment.enter({ root, shape: root, living: true, species: 'dolphin', name: 'dolphin' });
  const origin = embodiment.position.clone();
  for (let frame = 0; frame < 30; frame++) { ocean.time += 1 / 60; embodiment.beforeSimulation(); embodiment.update(1 / 60); }
  assert.equal(embodiment.firstPerson, true); assert.ok(embodiment.blend); assert.ok(embodiment.position.distanceTo(origin) > 5);
  assert.ok(embodiment.dolphinPilot.airborne); assert.ok(embodiment.dolphinPilot.velocity.y < 9);
});
