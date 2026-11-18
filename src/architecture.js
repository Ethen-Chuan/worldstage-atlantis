import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { seededRandom } from './core.js';
export { makeMaterials, prepareSurfaces } from './surfaces.js';

export function buildAtlantis(scene, materials) {
  const random = seededRandom(27091);
  const noise = new SimplexNoise({ random });
  const group = new THREE.Group();
  group.name = 'Atlantis — The Drowned Crown';
  const batches = new Map();
  const transform = new THREE.Object3D();
  const geometries = {
    box: new RoundedBoxGeometry(1, 1, 1, 1, 0.035),
    sharp: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
    taper: new THREE.CylinderGeometry(0.82, 1, 1, 16, 1),
    cone: new THREE.ConeGeometry(1, 1, 16),
    sphere: new THREE.SphereGeometry(1, 6, 4),
    ring: new THREE.TorusGeometry(1, 0.018, 6, 96),
  };
  const flute = new THREE.CylinderGeometry(0.88, 1, 1, 48, 1);
  for (let index = 0; index < flute.attributes.position.count; index++) {
    const position = flute.attributes.position;
    const horizontal = position.getX(index);
    const depth = position.getZ(index);
    const angle = Math.atan2(depth, horizontal);
    const inset = 1 - 0.055 * Math.cos(angle * 20) + noise.noise3d(horizontal * 8, position.getY(index) * 15, depth * 8) * 0.016;
    position.setX(index, horizontal * inset);
    position.setZ(index, depth * inset);
  }
  flute.computeVertexNormals();
  geometries.flute = flute;
  for (let variant = 0; variant < 5; variant++) {
    const geometry = new THREE.IcosahedronGeometry(1, 3);
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const horizontal = positions.getX(index);
      const vertical = positions.getY(index);
      const depth = positions.getZ(index);
      const displacement = 1 + noise.noise3d(horizontal * 2.5 + variant * 10, vertical * 2.5, depth * 2.5) * 0.27 + noise.noise3d(horizontal * 8, vertical * 8, depth * 8) * 0.085;
      positions.setXYZ(index, horizontal * displacement, vertical * displacement, depth * displacement);
    }
    geometry.computeVertexNormals();
    geometries[`rock${variant}`] = geometry;
  }

  function add(type, material, position, scale, rotation = [0, 0, 0]) {
    const key = `${type}:${material}`;
    if (!batches.has(key)) batches.set(key, { geometry: geometries[type], material: materials[material], matrices: [] });
    transform.position.set(...position);
    transform.scale.set(...scale);
    transform.rotation.set(...rotation);
    transform.updateMatrix();
    batches.get(key).matrices.push(transform.matrix.clone());
  }
  function custom(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry, materials[material]);
    object.position.set(...position);
    object.rotation.set(...rotation);
    group.add(object);
    return object;
  }
  function tube(points, radius, material, segments = 32) {
    return custom(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), segments, radius, 6, false), material);
  }
  function rock(position, size, variant = 0, rotation = [0, 0, 0]) {
    add(`rock${variant % 5}`, 'rock', position, size, rotation);
  }
  function column(horizontal, base, depth, height, radius = 1.5, broken = false, fancy = true) {
    add('box', 'dark', [horizontal, base + 0.6, depth], [radius * 3.4, 1.2, radius * 3.4]);
    add('cylinder', 'pale', [horizontal, base + 1.4, depth], [radius * 1.45, 0.45, radius * 1.45]);
    add('cylinder', 'stone', [horizontal, base + 2, depth], [radius * 1.25, 0.75, radius * 1.25]);
    const sections = fancy ? Math.max(2, Math.floor(height / 4)) : 1;
    for (let section = 0; section < sections; section++) {
      if (broken && section > Math.floor(sections * 0.5)) break;
      const size = (height - 4.8) / sections;
      const taper = 1 - section / sections * 0.11;
      add(fancy ? 'flute' : 'taper', 'pale', [horizontal + (broken ? section * 0.04 : 0), base + 2.5 + size * (section + 0.5), depth], [radius * taper, size * 0.989, radius * taper], [0, section * 0.003, 0]);
    }
    if (broken) {
      rock([horizontal, base + height * 0.56, depth], [radius * 0.9, 0.7, radius * 0.9], 2);
      return;
    }
    add('cylinder', 'gold', [horizontal, base + height - 2.7, depth], [radius, 0.18, radius]);
    add('cylinder', 'stone', [horizontal, base + height - 1.85, depth], [radius * 1.24, 1.5, radius * 1.24]);
    add('cylinder', 'pale', [horizontal, base + height - 0.85, depth], [radius * 1.57, 0.5, radius * 1.57]);
    add('box', 'pale', [horizontal, base + height - 0.3, depth], [radius * 3.15, 0.6, radius * 3.15]);
    if (fancy) {
      for (let leaf = 0; leaf < 8; leaf++) {
        const angle = leaf / 8 * Math.PI * 2;
        add('sphere', 'pale', [horizontal + Math.cos(angle) * radius * 1.1, base + height - 1.85, depth + Math.sin(angle) * radius * 1.1], [radius * 0.37, 0.95, radius * 0.22], [Math.sin(angle) * 0.35, angle, Math.cos(angle) * 0.35]);
      }
    }
  }
  function arcSegment(radius, thickness, depth, start, end) {
    const outline = new THREE.Shape();
    outline.absarc(0, 0, radius + thickness / 2, start, end, false);
    outline.absarc(0, 0, radius - thickness / 2, end, start, true);
    outline.closePath();
    return new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.07, bevelSegments: 1, steps: 1, curveSegments: 5 });
  }
  function arch(horizontal, base, depth, radius, thickness, broken = false) {
    const pieces = Math.ceil(radius * 1.1);
    for (let index = 0; index < pieces; index++) {
      const fraction = index / pieces;
      if (broken && fraction > 0.69 && fraction < 0.82) continue;
      custom(arcSegment(radius, thickness, thickness * 1.4, fraction * Math.PI + 0.003, (index + 1) / pieces * Math.PI - 0.003), index % 7 === 0 ? 'pale' : 'stone', [horizontal, base, depth]);
    }
    for (const inset of [-thickness * 0.38, thickness * 0.38]) {
      const path = [];
      const extent = broken ? 0.68 : 1;
      for (let step = 0; step <= 72; step++) {
        const angle = step / 72 * Math.PI * extent;
        path.push([horizontal + Math.cos(angle) * (radius + inset), base + Math.sin(angle) * (radius + inset), depth + thickness * 1.45]);
      }
      tube(path, 0.19, 'gold', 72);
    }
    for (let index = 0; index < 20; index++) {
      if (broken && index > 13 && index < 17) continue;
      const angle = (index + 0.5) / 20 * Math.PI;
      add('box', 'pale', [horizontal + Math.cos(angle) * radius, base + Math.sin(angle) * radius, depth + thickness * 1.5], [thickness * 0.44, thickness * 0.52, 0.4], [0, 0, angle]);
      add('sphere', 'gold', [horizontal + Math.cos(angle) * radius, base + Math.sin(angle) * radius, depth + thickness * 1.61], [0.2, 0.2, 0.1]);
    }
  }
  function rings(horizontal, depth, base, radius, layers = 3) {
    for (let layer = 0; layer < layers; layer++) {
      add('cylinder', layer % 2 ? 'pale' : 'stone', [horizontal, base + layer * 0.85, depth], [radius - layer * 0.6, 0.85, radius - layer * 0.6]);
    }
  }
  function colonnade(horizontal, depth, base, radius, height, count, complete = true) {
    for (let index = 0; index < count; index++) {
      const angle = (index + 0.5) / count * Math.PI * 2;
      column(horizontal + Math.cos(angle) * radius, base, depth + Math.sin(angle) * radius, height, Math.max(0.8, radius * 0.045), !complete && index % 7 === 2, count < 34);
    }
    rings(horizontal, depth, base + height, radius + 2, 3);
    for (let index = 0; index < count * 2; index++) {
      const angle = index / (count * 2) * Math.PI * 2;
      add('box', 'pale', [horizontal + Math.cos(angle) * (radius + 2), base + height + 0.5, depth + Math.sin(angle) * (radius + 2)], [0.55, 1.2, 1.2], [0, -angle, 0]);
    }
  }
  function dome(horizontal, depth, base, radius, height, damaged = false) {
    const panels = 32;
    for (let panel = 0; panel < panels; panel++) {
      if (damaged && [5, 6, 7, 15].includes(panel)) continue;
      const geometry = new THREE.SphereGeometry(radius, 4, 24, panel / panels * Math.PI * 2, Math.PI * 2 / panels * 0.992, 0, Math.PI / 2);
      geometry.scale(1, height / radius, 1);
      custom(geometry, 'copper', [horizontal, base, depth]);
    }
    for (let rib = 0; rib < 24; rib++) {
      const angle = rib / 24 * Math.PI * 2;
      const path = [];
      for (let step = 0; step <= 24; step++) {
        const arc = step / 24 * Math.PI / 2;
        path.push([horizontal + Math.cos(angle) * Math.sin(arc) * (radius + 0.1), base + Math.cos(arc) * height, depth + Math.sin(angle) * Math.sin(arc) * (radius + 0.1)]);
      }
      tube(path, 0.16, 'gold', 24);
    }
    rings(horizontal, depth, base - 1, radius + 0.4, 2);
    for (let tier = 0; tier < 3; tier++) add('cylinder', 'gold', [horizontal, base + height + tier * 1.1, depth], [1.6 - tier * 0.4, 0.55, 1.6 - tier * 0.4]);
    add('cone', 'gold', [horizontal, base + height + 6, depth], [0.45, 9, 0.45]);
  }
  function rotunda(horizontal, depth, base, radius, height, damaged = false) {
    rings(horizontal, depth, base, radius + 4, 4);
    colonnade(horizontal, depth, base + 3.2, radius, height, 14, !damaged);
    add('cylinder', 'dark', [horizontal, base + height * 0.38, depth], [radius * 0.6, height * 0.65, radius * 0.6]);
    dome(horizontal, depth, base + height + 5.6, radius + 1.6, radius * 0.68, damaged);
  }
  function spire(horizontal, depth, base, height, width, damaged = false) {
    const corners = 6;
    add('cylinder', 'dark', [horizontal, base + 1, depth], [width * 1.5, 2, width * 1.5]);
    add('taper', 'stone', [horizontal, base + height * 0.33, depth], [width, height * 0.66, width]);
    for (let tier = 0; tier < 3; tier++) {
      const elevation = base + height * (0.2 + tier * 0.23);
      add('cylinder', 'pale', [horizontal, elevation, depth], [width * (1.2 - tier * 0.04), 0.7, width * (1.2 - tier * 0.04)]);
    }
    for (let side = 0; side < corners; side++) {
      const angle = side / corners * Math.PI * 2;
      column(horizontal + Math.cos(angle) * width, base + height * 0.65, depth + Math.sin(angle) * width, height * 0.25, width * 0.13, damaged && side === 1, false);
      add('box', 'dark', [horizontal + Math.cos(angle) * width * 0.92, base + height * 0.39, depth + Math.sin(angle) * width * 0.92], [width * 0.25, height * 0.3, 0.2], [0, -angle + Math.PI / 2, 0]);
    }
    add('cylinder', 'pale', [horizontal, base + height * 0.91, depth], [width * 1.2, 1.5, width * 1.2]);
    if (!damaged) {
      add('cone', 'copper', [horizontal, base + height * 1.04, depth], [width * 1.22, height * 0.24, width * 1.22]);
      add('cone', 'gold', [horizontal, base + height * 1.19, depth], [0.3, height * 0.09, 0.3]);
    }
  }

  const terrainHeight = (horizontal, depth) => {
    const ridge = Math.pow(THREE.MathUtils.smoothstep(Math.abs(horizontal + Math.sin(depth * 0.012) * 28), 105, 320), 1.6) * 115;
    const distant = THREE.MathUtils.smoothstep(-depth, 410, 690) * 100;
    return -24 + ridge + distant + noise.noise(horizontal * 0.013, depth * 0.012) * (8 + ridge * 0.28) + noise.noise(horizontal * 0.052, depth * 0.052) * 3.8;
  };
  const terrain = new THREE.PlaneGeometry(1100, 1200, 220, 240);
  terrain.rotateX(-Math.PI / 2);
  terrain.translate(0, 0, -140);
  const position = terrain.attributes.position;
  for (let index = 0; index < position.count; index++) position.setY(index, terrainHeight(position.getX(index), position.getZ(index)));
  terrain.computeVertexNormals();
  custom(terrain, 'rock');
  for (let index = 0; index < 85; index++) {
    const horizontal = (index % 2 ? -1 : 1) * (125 + random() * 130);
    const depth = 120 - random() * 680;
    const size = 12 + random() * 26;
    rock([horizontal, terrainHeight(horizontal, depth) + size * 0.25, depth], [size, size * (0.75 + random() * 1.7), size * 0.8], index, [random() * 0.4, random() * 6, random() * 0.3]);
  }
  for (let index = 0; index < 24; index++) {
    const angle = index / 24 * Math.PI * 2;
    rock([18 + Math.cos(angle) * 51, -1 + random() * 4, -158 + Math.sin(angle) * 49], [16 + random() * 11, 24 + random() * 12, 16 + random() * 12], index, [0, angle, 0]);
  }
  for (let layer = 0; layer < 6; layer++) rings(18, -158, 15 + layer * 1.8, 62 - layer * 2.3, 2);
  colonnade(18, -158, 27, 38, 40, 28);
  add('cylinder', 'stone', [18, 44, -158], [24, 34, 24]);
  rings(18, -158, 70, 42, 4);
  colonnade(18, -158, 74, 25, 20, 22);
  dome(18, -158, 97, 28, 23, true);
  for (let segment = 0; segment < 80; segment++) {
    if ([8, 9, 10, 11, 48, 49, 50].includes(segment)) continue;
    const start = segment / 80 * Math.PI * 2;
    const end = (segment + 1) / 80 * Math.PI * 2;
    custom(arcSegment(70, 4.2, 5.2, start + 0.001, end - 0.001), segment % 5 ? 'stone' : 'pale', [18, 78, -198]);
    const angle = (start + end) / 2;
    add('box', 'gold', [18 + Math.cos(angle) * 70, 78 + Math.sin(angle) * 70, -192.4], [1.2, 1.8, 0.28], [0, 0, angle]);
  }
  for (const extent of [[0.0,0.6],[0.97,3.73],[4.04,6.28]]) {
    const path = [];
    for (let step = 0; step <= 72; step++) {
      const angle = extent[0] + (extent[1] - extent[0]) * step / 72;
      path.push([18 + Math.cos(angle) * 67.8, 78 + Math.sin(angle) * 67.8, -192.1]);
    }
    tube(path, 0.12, 'gold', 72);
  }
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2;
    spire(18 + Math.cos(angle) * 51, -158 + Math.sin(angle) * 51, 26, index % 2 ? 31 : 48, 3.1, index === 4);
  }
  const emblem = new THREE.TorusGeometry(8, 0.5, 12, 96);
  custom(emblem, 'gold', [18, 49, -133.5]);
  custom(new THREE.TorusGeometry(6.7, 0.09, 6, 96), 'glow', [18, 49, -132.9]);
  add('sphere', 'glow', [18, 49, -132.7], [0.85, 0.85, 0.45]);
  for (let prong = -1; prong <= 1; prong++) {
    add('cylinder', 'gold', [18 + prong * 2.3, 49, -132.5], [0.18, prong ? 7 : 12, 0.18]);
    add('cone', 'gold', [18 + prong * 2.3, 52.5 + (prong ? 0 : 2.5), -132.5], [0.6, 1.6, 0.6]);
  }

  const bridgeStart = new THREE.Vector3(-24, 2, 122);
  const bridgeEnd = new THREE.Vector3(18, 27, -112);
  for (let step = 0; step < 96; step++) {
    const progress = step / 95;
    const point = bridgeStart.clone().lerp(bridgeEnd, progress);
    const width = step > 82 ? 23 + (step - 82) * 1.2 : 23;
    for (let tile = 0; tile < 5; tile++) {
      if (step > 11 && step < 14 && tile < 2) continue;
      add('box', (step + tile) % 13 === 0 ? 'pale' : 'stone', [point.x + (tile - 2) * width / 5, point.y, point.z], [width / 5 - 0.08, 1.3, 2.4], [0, 0, (random() - 0.5) * 0.007]);
    }
    add('box', 'dark', [point.x, point.y - 3, point.z], [width, 4.9, 2.4]);
    for (let side = -1; side <= 1; side += 2) {
      if ((step > 10 && step < 19 && side < 0) || step % 19 === 4) continue;
      add('box', 'dark', [point.x + side * (width / 2 + 0.7), point.y + 1, point.z], [1.3, 2.2, 2.4]);
      add('box', 'pale', [point.x + side * (width / 2 + 0.7), point.y + 2.4, point.z], [1.7, 0.45, 2.44]);
    }
    if (step % 8 === 0) {
      for (let side = -1; side <= 1; side += 2) {
        column(point.x + side * 17, point.y - 0.5, point.z, 16 + (step % 16 ? 0 : 3), 1.2, [16, 40, 72].includes(step) && side < 0);
        add('box', 'dark', [point.x + side * 10, point.y - 12, point.z], [5, 20, 5]);
      }
    }
  }
  for (let index = 0; index < 10; index++) {
    const depth = 103 - index * 22;
    const horizontal = -24 + (122 - depth) / 234 * 42;
    for (let side = -1; side <= 1; side += 2) arch(horizontal + side * 12, -9 + index * 2.2, depth, 8, 1.4);
  }

  const gateX = -25;
  const gateZ = 21;
  for (let side = -1; side <= 1; side += 2) {
    const horizontal = gateX + side * 36;
    add('box', 'stone', [horizontal, 13, gateZ], [11, 29, 14]);
    for (let detail = -1; detail <= 1; detail += 2) column(horizontal + detail * 4.2, -1, gateZ + 8.2, 39, 1.7, side < 0 && detail < 0);
    rings(horizontal, gateZ, 36, 8, 3);
    spire(horizontal, gateZ, 39, 24, 4.5, side < 0);
    add('box', 'gold', [horizontal, 21, gateZ + 7.7], [3.8, 9, 0.6]);
    add('box', 'stone', [horizontal, 21.1, gateZ + 8], [2.8, 7.8, 0.2]);
  }
  arch(gateX, 37, gateZ, 36, 5.4, true);
  arch(gateX, 37, gateZ + 1.5, 32.4, 0.9, true);
  rock([-49, -11, 37], [10, 8, 11], 3, [0.2, 0.3, -0.5]);
  custom(arcSegment(36, 5.4, 7.5, 0.72 * Math.PI, 0.80 * Math.PI), 'stone', [-42, -3, 58], [0.6, -0.4, 0.8]);
  for (let index = 0; index < 12; index++) add('box', 'stone', [-67 + random() * 26, -10 + random() * 6, 22 + random() * 50], [3 + random() * 3, 3 + random() * 3, 4 + random() * 3], [random(), random(), random()]);

  rotunda(-84, -74, -6, 17, 26, true);
  rotunda(93, -50, -9, 14, 25, true);
  rotunda(-54, -242, 5, 18, 30, false);
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < 14; index++) {
      const horizontal = side * (71 + random() * 113);
      const depth = -105 - index * 23 + random() * 15;
      const base = terrainHeight(horizontal, depth);
      spire(horizontal, depth, base, 25 + random() * 60, 4 + random() * 3, index % 4 === 0);
    }
  }
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < 12; index++) {
      const horizontal = side * (64 + index * 13);
      const base = 7 + Math.max(0, index - 4) * 2;
      column(horizontal, base - 20, -225, 35, 1.8, index % 7 === 1);
      if (index % 6 !== 3) arch(horizontal + side * 6.5, base + 10, -225, 6.5, 1.7);
      if (index % 6 !== 3) add('box', 'stone', [horizontal, base + 19, -225], [14, 3.5, 7]);
    }
  }
  for (let index = 0; index < 13; index++) {
    const horizontal = (index - 6) * 28;
    const base = -5 + Math.abs(index - 6) * 2;
    column(horizontal, base, -360, 67, 3.2, index % 6 === 1, false);
    if (index < 12 && index !== 3) arch(horizontal + 14, base + 50, -360, 14, 3.1, index === 8);
  }
  for (let index = 0; index < 22; index++) {
    const horizontal = (random() - 0.5) * 480;
    const depth = -350 - random() * 220;
    spire(horizontal, depth, terrainHeight(horizontal, depth), 35 + random() * 75, 6 + random() * 3, index % 3 === 0);
  }

  column(96, -9, 116, 52, 4, true);
  column(116, -12, 93, 70, 3.9);
  add('box', 'stone', [106, 58, 97], [32, 4.7, 14], [0, -0.27, -0.08]);
  column(-108, -5, 130, 40, 3.3, true);
  add('flute', 'pale', [-53, -6, 110], [2.3, 26, 2.3], [0.13, 0.65, 1.36]);
  add('cylinder', 'pale', [-43, -8, 106], [3.4, 2.6, 3.4], [0.15, 0.65, 1.36]);
  for (let index = 0; index < 180; index++) {
    const horizontal = (random() - 0.5) * 270;
    const depth = 185 - random() * 440;
    if (Math.abs(horizontal) < 25 && depth < 130) continue;
    const size = 0.7 + Math.pow(random(), 2) * 8;
    rock([horizontal, terrainHeight(horizontal, depth) + size * 0.42, depth], [size * 1.3, size, size * 1.4], index, [random(), random() * 6, random()]);
  }
  for (let index = 0; index < 850; index++) {
    const horizontal = (random() - 0.5) * 250;
    const depth = 160 - random() * 360;
    if (Math.abs(horizontal) < 22) continue;
    add('box', 'stone', [horizontal, terrainHeight(horizontal, depth) + 0.6, depth], [0.4 + random() * 2.3, 0.4 + random() * 1.4, 0.6 + random() * 2], [random(), random() * 6, random()]);
  }

  function coralBranch(origin, direction, length, thickness, depth, color) {
    const tip = origin.clone().addScaledVector(direction, length);
    const midpoint = origin.clone().add(tip).multiplyScalar(0.5);
    midpoint.x += length * 0.07;
    tube([origin.toArray(), midpoint.toArray(), tip.toArray()], thickness, color, 5);
    if (depth === 0) {
      add('sphere', 'coralLight', tip.toArray(), [thickness * 1.2, thickness * 1.4, thickness * 1.2]);
      return;
    }
    for (let branch = 0; branch < 2; branch++) {
      const next = direction.clone().add(new THREE.Vector3((branch ? 1 : -1) * (0.55 + random() * 0.55), 0.2, (random() - 0.5) * 0.8)).normalize();
      coralBranch(tip, next, length * (0.6 + random() * 0.18), thickness * 0.67, depth - 1, color);
    }
  }
  for (let index = 0; index < 42; index++) {
    const horizontal = (index % 2 ? -1 : 1) * (38 + random() * 90);
    const depth = 151 - random() * 300;
    const origin = new THREE.Vector3(horizontal, terrainHeight(horizontal, depth) + 1, depth);
    coralBranch(origin, new THREE.Vector3((random() - 0.5) * 0.4, 1, 0), 2.4 + random() * 3.1, 0.17, 4, index % 3 ? 'coral' : 'coralPurple');
  }
  for (let index = 0; index < 16; index++) {
    const horizontal = [-61, 11, 96, -44][index % 4] + (random() - 0.5) * 10;
    const depth = index % 4 === 2 ? 116 : index % 4 === 3 ? 101 : 25;
    coralBranch(new THREE.Vector3(horizontal, index % 4 === 2 ? 15 + random() * 7 : 1 + random() * 4, depth), new THREE.Vector3(0.1, 1, 0), 1.8 + random(), 0.11, 3, 'coralLight');
  }
  for (const cluster of [[78, 4, 132], [-41, -4, 119], [94, 18, 112]]) {
    for (let index = 0; index < 6; index++) coralBranch(new THREE.Vector3(cluster[0] + random() * 7, cluster[1] + random() * 2, cluster[2] + random() * 6), new THREE.Vector3((random() - 0.5) * 0.3, 1, 0), 2.5 + random() * 2.6, 0.15, 4, index % 2 ? 'coral' : 'coralPurple');
  }
  const plateGeometry = new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
  geometries.plate = plateGeometry;
  for (let index = 0; index < 165; index++) {
    const horizontal = (index % 2 ? 1 : -1) * (33 + random() * 95);
    const depth = 156 - random() * 250;
    const size = 0.9 + random() * 2.8;
    add('plate', index % 3 ? 'coralPurple' : 'coral', [horizontal, terrainHeight(horizontal, depth) + 1.2, depth], [size, size * 0.11, size], [random() * 0.15, random() * 6, random() * 0.3]);
  }
  const grass = new THREE.PlaneGeometry(1, 7, 2, 15);
  grass.translate(0, 3.5, 0);
  for (let index = 0; index < grass.attributes.position.count; index++) {
    const positions = grass.attributes.position;
    const elevation = positions.getY(index);
    positions.setX(index, positions.getX(index) * Math.sin(elevation / 7 * Math.PI) * 0.9 + Math.sin(elevation * 0.7) * elevation * 0.09);
    positions.setZ(index, Math.sin(elevation * 0.8) * elevation * 0.05);
  }
  grass.computeVertexNormals();
  geometries.grass = grass;
  for (let index = 0; index < 3000; index++) {
    const horizontal = (random() - 0.5) * 305;
    const depth = 185 - random() * 365;
    if (Math.abs(horizontal) < 28) continue;
    const size = 0.25 + Math.pow(random(), 2) * 2.0;
    add('grass', index % 2 ? 'kelp' : 'kelpDark', [horizontal, terrainHeight(horizontal, depth), depth], [size, size, size], [0, random() * 6, (random() - 0.5) * 0.2]);
  }
  for (let index = 0; index < 58; index++) {
    const horizontal = index % 2 ? 90 + random() * 18 : -61 + random() * 9;
    const depth = 135 + random() * 18;
    const size = 1.9 + random() * 2.8;
    add('grass', index % 2 ? 'kelp' : 'kelpDark', [horizontal, -4 + random() * 2, depth], [size * 0.8, size, size], [0, random() * 6, (random() - 0.5) * 0.3]);
  }
  for (let index = 0; index < 260; index++) {
    const side = index % 2 ? -1 : 1;
    const horizontal = side * (35 + random() * 95);
    const depth = 100 - random() * 230;
    const size = 0.08 + random() * 0.22;
    add('sphere', 'glow', [horizontal, terrainHeight(horizontal, depth) + random() * 3, depth], [size, size * 0.7, size]);
  }

  const combined = new Map();
  for (const child of [...group.children]) {
    child.updateMatrix();
    const transformed = child.geometry.clone().applyMatrix4(child.matrix);
    const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
    if (geometry !== transformed) transformed.dispose();
    if (!combined.has(child.material)) combined.set(child.material, []);
    combined.get(child.material).push(geometry);
    group.remove(child);
    child.geometry.dispose();
  }
  for (const [material, parts] of combined) {
    const mesh = new THREE.Mesh(mergeGeometries(parts), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    parts.forEach(geometry => geometry.dispose());
  }
  for (const { geometry, material, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.receiveShadow = true;
    mesh.castShadow = material !== materials.kelp && material !== materials.kelpDark && material !== materials.glow;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  scene.add(group);
  return group;
}
