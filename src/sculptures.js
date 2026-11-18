import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { seededRandom } from './core.js';

export class StoneWorkshop {
  constructor(materials, seed = 27) {
    this.materials = materials;
    this.random = seededRandom(seed);
    this.parts = new Map();
    this.matrix = new THREE.Object3D();
    this.geometry = {
      box: new RoundedBoxGeometry(1, 1, 1, 1, 0.035),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 24),
      taper: new THREE.CylinderGeometry(0.8, 1, 1, 24),
      sphere: new THREE.SphereGeometry(1, 12, 8),
      cone: new THREE.ConeGeometry(1, 1, 16),
      torus: new THREE.TorusGeometry(1, 0.05, 6, 48),
      rock: new THREE.IcosahedronGeometry(1, 2),
      dome: new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    };
    const flute = new THREE.CylinderGeometry(0.91, 1, 1, 64, 3);
    const positions = flute.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const horizontal = positions.getX(index);
      const depth = positions.getZ(index);
      const angle = Math.atan2(depth, horizontal);
      const radius = 1 - Math.cos(angle * 16) * 0.07;
      positions.setX(index, horizontal * radius);
      positions.setZ(index, depth * radius);
    }
    flute.computeVertexNormals();
    this.geometry.flute = flute;
    const rockPosition = this.geometry.rock.attributes.position;
    for (let index = 0; index < rockPosition.count; index++) {
      const horizontal = rockPosition.getX(index);
      const vertical = rockPosition.getY(index);
      const depth = rockPosition.getZ(index);
      const distortion = 1 + Math.sin(horizontal * 7 + depth * 3) * Math.cos(vertical * 5 + horizontal) * 0.14;
      rockPosition.setXYZ(index, horizontal * distortion, vertical * distortion, depth * distortion);
    }
    this.geometry.rock.computeVertexNormals();
  }

  add(type, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const geometry = typeof type === 'string' ? this.geometry[type] : type;
    this.matrix.position.set(...position);
    this.matrix.scale.set(...scale);
    this.matrix.rotation.set(...rotation);
    this.matrix.updateMatrix();
    const transformed = geometry.clone().applyMatrix4(this.matrix.matrix);
    const flat = transformed.index ? transformed.toNonIndexed() : transformed;
    if (flat !== transformed) transformed.dispose();
    for (const key of Object.keys(flat.attributes)) if (!['position', 'normal', 'uv'].includes(key)) flat.deleteAttribute(key);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(flat);
  }

  tube(points, radius, material = 'gold', segments = 16) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const geometry = new THREE.TubeGeometry(curve, segments, radius, 6, false);
    this.add(geometry, material, [0, 0, 0]);
    geometry.dispose();
  }

  ring(horizontal, vertical, depth, radius, material = 'gold', thickness = 0.05) {
    this.add('torus', material, [horizontal, vertical, depth], [radius, radius, thickness / 0.05], [Math.PI / 2, 0, 0]);
  }

  column(horizontal, base, depth, height, radius = 1, broken = false) {
    this.add('box', 'stone', [horizontal, base + 0.3, depth], [radius * 3.2, 0.6, radius * 3.2]);
    this.add('cylinder', 'pale', [horizontal, base + 0.85, depth], [radius * 1.45, 0.5, radius * 1.45]);
    this.ring(horizontal, base + 1.2, depth, radius * 1.2, 'pale', radius * 0.1);
    const shaftHeight = broken ? height * 0.84 : Math.max(1, height - 2.5);
    this.add('flute', 'pale', [horizontal, base + 1.25 + shaftHeight / 2, depth], [radius, shaftHeight, radius]);
    if (broken) {
      this.add('rock', 'stone', [horizontal, base + 1.25 + shaftHeight + radius * 0.2, depth], [radius, radius * 0.5, radius]);
      return;
    }
    this.ring(horizontal, base + height - 1.1, depth, radius, 'gold', 0.1);
    this.add('cylinder', 'pale', [horizontal, base + height - 0.5, depth], [radius * 1.33, 0.8, radius * 1.33]);
    for (let leaf = 0; leaf < 8; leaf++) {
      const angle = leaf / 8 * Math.PI * 2;
      this.add('sphere', 'pale', [horizontal + Math.cos(angle) * radius * 1.04, base + height - 0.7, depth + Math.sin(angle) * radius * 1.04], [radius * 0.32, radius * 0.72, radius * 0.22], [0, -angle, 0]);
    }
    this.add('box', 'pale', [horizontal, base + height + 0.15, depth], [radius * 3.2, 0.5, radius * 3.2]);
  }

  arch(horizontal, base, depth, radius, thickness, broken = false) {
    const count = 22;
    for (let index = 0; index < count; index++) {
      if (broken && index > 12 && index < 17) continue;
      const start = index / count * Math.PI + 0.003;
      const end = (index + 1) / count * Math.PI - 0.003;
      const shape = new THREE.Shape();
      shape.absarc(0, 0, radius + thickness / 2, start, end, false);
      shape.absarc(0, 0, radius - thickness / 2, end, start, true);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness * 1.3, bevelEnabled: false, curveSegments: 3 });
      this.add(geometry, 'stone', [horizontal, base, depth]);
      geometry.dispose();
      const angle = (start + end) / 2;
      this.add('box', 'gold', [horizontal + Math.cos(angle) * radius, base + Math.sin(angle) * radius, depth + thickness * 1.33], [thickness * 0.38, thickness * 0.5, 0.14], [0, 0, angle]);
    }
  }

  terrace(horizontal, base, depth, radius, count = 3) {
    for (let step = 0; step < count; step++) this.add('cylinder', step % 2 ? 'pale' : 'stone', [horizontal, base + step * 0.65, depth], [radius - step * 0.5, 0.65, radius - step * 0.5]);
  }

  colonnade(horizontal, base, depth, radius, height, count = 18) {
    for (let index = 0; index < count; index++) {
      const angle = index / count * Math.PI * 2;
      this.column(horizontal + Math.cos(angle) * radius, base, depth + Math.sin(angle) * radius, height, Math.max(0.5, radius * 0.053));
    }
    this.terrace(horizontal, base + height + 0.6, depth, radius + 1.6, 3);
    this.ring(horizontal, base + height + 1.5, depth, radius + 1.8, 'gold', 0.1);
    for (let detail = 0; detail < count * 3; detail++) {
      const angle = detail / (count * 3) * Math.PI * 2;
      this.add('box', 'pale', [horizontal + Math.cos(angle) * (radius + 1.3), base + height + 0.3, depth + Math.sin(angle) * (radius + 1.3)], [0.55, 0.8, 0.9], [0, -angle, 0]);
    }
  }

  dome(horizontal, base, depth, radius, elevation) {
    this.add('dome', 'copper', [horizontal, base, depth], [radius, elevation, radius]);
    for (let rib = 0; rib < 20; rib++) {
      const angle = rib / 20 * Math.PI * 2;
      const points = Array.from({ length: 13 }, (_, index) => {
        const arc = index / 12 * Math.PI / 2;
        return [horizontal + Math.cos(angle) * Math.sin(arc) * (radius + 0.06), base + Math.cos(arc) * elevation, depth + Math.sin(angle) * Math.sin(arc) * (radius + 0.06)];
      });
      this.tube(points, 0.1, 'gold', 12);
    }
    this.ring(horizontal, base, depth, radius, 'gold', 0.16);
    this.add('cone', 'gold', [horizontal, base + elevation + 2.2, depth], [0.45, 4.5, 0.45]);
  }

  coral(horizontal, base, depth, scale = 1, material = 'coral') {
    const branch = (origin, direction, length, width, level) => {
      const end = origin.clone().addScaledVector(direction, length);
      const center = origin.clone().lerp(end, 0.5);
      const segment = new THREE.CylinderGeometry(width * 0.64, width, length, 5);
      segment.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
      this.add(segment, material, center.toArray());
      segment.dispose();
      if (level === 0) { this.add('sphere', 'coralLight', end.toArray(), [width, width * 1.2, width]); return; }
      for (const side of [-1, 1]) {
        const next = direction.clone().add(new THREE.Vector3(side * (0.45 + this.random() * 0.4), 0.1, (this.random() - 0.5) * 0.65)).normalize();
        branch(end, next, length * 0.72, width * 0.67, level - 1);
      }
    };
    branch(new THREE.Vector3(horizontal, base, depth), new THREE.Vector3(0.06, 1, 0).normalize(), scale * 2.4, scale * 0.18, 4);
  }

  finish(name = 'sculpture') {
    const group = new THREE.Group();
    group.name = name;
    for (const [name, parts] of this.parts) {
      const combined = mergeGeometries(parts);
      const mesh = new THREE.Mesh(combined, this.materials[name]);
      mesh.name = name;
      mesh.receiveShadow = true;
      mesh.castShadow = !['kelp', 'kelpDark', 'glow'].includes(name);
      group.add(mesh);
      parts.forEach(part => part.dispose());
    }
    Object.values(this.geometry).forEach(geometry => geometry.dispose());
    return group;
  }
}

