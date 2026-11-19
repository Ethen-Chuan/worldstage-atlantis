import test from 'node:test';
import assert from 'node:assert/strict';
import { StarWake, starWakeStage, starOrbit } from '../src/star-shoal.js';
import { createStarRadiance } from '../src/star-radiance.js';

test('star choreography gathers before a fast surge, then fades within eighteen seconds', () => {
  for (const age of [-1, Infinity, NaN, 18, 500]) assert.equal(starWakeStage(age).strength, 0);
  assert.ok(starWakeStage(1.6).gather > 0.99); assert.equal(starWakeStage(1.6).surge, 0);
  assert.equal(starWakeStage(2.25).surge, 1); assert.ok(starWakeStage(12).surge < starWakeStage(8).surge);
  const wake = new StarWake();
  for (let frame = 0; frame < 300; frame++) wake.update(1 / 60, frame / 60);
  assert.ok(wake.speed > 7.9); assert.ok(wake.radiance > 0.99);
  for (let frame = 0; frame < 420; frame++) wake.update(1 / 60, -Infinity);
  assert.ok(wake.speed < 1.001); assert.ok(wake.radiance < 0.001);
});

test('motion uses an integrated clock without jumps on replay, calm or a long session', () => {
  const wake = new StarWake(); wake.clock = 10000;
  const fish = { lane: 2, angle: 1.2, layer: 0.6, depth: 0.2, speed: 0.065 };
  let previous = starOrbit(10000, fish, 0, wake.clock);
  for (let frame = 0; frame < 1200; frame++) {
    const age = frame < 400 ? frame / 60 : frame < 480 ? -Infinity : (frame - 480) / 60;
    wake.update(1 / 60, age);
    const point = starOrbit(10000 + frame / 60, fish, wake.radiance, wake.clock, wake.gather);
    assert.ok(Math.hypot(...point.map((value, index) => value - previous[index])) < 0.9);
    previous = point;
  }
  const frozen = wake.inspect(); wake.update(0, 4); assert.deepEqual(wake.inspect(), frozen);
});

test('thirty and sixty FPS have matching phase and reduced motion caps the speed', () => {
  const run = (rate, reduced) => { const wake = new StarWake(); for (let frame = 0; frame < rate * 7; frame++) wake.update(1 / rate, (frame + 0.5) / rate, reduced); return wake; };
  assert.ok(Math.abs(run(30, false).clock - run(60, false).clock) < 0.08);
  const reduced = run(60, true); assert.ok(reduced.speed <= 2.2); assert.ok(reduced.radiance > 0.95);
});

test('starlight follows supplied collision-corrected fish positions with two fixed draw objects', () => {
  const paths = Array.from({ length: 20 }, (_, index) => ({ lane: index % 3, angle: index * 0.2 }));
  const light = createStarRadiance(paths); assert.equal(light.root.children.length, 2);
  const positions = light.positions;
  for (let index = 0; index < positions.length; index++) positions[index] = 40 + index;
  light.update(0, 1 / 60, { radiance: 1 }, false, 1);
  const trail = light.root.children[1].geometry.attributes.position.array;
  assert.deepEqual([...trail.slice(0, 3)], [...positions.slice(0, 3)]);
  assert.ok([...trail].every(Number.isFinite));
  assert.ok(light.root.children.every(object => object.material.depthTest && !object.material.depthWrite));
  light.root.children.forEach(object => { object.geometry.dispose(); object.material.dispose(); });
});
