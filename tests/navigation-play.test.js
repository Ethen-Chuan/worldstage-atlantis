import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { chartView, projectChart, unprojectChart, fitChart, chartScale, planarDistance, compassBearing, formatDistance } from '../src/chart-math.js';
import { LANDMARKS } from '../src/landmarks.js';
import { ritualRequest, festivalStage, segmentDistance, SITE_PLAY, trialCourse } from '../src/tide-play.js';
import { createShark } from '../src/shark.js';
import { initialCreation, interpretCreation, executeCreation, operation } from '../src/creation.js';
import { readMemory, writeMemory } from '../src/world-memory.js';
import { CreationScene } from '../src/creation-scene.js';
import { seaHeight } from '../src/terrain.js';

const say = (state, text) => executeCreation(state, interpretCreation(text, state), text);
const view = { position: [73, 26, 174], target: [-11, 48, -117] };

test('chart coordinates use north as negative world Z and roundtrip at every bearing', () => {
  for (const bearing of [0, 45, 90, 179, 270, 359]) {
    const chart = chartView([9200, 0, -5400], 3000, 700, 450, bearing);
    const position = [9360, 0, -5780]; const point = projectChart(position, chart); const restored = unprojectChart(point, chart);
    assert.ok(planarDistance(restored, position) < 1e-8);
  }
  assert.equal(compassBearing([0, 0, -1]), 0); assert.equal(compassBearing([1, 0, 0]), 90);
  assert.equal(compassBearing([0, 0, 1]), 180); assert.equal(compassBearing([-1, 0, 0]), 270);
  assert.ok(projectChart([0, 0, -100], chartView([0, 0, 0], 1000, 300, 200)).y < 100);
});

test('chart overview keeps every landmark and traveler in view on narrow and wide screens', () => {
  for (const [width, height] of [[330, 330], [800, 500], [600, 300]]) for (const position of [[73, 26, 174], [22000, 3, -5800]]) {
    const chart = fitChart(position, width, height);
    for (const point of [...LANDMARKS.map(landmark => landmark.center), position]) {
      const projected = projectChart(point, chart);
      assert.ok(projected.x >= 50 && projected.x <= width - 50); assert.ok(projected.y >= 50 && projected.y <= height - 50);
    }
  }
});

test('off-map positions clamp to the edge without turning the world into a bounded map', () => {
  const chart = chartView([0, 0, 0], 2000, 250, 180);
  const marker = projectChart([1e7, 5, -2e7], chart, 20);
  assert.equal(marker.edge, true); assert.ok(marker.x <= 230 && marker.y >= 20);
  const shifted = projectChart([102400, 0, -100100], chartView([100000, 0, -100000], 2000, 250, 180));
  const original = projectChart([2400, 0, -100], chart);
  assert.deepEqual(shifted, original);
});

test('mutual landmark distances are symmetric and scale labels reflect actual projection', () => {
  for (const first of LANDMARKS) for (const second of LANDMARKS) assert.equal(planarDistance(first.center, second.center), planarDistance(second.center, first.center));
  const chart = chartView([0, 0, 0], 2400, 300, 200); const ruler = chartScale(chart);
  assert.equal(ruler.pixels, ruler.meters * chart.scale);
  assert.equal(formatDistance(1200), '1.20 km'); assert.equal(formatDistance(99.7), '100 m');
});

test('seven sites expose playable rules without claiming seven unrelated game engines', () => {
  assert.deepEqual(Object.keys(SITE_PLAY), LANDMARKS.filter(site => site.kind !== 'castle').map(site => site.id));
  assert.deepEqual(new Set(Object.values(SITE_PLAY).map(play => play.mode)), new Set(['route', 'collect', 'rhythm']));
});

test('summoning accepts only supported complete phrases, not negative or mixed commands', () => {
  assert.deepEqual(ritualRequest('唤醒回声天门，召唤鲸鱼'), { id: 'gate', summon: '鲸鱼' });
  assert.deepEqual(ritualRequest('唤醒星海之眼'), { id: 'vortex', summon: null });
  for (const text of ['不要唤醒回声天门', '唤醒回声天门，召唤龙虾', '唤醒星海之眼，然后删除鲸鱼', '唤醒回声天门，召唤鲸鱼并删除一切']) assert.equal(ritualRequest(text), null);
});

test('environment response has a gentle onset, layered light and a bounded fade', () => {
  assert.equal(festivalStage(-1).strength, 0); assert.equal(festivalStage(0).strength, 0);
  assert.equal(festivalStage(24).name, '层层潮光'); assert.equal(festivalStage(24).strength, 1);
  assert.ok(festivalStage(35).strength < festivalStage(32).strength); assert.equal(festivalStage(36).strength, 0);
  assert.equal(festivalStage(Infinity).strength, 0);
});

test('checkpoint intersection is frame-rate tolerant and handles stationary swimmers', () => {
  assert.equal(segmentDistance([0, 0, 0], [-25, 0, 0], [25, 0, 0]), 0);
  assert.equal(segmentDistance([0, 12, 0], [-25, 0, 0], [25, 0, 0]), 12);
  assert.equal(segmentDistance([0, 3, 4], [0, 0, 0], [0, 0, 0]), 5);
});

