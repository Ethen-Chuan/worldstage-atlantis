import test from 'node:test';
import assert from 'node:assert/strict';
import { seaHeight } from '../src/terrain.js';
import { LANDMARKS } from '../src/landmarks.js';

const smooth = value => { const fraction = Math.max(0, Math.min(1, value)); return fraction * fraction * (3 - 2 * fraction); };
function naturalHeight(horizontal, depth) {
  const distance = Math.hypot(horizontal / 1.2, (depth + 80) / 1.5);
  const outside = smooth((distance - 230) / 260);
  const dunes = Math.sin(horizontal * 0.006 + Math.sin(depth * 0.004) * 1.8) * 13 + Math.cos(depth * 0.008 - horizontal * 0.001) * 9;
  const ridges = Math.sin(horizontal * 0.016) * Math.cos(depth * 0.015) * 3;
  return -8 + outside * (dunes + ridges) + Math.sin(horizontal * 0.035 + depth * 0.016) * 1.2 + Math.sin(depth * 0.12 + horizontal * 0.05) * 0.35;
}
function referenceHeight(horizontal, depth) {
  let elevation = naturalHeight(horizontal, depth);
  for (const landmark of LANDMARKS) {
    if (landmark.kind === 'city') continue;
    const distance = Math.hypot(horizontal - landmark.center[0], depth - landmark.center[2]);
    const radius = landmark.terrainRadius || 65;
    if (distance > radius + 60) continue;
    elevation += (naturalHeight(landmark.center[0], landmark.center[2]) - elevation) * (1 - smooth((distance - radius) / 60));
  }
  return elevation;
}

test('cached landmark heights preserve the sea floor across the world and flattening boundaries', () => {
  const points = [];
  for (let horizontal = -1600; horizontal <= 1600; horizontal += 80) {
    for (let depth = -1800; depth <= 1000; depth += 80) points.push([horizontal, depth]);
  }
  for (const landmark of LANDMARKS) {
    for (const radius of [0, 64.999, 65, 65.001, 124.999, 125, 125.001]) {
      for (const angle of [0, 0.7, 2.4, 4.1]) points.push([landmark.center[0] + Math.cos(angle) * radius, landmark.center[2] + Math.sin(angle) * radius]);
    }
  }
  for (const [horizontal, depth] of points) assert.ok(Math.abs(seaHeight(horizontal, depth) - referenceHeight(horizontal, depth)) < 1e-10);
});
