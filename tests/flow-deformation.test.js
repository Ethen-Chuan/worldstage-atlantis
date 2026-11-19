import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFlowDeformer } from '../src/flow-deformation.js';
import { createMermaid } from '../src/mermaid.js';

test('flow deformation preserves the original displacement and transforms normals without rebuilding faces', () => {
  const geometry = new THREE.PlaneGeometry(2, 5, 6, 28);
  const positions = geometry.attributes.position; const original = new Float32Array(positions.array);
  const deform = createFlowDeformer(geometry, { seed: 0.7 });
  for (const time of [0, 0.2, 3, 20, 1000]) {
    deform.update(time);
    for (let index = 0; index < positions.count; index++) {
      const weight = geometry.attributes.uv.getY(index);
      assert.ok(Math.abs(positions.getX(index) - original[index * 3] - Math.sin(time * 0.9 + weight * 4 + 0.7) * weight * weight * 0.18) < 1e-6);
      assert.ok(Math.abs(positions.getZ(index) - original[index * 3 + 2] - Math.sin(time * 0.65 - weight * 4 + 0.7) * weight * weight * 0.24) < 1e-6);
      assert.equal(positions.getY(index), original[index * 3 + 1]);
      const normal = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, index);
      assert.ok(normal.toArray().every(Number.isFinite)); assert.ok(Math.abs(normal.length() - 1) < 1e-5);
    }
    const reference = geometry.clone(); reference.computeVertexNormals();
    for (let row = 1; row < 28; row++) {
      const index = row * 7 + 3;
      const analytic = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, index);
      const sampled = new THREE.Vector3().fromBufferAttribute(reference.attributes.normal, index);
      assert.ok(analytic.dot(sampled) > 0.999);
    }
    reference.dispose();
  }
  geometry.dispose();
});

test('animated mermaid does not rebuild triangle normals and keeps finite geometry when seeking', () => {
  const mermaid = createMermaid(); const geometries = new Set(); const materials = new Set();
  mermaid.root.traverse(object => {
    if (object.geometry) { geometries.add(object.geometry); object.geometry.computeVertexNormals = () => { throw new Error('Per-frame normal rebuild'); }; }
    if (object.material) materials.add(object.material);
  });
  for (const time of [0, 0.016, 10, 9999, 0]) mermaid.animate(time);
  for (const geometry of geometries) {
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    if (geometry.attributes.normal) assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
    geometry.dispose();
  }
  materials.forEach(material => material.dispose());
});

test('curved hair and tail normals remain close to the deformed triangle surface', () => {
  const mermaid = createMermaid(); const geometries = new Set(); const materials = new Set();
  mermaid.root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  for (const time of [0, 1.3, 5, 13]) {
    mermaid.animate(time); const alignment = [];
    for (const geometry of geometries) {
      if (geometry.attributes.position.usage !== THREE.DynamicDrawUsage) continue;
      const reference = geometry.clone(); reference.computeVertexNormals();
      for (let index = 0; index < geometry.attributes.normal.count; index++) {
        const analytic = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, index);
        const sampled = new THREE.Vector3().fromBufferAttribute(reference.attributes.normal, index);
        if (analytic.lengthSq() > 0.9 && sampled.lengthSq() > 0.9) alignment.push(analytic.dot(sampled));
      }
      reference.dispose();
    }
    alignment.sort((first, second) => first - second);
    assert.ok(alignment.length > 9000); assert.ok(alignment[0] > 0.85);
    assert.ok(alignment[Math.floor(alignment.length * 0.05)] > 0.999);
  }
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
});