test('shark geometry is finite, carries a true asymmetric tail, and supports creation', () => {
  const shark = createShark(); shark.animate(2); shark.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(shark.root); assert.ok(box.max.z - box.min.z > 11);
  shark.root.traverse(object => { if (object.geometry) { assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite)); assert.ok([...object.geometry.attributes.normal.array].every(Number.isFinite)); } });
  const result = say(initialCreation(), '创造一只鲨鱼，然后让它跟随我');
  assert.deepEqual(result.issues, []); assert.equal(result.state.entities.at(-1).asset, 'shark'); assert.equal(result.state.entities.at(-1).following, true);
});

test('inter-species formation links persist, release, undo and reject cycles', () => {
  let state = say(initialCreation(), '创造一只海龟').state;
  const result = say(state, '让海龟跟随鲸鱼'); assert.deepEqual(result.issues, []); state = result.state;
  assert.equal(state.entities.at(-1).leader, 'form-04'); assert.equal(state.entities.at(-1).following, false);
  assert.deepEqual(readMemory(writeMemory(state, view, ['palace'])).state.entities, state.entities);
  const invalid = say(state, '让鲸鱼跟随海龟'); assert.equal(invalid.changed, false); assert.match(invalid.issues.join(''), /循环/);
  state = say(state, '让海龟停止跟随').state; assert.equal(state.entities.at(-1).leader, null);
  state = say(state, '撤销').state; assert.equal(state.entities.at(-1).leader, 'form-04');
});

test('memory migrates legacy v1 while v2 rejects extra or cyclic formation data', () => {
  const legacy = JSON.parse(writeMemory(initialCreation(), view, ['palace'])); legacy.version = 1; legacy.entities.forEach(item => delete item.leader);
  assert.ok(readMemory(JSON.stringify(legacy)).state.entities.every(item => item.leader === null));
  const state = say(initialCreation(), '创造一只鲨鱼').state; const current = JSON.parse(writeMemory(state, view, ['palace']));
  current.entities[3].leader = current.entities[4].id; current.entities[4].leader = current.entities[3].id;
  assert.throws(() => readMemory(JSON.stringify(current)));
});

test('formation follows an actual moving leader, freezes and survives origin rebasing', () => {
  let state = say(initialCreation(), '创造一只海龟').state; state = say(state, '让海龟跟随鲸鱼').state;
  state.entities = state.entities.filter(item => ['whale', 'turtle'].includes(item.asset));
  const graph = new CreationScene(new THREE.Scene(), {}); graph.sync(state, true);
  for (let frame = 0; frame < 120; frame++) graph.update(1 / 30);
  const turtle = graph.objects.get(state.entities.at(-1).id); const before = turtle.followPosition.clone();
  state.entities[0].position[0] += 80; graph.sync(state);
  for (let frame = 0; frame < 120; frame++) graph.update(1 / 30);
  assert.ok(turtle.followPosition.x > before.x + 20);
  const world = turtle.followPosition.clone(); graph.paused = true; graph.update(1); assert.deepEqual(turtle.followPosition.toArray(), world.toArray());
  graph.offset.set(1440, 0, -2160); graph.update(0); assert.ok(turtle.root.position.clone().add(graph.offset).distanceTo(world) < 0.001);
  const invalid = executeCreation(state, { operations: [operation('follow', { target: state.entities.at(-1).id, reference: state.entities.at(-1).id })], issues: [] }); assert.equal(invalid.changed, false);
});

test('trial courses stay in the curated foreground, clear of the distant backdrop', () => {
  for (const site of LANDMARKS) for (const round of [0, 1, 2]) {
    const course = trialCourse(site, round); assert.equal(course.points.length, 5);
    for (const point of course.points) {
      assert.ok(point.every(Number.isFinite));
      assert.ok(planarDistance(point, site.camera) < 100);
      assert.ok(point[1] >= seaHeight(point[0], point[2]) + 37);
    }
    assert.ok(planarDistance(course.points.at(-1), site.camera) < 30);
  }
});

test('quick travel shifts whole companion chains once and leaves unrelated life in place', () => {
  let state = say(initialCreation(), '创造一只海龟，然后让海龟跟随鲸鱼').state;
  state = say(state, '让鲸鱼跟随我').state;
  state = say(state, '创造一只鲨鱼，然后让鲨鱼跟随海龟').state;
  const graph = new CreationScene(new THREE.Scene(), {}); graph.sync(state, true);
  const before = new Map([...graph.objects].map(([id, entry]) => [id, entry.followPosition.clone()]));
  const displacement = new THREE.Vector3(1200, 12, -780); graph.displaceFollowing(displacement);
  for (const [id, entry] of graph.objects) assert.ok(entry.followPosition.distanceTo(before.get(id).add(entry.item.following || entry.item.leader ? displacement : new THREE.Vector3())) < 1e-8);
});
