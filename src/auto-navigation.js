import * as THREE from 'three';

const AXES = ['x', 'y', 'z'];
const DIRECTIONS = [];
for (let horizontal = -1; horizontal <= 1; horizontal++) for (let vertical = -1; vertical <= 1; vertical++) for (let depth = -1; depth <= 1; depth++) {
  if (horizontal || vertical || depth) DIRECTIONS.push(new THREE.Vector3(horizontal, vertical, depth));
}

function intersectsBox(start, finish, box, clearance) {
  let entry = 0; let exit = 1;
  for (const axis of AXES) {
    const movement = finish[axis] - start[axis];
    const lower = box.min[axis] - clearance; const upper = box.max[axis] + clearance;
    if (Math.abs(movement) < 1e-10) {
      if (start[axis] < lower || start[axis] > upper) return false;
    } else {
      const first = (lower - start[axis]) / movement; const second = (upper - start[axis]) / movement;
      entry = Math.max(entry, Math.min(first, second)); exit = Math.min(exit, Math.max(first, second));
      if (entry > exit) return false;
    }
  }
  return true;
}

export function clearPassage(world, start, finish, { radius = 2.4, obstacles = [], floorClearance = 5 } = {}) {
  const distance = start.distanceTo(finish);
  const entries = distance < 48 ? world.candidates(start.clone().lerp(finish, 0.5), distance / 2 + radius * 1.74) : world.entries;
  for (const { box } of entries) if (intersectsBox(start, finish, box, radius)) return false;
  for (const box of obstacles) if (intersectsBox(start, finish, box, radius)) return false;
  const samples = Math.max(1, Math.ceil(distance / 2));
  for (let sample = 0; sample <= samples; sample++) {
    const fraction = sample / samples;
    const horizontal = THREE.MathUtils.lerp(start.x, finish.x, fraction); const depth = THREE.MathUtils.lerp(start.z, finish.z, fraction);
    if (THREE.MathUtils.lerp(start.y, finish.y, fraction) + 0.001 < world.floor(horizontal, depth) + floorClearance) return false;
  }
  return true;
}

class Frontier {
  constructor() { this.items = []; }
  push(node) {
    let index = this.items.length; this.items.push(node);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].score <= node.score) break;
      this.items[index] = this.items[parent]; index = parent;
    }
    this.items[index] = node;
  }
  pop() {
    const result = this.items[0]; const last = this.items.pop();
    if (this.items.length) {
      let index = 0;
      while (index * 2 + 1 < this.items.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1].score < this.items[child].score) child++;
        if (last.score <= this.items[child].score) break;
        this.items[index] = this.items[child]; index = child;
      }
      this.items[index] = last;
    }
    return result;
  }
}

function roundRoute(points, clear) {
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index++) {
    const corner = points[index]; const previous = points[index - 1]; const next = points[index + 1];
    const radius = Math.min(8, corner.distanceTo(previous) * 0.28, corner.distanceTo(next) * 0.28);
    const before = corner.clone().lerp(previous, radius / corner.distanceTo(previous));
    const after = corner.clone().lerp(next, radius / corner.distanceTo(next));
    const curve = [before];
    for (let sample = 1; sample <= 8; sample++) {
      const fraction = sample / 8;
      curve.push(before.clone().multiplyScalar((1 - fraction) ** 2).addScaledVector(corner, 2 * fraction * (1 - fraction)).addScaledVector(after, fraction ** 2));
    }
    if (curve.every((point, sample) => clear(sample ? curve[sample - 1] : result.at(-1), point))) result.push(...curve);
    else result.push(corner);
  }
  result.push(points.at(-1));
  return result.filter((point, index) => !index || point.distanceToSquared(result[index - 1]) > 1e-8);
}

function broadPassages(start, goal) {
  const routes = []; const direction = goal.clone().sub(start).normalize();
  const sideways = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  for (const height of [24, 48, 72, 96]) {
    const first = start.clone().lerp(goal, 0.24); const second = start.clone().lerp(goal, 0.76);
    first.y = second.y = Math.max(start.y, goal.y) + height;
    routes.push([start, first, second, goal]);
  }
  for (const distance of [36, -36, 72, -72, 144, -144, 240, -240]) {
    routes.push([start, start.clone().lerp(goal, 0.22).addScaledVector(sideways, distance), start.clone().lerp(goal, 0.78).addScaledVector(sideways, distance), goal]);
  }
  return routes.sort((first, second) => routeLength(first) - routeLength(second));
}