export function sculptTemple(materials) {
  const shop = new StoneWorkshop(materials, 121);
  shop.terrace(0, 0, 0, 25, 7);
  shop.colonnade(0, 5, 0, 19, 19, 22);
  shop.add('cylinder', 'dark', [0, 13, 0], [12.5, 18, 12.5]);
  shop.colonnade(0, 27, 0, 13.5, 15, 18);
  shop.add('cylinder', 'stone', [0, 33, 0], [8.5, 12, 8.5]);
  shop.colonnade(0, 45, 0, 8.5, 11, 12);
  shop.dome(0, 58, 0, 10.1, 9);
  for (let wing = 0; wing < 6; wing++) {
    const angle = wing / 6 * Math.PI * 2;
    const horizontal = Math.cos(angle) * 21;
    const depth = Math.sin(angle) * 21;
    shop.terrace(horizontal, 4, depth, 3.4);
    shop.colonnade(horizontal, 6, depth, 2.5, 10, 6);
    shop.dome(horizontal, 18.4, depth, 3.6, 4);
    for (let pendant = 0; pendant < 6; pendant++) shop.add('cone', 'gold', [horizontal + Math.cos(pendant) * 3.6, 2, depth + Math.sin(pendant) * 3.6], [0.17, 3, 0.17], [Math.PI, 0, 0]);
  }
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2;
    shop.add('sphere', 'gold', [Math.cos(angle) * 14.5, 44.9, Math.sin(angle) * 14.5], [0.4, 0.6, 0.4]);
  }
  const root = shop.finish('terraced-palace');
  const fractures = new StoneWorkshop(materials, 391);
  for (let index = 0; index < 13; index++) {
    const elevation = 8 + index * 3.5;
    const radius = elevation < 26 ? 19.7 : elevation < 44 ? 14.3 : 9.3;
    const angle = index * 1.7;
    fractures.coral(Math.cos(angle) * radius, elevation, Math.sin(angle) * radius, 0.38, 'coral');
    fractures.add('rock', 'dark', [Math.cos(angle) * radius, elevation, Math.sin(angle) * radius], [1.1, 0.3, 0.8]);
  }
  const growth = fractures.finish('age-growth');
  growth.userData.erosion = true;
  root.add(growth);
  return root;
}

