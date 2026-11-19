import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameBudget } from '../src/frame-budget.js';

function simulator() {
  const budget = new FrameBudget();
  let now = 0;
  const frames = (duration, milliseconds, eligible = true) => {
    let changes = 0;
    for (let index = 0; index < Math.ceil(duration / milliseconds); index++) { now += milliseconds; if (budget.sample(milliseconds, now, eligible)) changes++; }
    return changes;
  };
  return { budget, frames, time: () => now };
}

test('stable frames stay at native resolution, sustained slow frames reduce in bounded stages', () => {
  const session = simulator();
  session.frames(15000, 16.67);
  assert.equal(session.budget.scale, 1);
  assert.equal(session.frames(8000, 40), 1);
  assert.equal(session.budget.scale, 0.9);
  session.frames(30000, 40);
  assert.equal(session.budget.scale, 0.72);
  assert.equal(session.frames(15000, 40), 0);
});

test('a single bad frame or short burst never changes resolution', () => {
  const session = simulator();
  session.frames(6000, 16.67);
  session.budget.sample(180, session.time() + 180);
  session.frames(1000, 40);
  session.frames(8000, 16.67);
  assert.equal(session.budget.scale, 1);
});

test('recovery requires sustained headroom and never oscillates on alternating windows', () => {
  const session = simulator();
  session.frames(17000, 40);
  const reduced = session.budget.scale;
  assert.ok(reduced < 1);
  session.frames(8000, 16.67);
  assert.equal(session.budget.scale, reduced);
  session.frames(20000, 16.67);
  assert.ok(session.budget.scale > reduced);
  assert.ok(session.budget.scale <= 1);
});

test('paused, traveling, hidden or invalid samples cannot force downscaling', () => {
  const session = simulator();
  session.frames(25000, 100, false);
  assert.equal(session.budget.scale, 1);
  for (const milliseconds of [NaN, Infinity, -1, 0, 3000]) assert.equal(session.budget.sample(milliseconds, 30000), false);
  session.frames(2000, 40);
  assert.equal(session.budget.scale, 1);
});

test('explicitly disabling adaptation restores native scale and ignores future samples', () => {
  const session = simulator();
  session.frames(20000, 40);
  assert.ok(session.budget.scale < 1);
  session.budget.configure(false, session.time());
  assert.equal(session.budget.scale, 1);
  session.frames(30000, 60);
  assert.equal(session.budget.inspect().enabled, false);
  assert.equal(session.budget.scale, 1);
});