function routeLength(points) { return points.reduce((length, point, index) => length + (index ? point.distanceTo(points[index - 1]) : 0), 0); }

export class PassagePlanner {
  constructor(world, start, goal, { indoor = false, obstacles = [], maxNodes = 6000 } = {}) {
    this.world = world; this.start = start.clone(); this.goal = goal.clone(); this.options = { obstacles };
    this.spacing = indoor ? 3 : 12; this.maxNodes = maxNodes; this.expanded = 0; this.status = 'planning';
    this.frontier = new Frontier(); this.costs = new Map(); this.closed = new Set();
    const margin = indoor ? 36 : Math.min(180, Math.max(60, start.distanceTo(goal) * 0.35));
    this.bounds = new THREE.Box3().setFromPoints([start, goal]).expandByVector(new THREE.Vector3(margin, indoor ? 1.5 : 96, margin));
    this.frontier.push({ point: start.clone(), grid: new THREE.Vector3(), key: '0,0,0', cost: 0, score: start.distanceTo(goal), parent: null });
    this.costs.set('0,0,0', 0);
    this.broad = !indoor && start.distanceTo(goal) > 160 ? broadPassages(start, goal) : [];
    this.initialized = false;
  }
  clear(start, finish) { return clearPassage(this.world, start, finish, this.options); }
  step(limit = 64, milliseconds = 3) {
    if (this.status !== 'planning') return this.status;
    const deadline = performance.now() + milliseconds;
    if (!this.initialized) {
      this.initialized = true;
      if (!this.clear(this.start, this.start) || !this.clear(this.goal, this.goal)) { this.status = 'blocked'; return this.status; }
      if (this.clear(this.start, this.goal)) { this.points = [this.start, this.goal]; this.status = 'ready'; return this.status; }
    }
    while (this.broad.length && performance.now() < deadline) {
      const points = this.broad.shift();
      if (points.every((point, index) => !index || this.clear(points[index - 1], point))) {
        this.points = roundRoute(points, (start, finish) => this.clear(start, finish)); this.status = 'ready'; return this.status;
      }
    }
    if (this.broad.length) return this.status;
    for (let count = 0; count < limit && performance.now() < deadline; count++) {
      if (!this.frontier.items.length || this.expanded >= this.maxNodes) { this.status = 'blocked'; break; }
      const current = this.frontier.pop();
      if (this.closed.has(current.key)) continue;
      this.closed.add(current.key); this.expanded++;
      if (this.clear(current.point, this.goal)) {
        const points = [this.goal.clone()];
        for (let node = current; node; node = node.parent) points.unshift(node.point);
        const simplified = [points[0]];
        for (let index = 0; index < points.length - 1;) {
          let next = points.length - 1;
          while (next > index + 1 && !this.clear(points[index], points[next])) next--;
          simplified.push(points[next]); index = next;
        }
        this.points = roundRoute(simplified, (start, finish) => this.clear(start, finish)); this.status = 'ready'; break;
      }
      for (const direction of DIRECTIONS) {
        const grid = current.grid.clone().add(direction); const key = grid.toArray().join(',');
        if (this.closed.has(key)) continue;
        const point = grid.clone().multiplyScalar(this.spacing).add(this.start);
        if (!this.bounds.containsPoint(point)) continue;
        const cost = current.cost + current.point.distanceTo(point);
        if (cost >= (this.costs.get(key) ?? Infinity) || !this.clear(current.point, point)) continue;
        this.costs.set(key, cost);
        this.frontier.push({ point, grid, key, cost, score: cost + point.distanceTo(this.goal) * 1.25, parent: current });
      }
    }
    return this.status;
  }
}

