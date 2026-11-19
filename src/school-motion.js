import * as THREE from 'three';
import { dampAngle } from './swim.js';

const CELL = 5;
const TICK = 1 / 20;
const cellKey = (horizontal, vertical, depth) => Math.imul(horizontal, 73856093) ^ Math.imul(vertical, 19349663) ^ Math.imul(depth, 83492791);

export class SchoolMotion {
  constructor() {
    this.cells = new Map(); this.pool = []; this.direction = new THREE.Vector3(); this.separation = new THREE.Vector3(); this.desired = new THREE.Vector3(); this.accumulator = 0; this.step = null;
  }

  begin(members, delta = null) {
    if (delta !== null) {
      this.accumulator += Math.min(delta, 0.1);
      this.step = this.accumulator + 1e-9 >= TICK ? Math.min(0.1, Math.floor((this.accumulator + 1e-9) / TICK) * TICK) : 0;
      this.accumulator = Math.max(0, this.accumulator - this.step);
      if (!this.step) return;
    } else this.step = null;
    for (const bucket of this.cells.values()) { bucket.length = 0; this.pool.push(bucket); }
    this.cells.clear();
    for (const fish of members) {
      if (!fish.position || fish.alive === false) continue;
      fish.sample ||= new THREE.Vector3(); fish.sample.copy(fish.position);
      const key = cellKey(Math.floor(fish.sample.x / CELL), Math.floor(fish.sample.y / CELL), Math.floor(fish.sample.z / CELL));
      if (!this.cells.has(key)) this.cells.set(key, this.pool.pop() || []);
      this.cells.get(key).push(fish);
    }
  }

  advance(fish, target, delta, collisions) {
    if (!fish.position || fish.position.distanceToSquared(target) > 640000) {
      fish.position = target.clone(); fish.velocity = new THREE.Vector3(); fish.heading = fish.heading || 0;
      if (collisions) fish.position.copy(collisions.move(fish.position, fish.position, { radius: fish.size, dynamic: false }));
      fish.previousPosition = fish.position.clone(); fish.renderPosition = fish.position.clone(); fish.previousHeading = fish.heading;
    }
    if (!(delta > 0)) return fish.renderPosition || fish.position;
    const step = this.step ?? Math.min(delta, 0.1);
    if (!step) return this.interpolate(fish);
    fish.velocity ||= new THREE.Vector3();
    fish.previousPosition ||= fish.position.clone(); fish.previousPosition.copy(fish.position); fish.previousHeading = fish.heading;
    this.separation.set(0, 0, 0);
    const point = fish.sample || fish.position;
    const cellX = Math.floor(point.x / CELL); const cellY = Math.floor(point.y / CELL); const cellZ = Math.floor(point.z / CELL);
    for (let horizontal = -1; horizontal <= 1; horizontal++) for (let vertical = -1; vertical <= 1; vertical++) for (let depth = -1; depth <= 1; depth++) {
      const bucket = this.cells.get(cellKey(cellX + horizontal, cellY + vertical, cellZ + depth));
      if (!bucket) continue;
      for (const other of bucket) {
        if (other === fish) continue;
        this.direction.subVectors(point, other.sample);
        const distance = this.direction.length(); const clearance = (fish.size + other.size) * 1.4 + 0.6;
        if (distance >= clearance) continue;
        if (distance < 0.0001) this.direction.set(Math.cos(fish.phase), 0.3, Math.sin(fish.phase));
        else this.direction.divideScalar(distance);
        this.separation.addScaledVector(this.direction, (1 - distance / clearance) * 3.5);
      }
    }
    this.desired.subVectors(target, fish.position).multiplyScalar(1.25).add(this.separation.clampLength(0, 3.5));
    if (collisions) {
      const ahead = fish.position.clone().addScaledVector(fish.velocity, 1.2);
      const clear = collisions.avoidSmall(ahead, fish.size + 2.4);
      this.desired.add(clear.sub(ahead).clampLength(0, 6));
    }
    this.desired.clampLength(0, 4.5 + fish.size * 2);
    this.direction.copy(this.desired).sub(fish.velocity).clampLength(0, 7 * step);
    fish.velocity.add(this.direction);
    const destination = fish.position.clone().addScaledVector(fish.velocity, step);
    const next = collisions ? collisions.move(fish.position, destination, { radius: fish.size, dynamic: true }) : destination;
    this.direction.subVectors(next, fish.position);
    if (next.distanceToSquared(destination) > 0.00001) fish.velocity.copy(this.direction).divideScalar(step).clampLength(0, 4.5 + fish.size * 2);
    if (this.direction.x ** 2 + this.direction.z ** 2 > 0.000001) fish.heading = dampAngle(fish.heading, Math.atan2(-this.direction.x, -this.direction.z), 5, step);
    fish.position.copy(next);
    return this.interpolate(fish);
  }

  interpolate(fish) {
    fish.renderPosition ||= fish.position.clone();
    const alpha = this.step === null ? 1 : Math.min(1, this.accumulator / TICK);
    fish.renderPosition.lerpVectors(fish.previousPosition || fish.position, fish.position, alpha);
    const previousHeading = fish.previousHeading ?? fish.heading;
    fish.renderHeading = previousHeading + Math.atan2(Math.sin(fish.heading - previousHeading), Math.cos(fish.heading - previousHeading)) * alpha;
    return fish.renderPosition;
  }
}