export function sculptArch(materials) {
  const shop = new StoneWorkshop(materials);
  for (const side of [-1, 1]) {
    shop.add('box', 'stone', [side * 11, 5, 0], [5, 10, 7]);
    shop.column(side * 11, 0, 4, 17, 1.3);
    shop.column(side * 11, 0, -3, 17, 1.3);
    shop.terrace(side * 11, 17, 0, 4, 3);
  }
  shop.arch(0, 17, -1, 11, 2.8, true);
  shop.arch(0, 17, 2.8, 9.8, 0.7, true);
  return shop.finish('broken-tidal-arch');
}

export function sculptCoral(materials) {
  const shop = new StoneWorkshop(materials, 124);
  for (let index = 0; index < 13; index++) {
    const angle = index * 2.4;
    const radius = Math.sqrt(index) * 1.3;
    shop.coral(Math.cos(angle) * radius, 0, Math.sin(angle) * radius, 0.45 + shop.random() * 0.9);
    shop.add('rock', 'rock', [Math.cos(angle) * radius, -0.2, Math.sin(angle) * radius], [1.4, 0.9, 1.6]);
  }
  return shop.finish('branching-coral-garden');
}

export function sculptTrident(materials) {
  const shop = new StoneWorkshop(materials);
  shop.terrace(0, 0, 0, 4.5, 5);
  shop.add('cylinder', 'gold', [0, 11.5, 0], [0.22, 19, 0.22]);
  shop.add('cylinder', 'gold', [0, 23, 0], [0.29, 7, 0.29]);
  shop.add('cone', 'gold', [0, 27.5, 0], [0.72, 3, 0.72]);
  for (const side of [-1, 1]) {
    shop.tube([[0, 17, 0], [side * 1.7, 18, 0], [side * 3.6, 20.5, 0], [side * 3.3, 24.5, 0]], 0.27, 'gold');
    shop.add('cone', 'gold', [side * 3.3, 25.5, 0], [0.62, 2.4, 0.62]);
  }
  for (let index = 0; index < 7; index++) shop.ring(0, 6 + index * 0.7, 0, 0.34, 'gold', 0.1);
  shop.add('sphere', 'glow', [0, 18.8, 0.25], [0.45, 0.65, 0.4]);
  return shop.finish('trident-of-the-tides');
}

