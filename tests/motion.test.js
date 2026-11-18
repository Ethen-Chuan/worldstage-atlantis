import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { swimWave, smoothBody, springPosition, dampAngle } from '../src/swim.js';
import { CreationScene } from '../src/creation-scene.js';
import { initialCreation, interpretCreation, executeCreation } from '../src/creation.js';
import { readFileSync } from 'node:fs';

const say = (state, text) => executeCreation(state, interpretCreation(text, state), text).state;
const view = { position: new THREE.Vector3(32, 28, 100), forward: new THREE.Vector3(0, 0, -1) };

function creatureGraph() {
  const state = say(initialCreation(), '创造一只海龟'); state.entities = state.entities.slice(-1);
  const graph = new CreationScene(new THREE.Scene(), {}); graph.sync(state, true); graph.update(0, false, view);
  return { graph, state, entry: graph.objects.get(state.selected) };
}

test('swimming stays anchored at the head and its normal derivative matches displacement', () => {
  const settings = { start: -5, end: 15, amplitude: 0.82, frequency: 0.84, wavelength: 0.13 };
  for (const time of [0, 0.5, 4, 19]) {
    const anchored = swimWave(-8, time, settings); assert.equal(Math.abs(anchored.offset), 0); assert.equal(Math.abs(anchored.slope), 0);
    for (const depth of [-3, 2, 7, 12]) {
      const result = swimWave(depth, time, settings);
      const derivative = (swimWave(depth + 0.0001, time, settings).offset - swimWave(depth - 0.0001, time, settings).offset) / 0.0002;
      assert.ok(Math.abs(result.slope - derivative) < 0.000001);
    }
  }
});

test('organic body has UV coverage and welded shading across its cylindrical seam', () => {
  const body = smoothBody([[-12, 0.1], [-7, 4], [0, 3.5], [7, 1.8], [12, 0.1]], 48, 32, 0.85);
  assert.equal(body.attributes.uv.count, body.attributes.position.count);
  assert.ok(Math.max(...body.attributes.uv.array) === 1);
  for (let section = 0; section <= 48; section++) {
    const first = new THREE.Vector3().fromBufferAttribute(body.attributes.normal, section * 33);
    const last = new THREE.Vector3().fromBufferAttribute(body.attributes.normal, section * 33 + 32);
    assert.ok(first.distanceTo(last) < 0.000001);
  }
  body.dispose();
});

test('critically damped motion is invariant to frame partition and never overshoots a stationary target', () => {
  const target = new THREE.Vector3(25, 10, -40);
  const integrate = count => {
    const position = new THREE.Vector3(); const velocity = new THREE.Vector3(); let distance = position.distanceTo(target);
    for (let frame = 0; frame < count; frame++) {
      springPosition(position, velocity, target, 2.4, 2 / count);
      assert.ok(position.distanceTo(target) <= distance); distance = position.distanceTo(target);
    }
    return position;
  };
  assert.ok(integrate(60).distanceTo(integrate(240)) < 0.000001);
});

test('angular easing takes the short path across the negative-positive pi seam', () => {
  const result = dampAngle(Math.PI - 0.01, -Math.PI + 0.01, 2, 1 / 60);
  assert.ok(result > Math.PI - 0.01 && result < Math.PI + 0.01);
  assert.equal(dampAngle(1, -2, 2, 0), 1);
});

test('follow and release preserve exact rendered position and orientation on the transition frame', () => {
  const { graph, entry, state: initial } = creatureGraph(); let state = initial;
  for (let frame = 0; frame < 60; frame++) graph.update(1 / 60, false, view);
  for (const request of ['让它跟随我', '让它停止跟随', '让它跟随我']) {
    const before = entry.root.position.clone(); const rotation = entry.shape.quaternion.clone();
    state = say(graph.captureFollowing(state), request); graph.sync(state); graph.update(0, false, view);
    assert.ok(entry.root.position.distanceTo(before) < 0.000001);
    assert.ok(entry.shape.quaternion.angleTo(rotation) < 0.000001);
    for (let frame = 0; frame < 45; frame++) graph.update(1 / 60, false, view);
  }
  graph.sync({ ...state, entities: [] });
});

test('speed and material edits do not snap and settle gradually without restarting the swim cycle', () => {
  const { graph, state, entry } = creatureGraph();
  graph.update(0.2, false, view);
  const beforeSpeed = entry.currentSpeed; const beforeClock = entry.clock; const material = entry.materials.find(value => !value.userData.keepColor); const beforeColor = material.color.clone();
  const modified = structuredClone(state); modified.entities[0].params.speed = 0.2; modified.entities[0].params.color = 'gold';
  graph.sync(modified); graph.update(0, false, view);
  assert.equal(entry.currentSpeed, beforeSpeed); assert.equal(entry.clock, beforeClock); assert.ok(material.color.equals(beforeColor));
  graph.update(1 / 60, false, view);
  assert.ok(entry.currentSpeed < beforeSpeed && entry.currentSpeed > 0.2); assert.ok(entry.clock > beforeClock);
  assert.notDeepEqual(material.color.toArray(), beforeColor.toArray()); assert.notDeepEqual(material.color.toArray(), material.userData.targetColor.toArray());
  for (let frame = 0; frame < 300; frame++) graph.update(1 / 60, false, view);
  assert.ok(Math.abs(entry.currentSpeed - 0.2) < 0.0001); graph.sync({ ...state, entities: [] });
});

test('paused motion, material transitions and world rebasing preserve the rendered world', () => {
  const { graph, state, entry } = creatureGraph();
  for (let frame = 0; frame < 40; frame++) graph.update(1 / 30, false, view);
  const before = entry.root.position.clone(); const clock = entry.clock; const rotation = entry.shape.rotation.toArray();
  graph.paused = true; graph.offset.set(240, 0, -480); graph.update(1, false, view);
  assert.ok(entry.root.position.clone().add(graph.offset).distanceTo(before) < 0.000001);
  assert.equal(entry.clock, clock); assert.deepEqual(entry.shape.rotation.toArray(), rotation);
  graph.sync({ ...state, entities: [] });
});

test('public deployment is static and explicitly disables all paid model capabilities', () => {
  const config = JSON.parse(readFileSync(new URL('../public/capabilities.json', import.meta.url)));
  const media = JSON.parse(readFileSync(new URL('../public/media-capabilities.json', import.meta.url)));
  const deployment = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.equal(config.available, false); assert.equal(media.video.available, false); assert.equal(media.realtime.available, false);
  assert.equal(deployment.outputDirectory, 'dist'); assert.equal(deployment.framework, 'vite');
  assert.ok(deployment.rewrites.every(rule => !rule.destination.startsWith('http')));
});
