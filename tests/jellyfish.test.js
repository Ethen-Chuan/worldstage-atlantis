import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createJellyBloom, JELLY_VARIANTS, jellyActors } from '../src/jellyfish.js';
import { Embodiment } from '../src/embodiment.js';
import { CollisionWorld, actorHull } from '../src/collision-world.js';

function fixture() {
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000); camera.position.set(0, 55, 40);
  const ocean = { scene, camera, time: 0, worldOffset: new THREE.Vector3(), renderer: { domElement: { addEventListener() {} } }, controls: { target: new THREE.Vector3(0, 55, 0) }, movement: new Set(), navigationVelocity: new THREE.Vector3(), captureView: () => ({ position: [0, 55, 40], target: [0, 55, 0] }), creationScene: { root: new THREE.Group(), objects: new Map() }, ecology: { root: new THREE.Group() }, landmarks: { entries: [] }, wonders: { entries: new Map() }, endless: { chunks: new Map() }, biomes: { groups: {} } };
  const bloom = createJellyBloom({ count: 4 }); bloom.root.position.set(0, 55, 0); scene.add(bloom.root);
  bloom.jellies.forEach((jelly, index) => { jelly.position.set(index * 10, 0, 0); jelly.userData.base = jelly.position.toArray(); jelly.scale.setScalar(1); });
  ocean.biomes.groups.garden = bloom.root; scene.updateMatrixWorld(true);
  return { ocean, bloom, embodiment: new Embodiment(ocean), ray: index => new THREE.Raycaster(new THREE.Vector3(index * 10, 55.18, 10), new THREE.Vector3(0, 0, -1)) };
}

test('all four jelly forms are distinct living individuals with finite geometry and no extra lights', () => {
  const bloom = createJellyBloom({ count: 16 }); const species = new Set(); let lights = 0; let vertices = 0;
  bloom.root.traverse(object => {
    if (object.isLight) lights++;
    if (object.userData.speciesVariant) species.add(object.userData.speciesVariant);
    if (object.geometry) { vertices += object.geometry.attributes.position.count; for (const attribute of Object.values(object.geometry.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite)); }
  });
  assert.equal(species.size, 4); assert.equal(lights, 0); assert.ok(vertices < 180000);
  assert.equal(jellyActors(bloom.root).length, 16); assert.equal(new Set(bloom.jellies.slice(0, 4).map(jelly => jelly.children[0].geometry)).size, 4);
  bloom.dispose();
});

test('clicking each garden jelly selects that individual, immediately entering first person', () => {
  const { ocean, bloom, embodiment, ray } = fixture();
  for (let index = 0; index < 4; index++) {
    const candidate = embodiment.pick(ray(index)); assert.equal(candidate?.root, bloom.jellies[index]); assert.equal(candidate.name, JELLY_VARIANTS[index].name);
    embodiment.enter(candidate); assert.equal(embodiment.firstPerson, true); assert.equal(embodiment.active.root, bloom.jellies[index]);
    embodiment.update(2); const before = embodiment.position.clone(); ocean.movement.add('forward'); embodiment.update(0.1);
    assert.ok(embodiment.position.distanceTo(before) > 0); assert.ok(embodiment.position.distanceTo(before) < 1);
    embodiment.exit(false); bloom.animate(0); ocean.scene.updateMatrixWorld(true);
  }
  bloom.dispose();
});

test('streamed decorations and authored blooms preserve individual identity instead of selecting a whole swarm', () => {
  const { ocean, bloom, embodiment, ray } = fixture();
  ocean.biomes.groups = {}; ocean.endless.chunks.set('0:0', { decorations: bloom.root });
  assert.equal(embodiment.pick(ray(1))?.root, bloom.jellies[1]);
  ocean.endless.chunks.clear(); ocean.creationScene.root = bloom.root; bloom.root.userData.creature = 'jelly'; bloom.root.userData.creationId = 'form-01';
  ocean.creationScene.objects.set('form-01', { root: bloom.root, shape: bloom.root, item: { asset: 'jelly', id: 'form-01', name: '水母群' } });
  const candidate = embodiment.pick(ray(2)); assert.equal(candidate.root, bloom.jellies[2]); assert.equal(candidate.sourceCreationId, 'form-01'); assert.equal(candidate.id, undefined);
  bloom.dispose();
});

test('hidden jellies and solid foreground obstacles cannot be clicked through', () => {
  const { ocean, bloom, embodiment, ray } = fixture(); bloom.root.visible = false; assert.equal(embodiment.pick(ray(0)), null);
  bloom.root.visible = true; const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), new THREE.MeshBasicMaterial()); wall.position.set(0, 55, 4); ocean.city = wall; ocean.scene.add(wall); ocean.scene.updateMatrixWorld(true);
  assert.equal(embodiment.pick(ray(0)).root, wall); bloom.dispose();
});

test('pause freezes all jelly drift and luminescence clocks, colors stay species-specific by default', () => {
  const bloom = createJellyBloom({ count: 4 }); bloom.animate(12, 0.1); const positions = bloom.jellies.map(jelly => jelly.position.toArray());
  bloom.animate(12, 0); assert.deepEqual(bloom.jellies.map(jelly => jelly.position.toArray()), positions);
  assert.equal(new Set(bloom.jellies.map(jelly => jelly.children[0].material.uniforms.lightTint.value.getHexString())).size, 4);
  bloom.setColor('rose'); bloom.setGlow(true); bloom.animate(13, 1); assert.ok(bloom.jellies[1].children[0].material.uniforms.response.value > 0.5);
  bloom.setColor('pearl'); assert.equal(new Set(bloom.jellies.map(jelly => jelly.children[0].material.uniforms.lightTint.value.getHexString())).size, 4); bloom.dispose();
});

test('individual jelly hulls respect a wall without using the entire swarm as a rigid body', () => {
  const { ocean, bloom } = fixture(); const wall = new THREE.Group(); wall.userData.collisionBoxes = [{ min: [-5, 45, -6], max: [5, 65, -5] }]; ocean.scene.add(wall);
  const collisions = new CollisionWorld({ floor: () => 0 }); collisions.rebuild([wall]); const hull = actorHull({ root: bloom.jellies[0], species: 'jelly' });
  assert.equal(hull.length, 1); assert.ok(hull[0].radius < 1.1);
  const safe = collisions.move(new THREE.Vector3(0, 55, 0), new THREE.Vector3(0, 55, -10), { hull }); assert.ok(safe.z > -5); bloom.dispose();
});