export function sculptGate(materials) {
  const shop = new StoneWorkshop(materials, 711);
  shop.terrace(0, 0, 0, 31, 5);
  for (const side of [-1, 1]) {
    shop.add('box', 'dark', [side * 24, 10, 0], [10, 20, 14]);
    shop.column(side * 26, 1, 7, 27, 1.6);
    shop.column(side * 26, 1, -7, 27, 1.6);
    shop.add('cone', 'gold', [side * 26, 33, 7], [1, 7, 1]);
  }
  for (let index = 0; index < 60; index++) {
    if (index === 7 || index === 8 || index === 9) continue;
    const start = index / 60 * Math.PI * 2 + 0.004;
    const end = (index + 1) / 60 * Math.PI * 2 - 0.004;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 29, start, end, false);
    shape.absarc(0, 0, 25, end, start, true);
    const wedge = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false, curveSegments: 2 });
    shop.add(wedge, 'pale', [0, 33, -2.5]); wedge.dispose();
    const angle = (start + end) / 2;
    const horizontal = Math.cos(angle) * 27;
    const vertical = 33 + Math.sin(angle) * 27;
    shop.add('box', index % 3 ? 'gold' : 'glow', [horizontal, vertical, 2.62], [0.35, 1.75, 0.12], [0, 0, angle - Math.PI / 2]);
    if (index % 5 === 0) shop.add('sphere', 'gold', [Math.cos(angle) * 29.3, 33 + Math.sin(angle) * 29.3, 0], [0.65, 0.65, 2.8]);
  }
  for (let index = 0; index < 12; index++) {
    const angle = Math.PI + index / 11 * Math.PI;
    shop.coral(Math.cos(angle) * 27, 34 + Math.sin(angle) * 27, 3, 0.55);
  }
  for (let step = 0; step < 10; step++) shop.add('box', 'stone', [0, 0.28 * step, 29 - step * 1.3], [19 - step * 0.35, 0.4, 2]);
  return shop.finish('celestial-tide-gate');
}

