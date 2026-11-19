import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoralRadiance, coralGlowLevel } from '../src/coral-radiance.js';

test('coral keeps a resting halo, brightens on awakening and limits reduced motion', () => {
  assert.ok(coralGlowLevel(0) > 0.3);
  assert.equal(coralGlowLevel(1), 1);
  assert.ok(coralGlowLevel(1, true) < coralGlowLevel(1));
  for (const energy of [-100, Infinity, NaN, 100]) assert.ok(coralGlowLevel(energy) >= 0.38 && coralGlowLevel(energy) <= 1);
});

test('coral lights stay on fixed anchors with a single depth-tested draw and bounded uniforms', () => {
  const anchors = [{ position: [3, 10, -8], progress: 0.8, phase: 0.5, halo: false, size: 1, color: '#78ffdd' }, { position: [3, 10, -8], progress: 0.8, phase: 0.5, halo: true, size: 20, color: '#78ffdd' }];
  const glow = createCoralRadiance(anchors); assert.equal(glow.root.children.length, 1);
  const lights = glow.root.children[0]; const positions = [...lights.geometry.attributes.position.array];
  for (const time of [0, 0.5, 3, 30]) glow.update(time, 1, -Infinity, true, 8);
  assert.deepEqual([...lights.geometry.attributes.position.array], positions);
  assert.equal(lights.material.uniforms.age.value, -1); assert.equal(lights.material.uniforms.ratio.value, 2); assert.equal(lights.material.uniforms.reduced.value, 1);
  assert.equal(lights.material.depthTest, true); assert.equal(lights.material.depthWrite, false); assert.equal(lights.userData.noPick, true);
  assert.doesNotMatch(lights.material.vertexShader, /random|fract\(time/);
  lights.geometry.dispose(); lights.material.dispose();
});