function dynamicObstacles(world, position) {
  const obstacles = [];
  for (const body of world.bodies.values()) {
    if (body.position.distanceTo(position) > body.extent + 150) continue;
    const drift = body.velocity.clone().multiplyScalar(1.2);
    for (const probe of body.hull) {
      const center = body.position.clone().add(probe.offset);
      const box = new THREE.Box3().setFromPoints([center, center.clone().add(drift)]).expandByScalar(probe.radius + 1);
      if (!box.clone().expandByScalar(2.4).containsPoint(position)) obstacles.push(box);
    }
  }
  return obstacles;
}

export function movingObstacleAhead(world, start, finish, seconds) {
  const relative = new THREE.Vector3(); const motion = new THREE.Vector3();
  for (const body of world.bodies.values()) {
    if (body.position.distanceTo(start) > body.extent + start.distanceTo(finish) + body.velocity.length() * seconds + 6) continue;
    for (const probe of body.hull) {
      relative.copy(start).sub(body.position).sub(probe.offset);
      motion.copy(finish).sub(start).addScaledVector(body.velocity, -seconds);
      const fraction = THREE.MathUtils.clamp(-relative.dot(motion) / Math.max(1e-10, motion.lengthSq()), 0, 1);
      if (relative.addScaledVector(motion, fraction).lengthSq() < (probe.radius + 3.4) ** 2) return true;
    }
  }
  return false;
}