export function buildReferenceAtlantis(scene, materials) {
  const shop = new StoneWorkshop(materials, 510);
  const random = shop.random;
  for (const side of [-1, 1]) {
    const horizontal = side < 0 ? -73 : 109;
    for (let index = 0; index < 7; index++) {
      const depth = 97 - index * 33;
      const height = side < 0 ? 74 : 90;
      shop.column(horizontal, -7, depth, height, 3.5, side > 0 && index === 0);
      shop.column(horizontal + side * 12, -7, depth, height, 2.8, false);
      if (index !== 1) {
        shop.add('box', 'stone', [horizontal + side * 6, height - 4, depth - 13], [22, 6, 34]);
        shop.add('box', 'pale', [horizontal + side * 6, height + 0.3, depth - 13], [24, 1.5, 35]);
        for (let detail = 0; detail < 10; detail++) shop.add('box', 'gold', [horizontal - side * 6, height - 3, depth - 27 + detail * 3], [0.2, 2.4, 1.1]);
      }
    }
    for (let step = 0; step < 29; step++) {
      shop.add('box', 'stone', [horizontal + side * 3, -5 + step * 0.7, 53 - step * 2], [31, 1.1, 2.2]);
      shop.add('box', 'pale', [horizontal - side * 14, -4 + step * 0.7, 53 - step * 2], [2.5, 1.6, 2.2]);
    }
  }
  for (let index = 0; index < 13; index++) {
    const horizontal = -190 + index * 30;
    shop.column(horizontal, -7, -298, 66 + (index % 3) * 5, 2.3, index % 6 === 0);
    if (index % 5) shop.arch(horizontal + 15, 44, -299, 15, 2.6);
    shop.add('box', 'dark', [horizontal, 62, -300], [31, 5, 9]);
  }
  for (const position of [[-146, -8, -207, 34], [122, -4, -252, 46], [-55, -6, -330, 22]]) {
    const [horizontal, base, depth, radius] = position;
    shop.terrace(horizontal, base, depth, radius + 5, 5);
    shop.colonnade(horizontal, base + 4, depth, radius, radius * 0.7, 18);
    shop.colonnade(horizontal, base + radius * 0.7 + 8, depth, radius * 0.67, radius * 0.6, 14);
    shop.dome(horizontal, base + radius * 1.3 + 12, depth, radius * 0.77, radius * 0.8);
  }
  for (let index = 0; index < 34; index++) {
    const side = index % 2 ? 1 : -1;
    const depth = 72 - index * 16;
    const radius = 17 + random() * 25;
    shop.add('rock', 'rock', [side * (145 + random() * 65), radius * 0.9 - 12, depth], [radius, radius * 2.1, radius * 0.8], [0, random() * 6, 0]);
  }
  for (let index = 0; index < 200; index++) {
    const horizontal = (random() - 0.5) * 230;
    const depth = 135 - random() * 340;
    if (Math.abs(horizontal + 8) < 16 && depth > -70) continue;
    const size = 0.4 + Math.pow(random(), 2) * 7;
    shop.add('rock', index % 4 ? 'rock' : 'stone', [horizontal, -7 + size * 0.28, depth], [size * 1.5, size, size], [random(), random() * 6, random()]);
  }
  for (let index = 0; index < 28; index++) {
    const horizontal = (index % 2 ? 1 : -1) * (28 + random() * 41);
    const depth = 125 - random() * 245;
    shop.coral(horizontal, -6, depth, 0.55 + random() * 1.1, index % 4 === 0 ? 'coralPurple' : 'coral');
  }
  for (const cluster of [[47, -5, 95], [-44, -6, 99], [72, 0, 44]]) {
    for (let index = 0; index < 6; index++) shop.coral(cluster[0] + random() * 10, cluster[1], cluster[2] + random() * 6, 0.7 + random() * 0.85, index % 2 ? 'coral' : 'coralLight');
  }
  const fallen = new StoneWorkshop(materials);
  fallen.column(0, 0, 0, 24, 2.2, true);
  const broken = fallen.finish('fallen-column');
  broken.rotation.set(0.07, -0.65, 1.31);
  broken.position.set(53, -4, 68);
  const root = shop.finish('reference-atlantis');
  root.add(broken);
  const distantGate = sculptGate(materials);
  distantGate.position.set(8, -9, -416); distantGate.scale.setScalar(3.1);
  root.add(distantGate);
  const grassGeometry = new THREE.PlaneGeometry(0.5, 5, 1, 7);
  grassGeometry.translate(0, 2.5, 0);
  const grassPositions = grassGeometry.attributes.position;
  for (let index = 0; index < grassPositions.count; index++) {
    const elevation = grassPositions.getY(index);
    grassPositions.setX(index, grassPositions.getX(index) * Math.sin(elevation / 5 * Math.PI) + Math.sin(elevation) * elevation * 0.12);
    grassPositions.setZ(index, Math.sin(elevation * 0.7) * elevation * 0.1);
  }
  grassGeometry.computeVertexNormals();
  const grasses = new THREE.InstancedMesh(grassGeometry, materials.kelp, 1200);
  const transform = new THREE.Object3D();
  for (let index = 0; index < 1200; index++) {
    const side = index % 2 ? 1 : -1;
    transform.position.set(side * (25 + random() * 88), -7, 150 - random() * 295);
    transform.rotation.set(0, random() * 6, (random() - 0.5) * 0.2);
    transform.scale.setScalar(0.25 + random() * 1.2);
    transform.updateMatrix();
    grasses.setMatrixAt(index, transform.matrix);
  }
  root.add(grasses);
  scene.add(root);
  return root;
}
