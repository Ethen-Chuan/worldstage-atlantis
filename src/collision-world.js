import * as THREE from 'three';
import { seaHeight } from './terrain.js';

const CELL_SIZE = 20;
const SKIN = 0.035;
const PROFILES = {
  whale: [[0, 0, -13, 2.9], [0, 0, -9, 4], [0, 0, -4, 4.3], [0, 0, 1, 4], [0, 0, 6, 3.2], [0, 0, 10, 2.7], [0, 0, 14, 2.5], [0, 0, 18, 3], [-6, -3, -2, 3.5], [6, -3, -2, 3.5], [-10, -5, 1, 3.4], [10, -5, 1, 3.4], [-4, 0, 19, 3.7], [4, 0, 19, 3.7]],
  shark: [[0, 0, -4.6, 1.4], [0, 0, -2.2, 1.5], [0, 0, 0, 1.5], [0, 0, 2.5, 1.3], [0, 0.6, 6, 2.7], [0, 1.8, -1.2, 1.7], [-2.1, -0.8, -0.4, 1.9], [2.1, -0.8, -0.4, 1.9]],
  mermaid: [[0, 2.9, 0, 0.7], [0, 1.3, 0, 1], [0, -0.7, 0.2, 1], [0, -2.5, 0.7, 1], [0.3, -4, 1.6, 1], [-1.4, -5.6, 2.2, 1.7], [1.4, -5.6, 2.2, 1.7]],
  manta: [[0, 0, -1, 2.7], [0, 0, 2, 2], [-3, 0, 0.5, 2.6], [3, 0, 0.5, 2.6], [-6, 0, 1, 2.6], [6, 0, 1, 2.6], [0, 0, 5, 1], [0.5, 0, 8, 1]],
};

function visible(object) {
  for (let ancestor = object; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return false;
  return true;
}

function belongsTo(object, root) {
  for (let ancestor = object; ancestor; ancestor = ancestor.parent) if (ancestor === root) return true;
  return false;
}

function boxDistanceSquared(point, box) {
  const horizontal = Math.max(box.min.x - point.x, 0, point.x - box.max.x);
  const vertical = Math.max(box.min.y - point.y, 0, point.y - box.max.y);
  const depth = Math.max(box.min.z - point.z, 0, point.z - box.max.z);
  return horizontal * horizontal + vertical * vertical + depth * depth;
}

export function separateSphere(point, radius, box, target = new THREE.Vector3()) {
  target.set(point.x - Math.max(box.min.x, Math.min(box.max.x, point.x)), point.y - Math.max(box.min.y, Math.min(box.max.y, point.y)), point.z - Math.max(box.min.z, Math.min(box.max.z, point.z)));
  const squared = target.lengthSq();
  if (squared >= radius * radius) return target.set(0, 0, 0);
  if (squared > 0.0000000001) { const distance = Math.sqrt(squared); return target.multiplyScalar((radius - distance + SKIN) / distance); }
  let nearest = point.x - box.min.x; let axis = 'x'; let sign = -1;
  for (const component of ['x', 'y', 'z']) {
    const lower = point[component] - box.min[component]; const upper = box.max[component] - point[component];
    if (lower < nearest) { nearest = lower; axis = component; sign = -1; }
    if (upper < nearest) { nearest = upper; axis = component; sign = 1; }
  }
  target.set(0, 0, 0); target[axis] = sign * (nearest + radius + SKIN); return target;
}

export function actorHull(actor) {
  const shape = actor.shape || actor.root;
  shape.updateWorldMatrix(true, false);
  const origin = actor.root.getWorldPosition(new THREE.Vector3());
  const scale = shape.getWorldScale(new THREE.Vector3());
  let profile = PROFILES[actor.species];
  if (!profile) {
    if (!shape.userData.collisionProfile) {
      const inverse = shape.matrixWorld.clone().invert(); const bounds = new THREE.Box3();
      shape.traverse(object => {
        if (!object.isMesh || object.isInstancedMesh) return;
        object.updateWorldMatrix(true, false); object.geometry.computeBoundingBox();
        bounds.union(object.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld)));
      });
      if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
      const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3());
      const axis = size.y > size.x && size.y > size.z ? 'y' : size.x > size.z ? 'x' : 'z';
      const otherAxes = ['x', 'y', 'z'].filter(key => key !== axis);
      const radius = Math.max(0.6, Math.hypot(...otherAxes.map(key => size[key] * 0.5)) + 0.3);
      const count = Math.max(1, Math.ceil(size[axis] / radius));
      shape.userData.collisionProfile = Array.from({ length: count }, (_, index) => {
        const point = center.clone(); point[axis] += size[axis] * ((index + 0.5) / count - 0.5);
        return [...point.toArray(), Math.hypot(radius, size[axis] / count / 2)];
      });
    }
    profile = shape.userData.collisionProfile;
  }
  const largestScale = Math.max(scale.x, scale.y, scale.z);
  return profile.map(([horizontal, vertical, depth, radius]) => ({ offset: new THREE.Vector3(horizontal, vertical, depth).applyMatrix4(shape.matrixWorld).sub(origin), radius: Math.max(0.2, radius * largestScale) }));
}