export class AutoNavigation {
  constructor(world) { this.world = world; this.status = 'idle'; this.direction = new THREE.Vector3(0, 0, -1); }
  start(position, goal, { indoor = false, through = false, speed = 0 } = {}) {
    this.goal = goal.clone(); this.indoor = indoor; this.through = through; this.speed = Math.min(4, Math.max(0, speed)); this.elapsed = 0; this.waited = 0; this.retry = 0;
    this.distance = 0; this.replans = 0; this.points = []; this.pending = false; this.reason = null; this.stalled = 0; this.lastProgress = 0;
    this.direction.copy(goal).sub(position).normalize(); this.plan(position, false);
  }
  cancel() { this.status = 'cancelled'; this.speed = 0; this.planner = null; this.points = []; }
  plan(position, dynamic) {
    this.planner = new PassagePlanner(this.world, position, this.goal, { indoor: this.indoor, obstacles: dynamic ? dynamicObstacles(this.world, position) : [] });
    this.dynamicPlan = dynamic; this.status = dynamic ? 'avoiding' : 'planning'; this.pending = false;
    this.replans++; this.retry = 0.5;
  }
  remaining(position) {
    let distance = 0; let previous = position;
    for (const point of this.points) { distance += previous.distanceTo(point); previous = point; }
    return this.points.length ? distance : position.distanceTo(this.goal);
  }
  sample(position, distance) {
    let previous = position;
    for (const point of this.points) {
      const segment = previous.distanceTo(point);
      if (distance <= segment) return previous.clone().lerp(point, distance / Math.max(1e-10, segment));
      distance -= segment; previous = point;
    }
    return previous.clone();
  }
  step(delta, position) {
    const result = position.clone();
    if (delta <= 0 || ['idle', 'cancelled', 'blocked', 'arrived'].includes(this.status)) return result;
    const seconds = Math.min(delta, 0.1); this.elapsed += seconds; this.retry = Math.max(0, this.retry - seconds);
    if (this.distance - this.lastProgress >= 1) { this.stalled = 0; this.lastProgress = this.distance; }
    else this.stalled += seconds;
    if (this.stalled > 24) { this.status = 'blocked'; this.reason = 'occupied'; this.planner = null; this.speed = 0; return result; }
    if (this.planner) {
      const status = this.planner.step();
      if (status === 'planning') return result;
      if (status === 'ready') {
        this.points = this.planner.points.slice(1); this.status = 'sailing'; this.reason = null; this.waited = 0;
        while (this.points.length && position.distanceToSquared(this.points[0]) < 1e-8) this.points.shift();
        if (!this.points.length) this.status = 'arrived';
        this.detour = this.remaining(position) > position.distanceTo(this.goal) + 1;
      } else {
        this.status = this.dynamicPlan ? 'waiting' : 'blocked'; this.reason = this.dynamicPlan ? 'marine-life' : 'no-passage'; this.retry = 1;
      }
      this.planner = null;
      return result;
    }
    if (this.status === 'waiting') {
      this.waited += seconds;
      if (this.waited >= 20) { this.status = 'blocked'; this.reason = 'occupied'; }
      else if (!this.retry) this.plan(position, true);
      return result;
    }
    const acceleration = this.indoor ? 8 : 18; const maximum = this.indoor ? 12 : 48;
    const remaining = this.remaining(position);
    const lookDistance = Math.min(remaining, this.speed ** 2 / (2 * acceleration) + this.speed * 0.9 + 9);
    const ahead = this.sample(position, lookDistance);
    let clear = true; let previous = position; let checked = 0;
    for (const point of this.points) {
      const distance = previous.distanceTo(point); const end = checked + distance > lookDistance ? ahead : point;
      if (!clearPassage(this.world, previous, end)) { clear = false; break; }
      checked += distance; previous = point;
      if (checked >= lookDistance) break;
    }
    const occupied = movingObstacleAhead(this.world, position, ahead, Math.min(3, lookDistance / Math.max(8, this.speed)));
    if (!clear || occupied) { this.pending = true; this.reason = occupied ? 'marine-life' : 'new-obstacle'; }
    let targetSpeed = this.through ? Math.min(maximum, Math.sqrt(16 + 2 * acceleration * remaining) * 0.68) : Math.min(maximum, remaining * 1.2, Math.sqrt(2 * acceleration * remaining) * 0.68);
    let untilCorner = 0; previous = position;
    for (let index = 0; index < this.points.length - 1; index++) {
      const point = this.points[index]; untilCorner += previous.distanceTo(point);
      const incoming = point.clone().sub(previous).normalize(); const outgoing = this.points[index + 1].clone().sub(point).normalize();
      const cornerSpeed = Math.max(1.5, maximum * Math.max(0, incoming.dot(outgoing)) ** 10);
      targetSpeed = Math.min(targetSpeed, Math.sqrt(cornerSpeed ** 2 + 2 * acceleration * untilCorner));
      previous = point;
      if (untilCorner > 90) break;
    }
    if (this.pending) { targetSpeed = 0; this.status = 'avoiding'; }
    this.speed += THREE.MathUtils.clamp(targetSpeed - this.speed, -acceleration * seconds, acceleration * seconds);
    if (this.pending && this.speed < 0.05) {
      this.speed = 0;
      if (!this.retry) this.plan(position, this.reason === 'marine-life');
      return result;
    }
    let travel = Math.min(remaining, this.speed * seconds);
    if (remaining < 0.04 && this.speed < 0.2) travel = remaining;
    while (travel > 1e-8 && this.points.length) {
      const waypoint = this.points[0]; const distance = result.distanceTo(waypoint);
      const desired = result.clone().lerp(waypoint, Math.min(1, travel / Math.max(distance, 1e-10)));
      if (!clearPassage(this.world, result, desired, { radius: 2.05 })) { this.speed = 0; this.plan(result, false); break; }
      const safe = this.world.move(result, desired, { radius: 2 });
      const displacement = safe.clone().sub(result);
      if (displacement.lengthSq() > 1e-8) this.direction.copy(displacement).normalize();
      this.distance += displacement.length(); result.copy(safe);
      if (safe.distanceToSquared(desired) > 0.0025) { this.speed = 0; this.plan(result, true); break; }
      travel -= distance;
      if (result.distanceToSquared(waypoint) < 1e-8) this.points.shift();
    }
    if (!this.points.length && result.distanceTo(this.goal) < 0.05 && !this.planner) { this.status = 'arrived'; this.speed = this.through ? Math.min(4, this.speed) : 0; }
    return result;
  }
  inspect(position) {
    return { status: this.status, reason: this.reason, remaining: this.goal ? Math.round(this.remaining(position)) : 0, speed: this.speed || 0, elapsed: this.elapsed || 0, replans: this.replans || 0, detour: Boolean(this.detour), waypoints: this.points?.length || 0, destination: this.goal?.toArray() || null };
  }
}
