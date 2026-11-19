import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dayCycleAt, WorldDayClock } from '../src/day-cycle.js';
import { ATLAS_SITES, LANDMARKS } from '../src/landmarks.js';
import { palaceNavigationMarkup } from '../src/palace-wayfinding.js';
import { whaleFallPose, WhaleFall } from '../src/whale-fall.js';
import { WHALE_REST, createWhaleRemains, installReveal } from '../src/whale-remains.js';
import { initialCreation } from '../src/creation.js';
import { writeMemory, readMemory } from '../src/world-memory.js';
import { planWorld, validateWorldPlan } from '../src/world-planner.js';

test('all destinations are parallel atlas entries and their discoveries survive save/load', () => {
  assert.equal(ATLAS_SITES.length, 11); assert.equal(new Set(ATLAS_SITES.map(site => site.id)).size, 11);
  assert.deepEqual(ATLAS_SITES.slice(0, LANDMARKS.length), LANDMARKS);
  for (const site of ATLAS_SITES) { assert.equal(site.center.length, 3); assert.ok(site.number); assert.ok(site.invitation); }
  const memory = writeMemory(initialCreation(), { position: [48, 198, 130], target: [-5, 193, -5] }, ATLAS_SITES.map(site => site.id));
  assert.equal(readMemory(memory).visited.length, 11);
  assert.equal(planWorld('去逐日海豚').args.site, 'sunset-surface');
  assert.ok(validateWorldPlan(planWorld('成为海豚'), { actors: ['dolphin'] }));
});

test('palace navigation has glyphs and accessible labels, not visible room name plaques or tooltips', () => {
  const markup = palaceNavigationMarkup(); assert.equal(markup.replace(/<[^>]*>/g, '').trim(), '');
  assert.doesNotMatch(markup, /title=|palace-description|palace-current/);
  assert.equal((markup.match(/data-room=/g) || []).length, 8); assert.match(markup, /aria-label=/);
});

test('the day palette wraps continuously at midnight and uses the device local clock', () => {
  const clock = new WorldDayClock(() => new Date(2026, 10, 20, 18, 30, 0));
  assert.equal(clock.sample().hour, 18.5); assert.equal(clock.sample().mode, 'realtime');
  assert.equal(clock.setMode('night'), true); assert.equal(clock.sample().hour, 23);
  assert.equal(clock.setMode('invalid'), false); assert.equal(clock.mode, 'night'); clock.setMode('realtime'); assert.equal(clock.sample().hour, 18.5);
  assert.deepEqual(dayCycleAt(0), dayCycleAt(24));
  for (const key of ['skyTop', 'skyHorizon', 'waterDeep', 'fog']) assert.ok(Math.hypot(...dayCycleAt(23.999)[key].map((value, index) => value - dayCycleAt(0.001)[key][index])) < 0.001);
  for (let hour = -24; hour < 48; hour += 0.25) { const cycle = dayCycleAt(hour); assert.ok(cycle.night >= 0 && cycle.night <= 1); assert.ok(cycle.direction.every(Number.isFinite)); }
});

test('whale descent ends with the exact skeletal rest pose and a smoothly vanishing swimming effort', () => {
  for (const age of [38, 48, 55, 64, 75]) {
    const pose = whaleFallPose(age);
    assert.ok(pose.position.every((value, index) => Math.abs(value - WHALE_REST.position[index]) < 1e-9));
    assert.deepEqual(pose.rotation, WHALE_REST.rotation); assert.equal(pose.effort, 0);
  }
  for (const seam of [10, 38, 48, 64]) {
    const before = whaleFallPose(seam - 0.001); const after = whaleFallPose(seam + 0.001);
    assert.ok(Math.hypot(...after.position.map((value, index) => value - before.position[index])) < 0.002);
    assert.ok(Math.abs(after.effort - before.effort) < 0.00001);
  }
  for (let age = 48; age < 64; age += 0.1) { const pose = whaleFallPose(age); assert.ok(Math.abs(pose.flesh + pose.bones - 1) < 1e-9); }
});

test('reveal keeps visual and shadow masks identical without mutating an existing swim shader', () => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial());
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial(); const originalDepth = mesh.customDepthMaterial; const compile = originalDepth.onBeforeCompile;
  for (let repeat = 0; repeat < 3; repeat++) {
    const amount = { value: 0.4 }; const cleanup = installReveal(mesh, amount);
    const shader = () => ({ vertexShader: '#include <begin_vertex>', fragmentShader: '#include <alphatest_fragment>', uniforms: {} });
    const surface = shader(); const shadow = shader(); mesh.material.onBeforeCompile(surface); mesh.customDepthMaterial.onBeforeCompile(shadow);
    assert.equal(surface.uniforms.revealAmount, amount); assert.equal(shadow.uniforms.revealAmount, amount); assert.match(shadow.fragmentShader, /discard/);
    cleanup(); assert.equal(mesh.customDepthMaterial, originalDepth); assert.equal(originalDepth.onBeforeCompile, compile);
  }
});

test('whale and bones share a world transform, pause stays stable, and reef plants are never faded', () => {
  const materials = { pale: new THREE.MeshStandardMaterial() }; const root = new THREE.Group(); root.position.set(-530, -12, -325);
  const remains = createWhaleRemains(materials); const reef = new THREE.Mesh(new THREE.BoxGeometry(1), new THREE.MeshStandardMaterial()); root.add(remains, reef);
  const scene = new THREE.Scene(); scene.add(root); let awakenings = 0;
  const ocean = { scene, currentLandmark: { id: 'garden' }, time: 0, worldOffset: new THREE.Vector3(), play: { stop() {}, awaken() { awakenings++; } }, embodiment: { exit() {} }, landmarks: { prepare() {}, entries: [{ landmark: { id: 'garden' }, root }] } };
  const sound = { whaleCall() {}, stopWhaleCall() {} }; const fall = new WhaleFall(ocean, sound); const reefMaterial = reef.material;
  assert.equal(fall.start(), true); ocean.time = 54; fall.update(0.1); scene.updateMatrixWorld(true);
  assert.ok(fall.whale.root.getWorldPosition(new THREE.Vector3()).distanceTo(remains.getWorldPosition(new THREE.Vector3())) < 1e-8);
  const pose = fall.whale.root.matrixWorld.clone(); fall.update(0); scene.updateMatrixWorld(true); assert.deepEqual(fall.whale.root.matrixWorld.elements, pose.elements);
  assert.equal(reef.material, reefMaterial); assert.equal(reef.material.opacity, 1);
  ocean.time = 65; fall.update(0.1); assert.equal(awakenings, 1); fall.stop(); assert.equal(remains.visible, true); assert.equal(fall.group.visible, false);
});