export class CollisionWorld {
  constructor({ floor = seaHeight } = {}) {
    this.floor = floor; this.cells = new Map(); this.sources = new Map(); this.entries = [];
    this.previous = new WeakMap(); this.bodies = new Map(); this.contacts = 0; this.dynamicContacts = 0; this.rebuilds = 0;
    this.queryId = 0; this.moveCandidates = []; this.penetrationCandidates = []; this.penetrationCenter = new THREE.Vector3();
  }

  rebuild(roots, offset = new THREE.Vector3()) {
    const sources = [];
    for (const root of roots.filter(Boolean)) {
      root.updateWorldMatrix(true, true);
      root.traverseVisible(object => { if (object.userData.collisionBoxes?.length) sources.push(object); });
    }
    let changed = sources.length !== this.sources.size;
    const nextSources = new Map();
    for (const source of sources) {
      const matrix = source.matrixWorld.clone(); matrix.elements[12] += offset.x; matrix.elements[13] += offset.y; matrix.elements[14] += offset.z;
      const previous = this.sources.get(source);
      if (previous?.matrix.equals(matrix) && previous.bounds === source.userData.collisionBoxes) nextSources.set(source, previous);
      else {
        changed = true;
        nextSources.set(source, { matrix, bounds: source.userData.collisionBoxes, entries: source.userData.collisionBoxes.map(bounds => ({ source, box: new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max)).applyMatrix4(matrix) })) });
      }
    }
    this.sources = nextSources;
    if (!changed) return;
    this.rebuilds++; this.cells.clear(); this.entries = [...nextSources.values()].flatMap(source => source.entries);
    for (const entry of this.entries) this.eachCell(entry.box, key => {
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(entry);
    });
  }

  eachCell(box, visit) {
    for (let horizontal = Math.floor(box.min.x / CELL_SIZE); horizontal <= Math.floor(box.max.x / CELL_SIZE); horizontal++) {
      for (let vertical = Math.floor(box.min.y / CELL_SIZE); vertical <= Math.floor(box.max.y / CELL_SIZE); vertical++) {
        for (let depth = Math.floor(box.min.z / CELL_SIZE); depth <= Math.floor(box.max.z / CELL_SIZE); depth++) visit(`${horizontal}:${vertical}:${depth}`);
      }
    }
  }

  candidates(center, radius, entries = []) {
    entries.length = 0; const query = ++this.queryId;
    const maxHorizontal = Math.floor((center.x + radius) / CELL_SIZE); const maxVertical = Math.floor((center.y + radius) / CELL_SIZE); const maxDepth = Math.floor((center.z + radius) / CELL_SIZE);
    for (let horizontal = Math.floor((center.x - radius) / CELL_SIZE); horizontal <= maxHorizontal; horizontal++) {
      for (let vertical = Math.floor((center.y - radius) / CELL_SIZE); vertical <= maxVertical; vertical++) {
        for (let depth = Math.floor((center.z - radius) / CELL_SIZE); depth <= maxDepth; depth++) {
          const bucket = this.cells.get(`${horizontal}:${vertical}:${depth}`);
          if (!bucket) continue;
          for (const entry of bucket) {
            if (entry.query === query) continue;
            entry.query = query;
            if (boxDistanceSquared(center, entry.box) < radius * radius) entries.push(entry);
          }
        }
      }
    }
    return entries;
  }

  beginBodies(actors, offset, active) {
    this.bodies.clear();
    for (const actor of actors) {
      if (!visible(actor.root) && active?.root !== actor.root) continue;
      const hull = actor.root === active?.root && active.hull ? active.hull : actorHull(actor);
      const desired = actor.root === active?.root && active.position ? active.position.clone() : actor.root.getWorldPosition(new THREE.Vector3()).add(offset);
      const previous = this.previous.get(actor.root);
      const position = previous && actor.root !== active?.root && !actor.kinematic && previous.desired.distanceToSquared(desired) <= 25600 ? previous.position.clone() : desired.clone();
      this.bodies.set(actor.root, { actor, hull, position, desired, extent: Math.max(...hull.map(probe => probe.offset.length() + probe.radius)) });
    }
  }

  move(start, destination, { radius = 2, hull = [{ offset: new THREE.Vector3(), radius }], previousHull = hull, ignore = null, dynamic = true } = {}) {
    const result = start.clone();
    const displacement = destination.clone().sub(start);
    const rotationTravel = Math.max(0, ...hull.map((probe, index) => probe.offset.distanceTo(previousHull[index]?.offset || probe.offset)));
    const stride = Math.max(0.08, Math.min(...hull.map(probe => probe.radius)) * 0.4);
    const requestedSteps = Math.max(1, Math.ceil((displacement.length() + rotationTravel) / stride));
    if (requestedSteps > 1024) return result;
    displacement.divideScalar(requestedSteps);
    const before = new THREE.Vector3(); const center = new THREE.Vector3(); const correction = new THREE.Vector3();
    const probes = hull.map(probe => ({ radius: probe.radius, offset: new THREE.Vector3() }));
    for (let step = 1; step <= requestedSteps; step++) {
      before.copy(result); result.add(displacement);
      for (let index = 0; index < hull.length; index++) probes[index].offset.lerpVectors(previousHull[index]?.offset || hull[index].offset, hull[index].offset, step / requestedSteps);
      for (let pass = 0; pass < 6; pass++) {
        let touched = false;
        for (const probe of probes) {
          center.copy(result).add(probe.offset);
          for (const entry of this.candidates(center, probe.radius, this.moveCandidates)) {
            if (ignore && belongsTo(entry.source, ignore)) continue;
            separateSphere(center, probe.radius, entry.box, correction);
            if (correction.lengthSq()) { result.add(correction); center.add(correction); touched = true; this.contacts++; }
          }
          if (dynamic) for (const [root, body] of this.bodies) {
            if (root === ignore || result.distanceToSquared(body.position) > (body.extent + probe.offset.length() + probe.radius) ** 2) continue;
            for (const other of body.hull) {
              correction.copy(center).sub(body.position).sub(other.offset); const squared = correction.lengthSq();
              const clearance = probe.radius + other.radius + 0.25;
              if (squared >= clearance * clearance) continue;
              const distance = Math.sqrt(squared);
              if (distance < 0.00001) correction.set(1, 0, 0); else correction.divideScalar(distance);
              correction.multiplyScalar(clearance - distance + SKIN); result.add(correction); center.add(correction); touched = true; this.dynamicContacts++;
            }
          }
          const floor = this.floor(center.x, center.z) + probe.radius + SKIN;
          if (center.y < floor) { result.y += floor - center.y; touched = true; }
        }
        if (!touched) break;
      }
      if (this.penetration(result, probes, ignore) > 0.05 && this.penetration(before, probes, ignore) < 0.05) { result.copy(before); break; }
    }
    return result;
  }

  penetration(position, hull, ignore = null) {
    let depth = 0;
    for (const probe of hull) {
      const center = this.penetrationCenter.copy(position).add(probe.offset);
      for (const entry of this.candidates(center, probe.radius, this.penetrationCandidates)) if (!ignore || !belongsTo(entry.source, ignore)) depth = Math.max(depth, probe.radius - Math.sqrt(boxDistanceSquared(center, entry.box)));
      depth = Math.max(depth, this.floor(center.x, center.z) + probe.radius - center.y);
    }
    return depth;
  }

  avoidSmall(position, radius = 1) {
    const result = position.clone();
    for (let pass = 0; pass < 2; pass++) for (const body of this.bodies.values()) {
      if (result.distanceToSquared(body.position) > (body.extent + radius + 1) ** 2) continue;
      for (const probe of body.hull) {
        let horizontal = result.x - body.position.x - probe.offset.x; let vertical = result.y - body.position.y - probe.offset.y; let depth = result.z - body.position.z - probe.offset.z;
        const squared = horizontal * horizontal + vertical * vertical + depth * depth;
        const clearance = probe.radius + radius + 0.6;
        if (squared >= clearance * clearance) continue;
        const distance = Math.sqrt(squared);
        if (distance < 0.00001) { horizontal = 0; vertical = 1; depth = 0; }
        else { horizontal /= distance; vertical /= distance; depth /= distance; }
        const separation = clearance - distance;
        result.x += horizontal * separation; result.y += vertical * separation; result.z += depth * separation;
      }
    }
    return result;
  }

  natural(actor, offset, delta) {
    const body = this.bodies.get(actor.root);
    if (!body || !(delta > 0)) return null;
    const desired = body.desired.clone(); const previous = this.previous.get(actor.root);
    const relocated = !previous || previous.desired.distanceTo(desired) > 160;
    let start = relocated ? desired.clone() : previous.position.clone();
    if (relocated) {
      for (let attempt = 0; attempt < 120 && this.penetration(start, body.hull, actor.root) > 0; attempt++) start.y += 2;
    }
    const direction = desired.clone().sub(start);
    const maxSpeed = actor.species === 'whale' ? 22 : actor.species === 'shark' ? 18 : 11;
    let avoidance = previous?.avoidance || new THREE.Vector3(); let probeDelay = (previous?.probeDelay || 0) - delta;
    if (!relocated && direction.lengthSq() > 0.0001) {
      if (probeDelay <= 0) {
        const ahead = start.clone().addScaledVector(direction.clone().normalize(), Math.min(direction.length() + 8, body.extent * 0.7 + 8));
        avoidance = this.move(start, ahead, { hull: body.hull, ignore: actor.root }).sub(ahead); probeDelay = 0.15;
      }
      if (avoidance.lengthSq() > 0.05) {
        const normal = avoidance.clone().normalize(); const tangent = new THREE.Vector3(-normal.z, 0, normal.x);
        if (tangent.dot(direction) < 0) tangent.negate();
        direction.addScaledVector(normal, Math.max(4, direction.length() * 0.8)).addScaledVector(tangent, 6);
      }
      direction.clampLength(0, maxSpeed * delta);
    } else direction.set(0, 0, 0);
    const corrected = this.move(start, start.clone().add(direction), { hull: body.hull, previousHull: relocated ? body.hull : previous.hull, ignore: actor.root });
    actor.root.parent.updateWorldMatrix(true, false); actor.root.position.copy(actor.root.parent.worldToLocal(corrected.clone().sub(offset)));
    body.position.copy(corrected); this.previous.set(actor.root, { position: corrected.clone(), desired, hull: body.hull, avoidance, probeDelay });
    return corrected;
  }

  remember(actor, position) {
    const body = this.bodies.get(actor.root); if (body) body.position.copy(position);
    this.previous.set(actor.root, { position: position.clone(), desired: position.clone(), hull: actorHull(actor) });
  }

  inspect() { return { model: 'compound-sphere-kinematic', staticParts: this.entries.length, bodies: this.bodies.size, contacts: this.contacts, dynamicContacts: this.dynamicContacts, rebuilds: this.rebuilds }; }
}
