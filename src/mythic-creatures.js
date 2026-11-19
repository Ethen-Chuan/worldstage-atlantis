import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './core.js';
import { organicSurface } from './creature-surface.js';
import { smoothBody, attachSwimming } from './swim.js';

function surface(color, roughness = 0.65, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });
}

function part(root, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const shape = new THREE.Mesh(geometry, material);
  shape.position.set(...position); shape.scale.set(...scale); shape.rotation.set(...rotation);
  root.add(shape);
  return shape;
}

function ellipsoid(root, material, position, scale, segments = 24) {
  return part(root, new THREE.SphereGeometry(1, segments, Math.max(8, segments / 2)), material, position, scale);
}

function tube(root, points, radius, material, segments = 20) {
  return part(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), segments, radius, 6, false), material);
}

export function consolidate(root, exclusions = []) {
  const groups = new Map();
  for (const child of [...root.children]) {
    if (!child.isMesh || exclusions.includes(child) || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const transformed = child.geometry.clone().applyMatrix4(child.matrix);
    const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
    if (geometry !== transformed) transformed.dispose();
    if (!groups.has(child.material)) groups.set(child.material, []);
    groups.get(child.material).push(geometry); root.remove(child); child.geometry.dispose();
  }
  for (const [material, geometries] of groups) {
    part(root, mergeGeometries(geometries), material);
    geometries.forEach(geometry => geometry.dispose());
  }
}

function membrane(root, outline, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const shape = new THREE.Shape(); shape.moveTo(...outline[0]);
  for (let index = 1; index < outline.length; index += 3) shape.bezierCurveTo(...outline[index], ...outline[index + 1], ...outline[index + 2]);
  return part(root, new THREE.ShapeGeometry(shape, 14), material, position, scale, rotation);
}

function patternedSkin(material, kind) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 skinPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nskinPosition = position;');
    shader.fragmentShader = 'varying vec3 skinPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float grain = sin(skinPosition.x * 27.0 + sin(skinPosition.z * 31.0)) * sin(skinPosition.y * 35.0 + skinPosition.z * 23.0);
      float patches = sin(skinPosition.z * 1.8 + sin(skinPosition.x * 2.1)) * sin(skinPosition.y * 2.5);
      diffuseColor.rgb *= 0.82 + grain * 0.12 + patches * 0.23;
      ${kind === 'ancient' || kind === 'armour' ? 'float moss = smoothstep(0.04,0.65,patches + sin(skinPosition.x * 6.3 + skinPosition.z * 2.7) * 0.3); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.66,0.79,0.44), moss * 0.65);' : ''}
      ${kind === 'shell' ? 'float bands = pow(0.5 + 0.5 * sin(atan(skinPosition.y, skinPosition.z) * 23.0 + skinPosition.x * 3.0), 3.0); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.38,0.25,0.19), bands * 0.8);' : ''}
    `);
  };
  material.customProgramCacheKey = () => `living-skin-${kind}-v5`;
}

export function createAncientFish() {
  const root = new THREE.Group(); root.name = 'fantasy-armoured-ancient-fish'; root.userData.creature = 'ancient';
  const skin = organicSurface(surface('#617f78', 0.64, 0.04), 'ancient', { relief: 0.17 });
  const plate = organicSurface(surface('#577a73', 0.59, 0.15), 'ancient', { relief: 0.1 });
  const finSkin = organicSurface(surface('#637f6d', 0.61, 0.08), 'ancient', { relief: 0.042, length: 12 });
  const edge = surface('#938962', 0.58, 0.18); const dark = surface('#172f30', 0.8);
  const eye = new THREE.MeshPhysicalMaterial({ color: '#c9923e', roughness: 0.19, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
  const black = surface('#061c1e', 0.14); const glint = surface('#e8d7a3', 0.08);
  for (const material of [eye, black, dark, glint]) material.userData.keepColor = true;
  const profile = [[-12.3, 1.8], [-11.2, 2.8], [-9, 3.9], [-6, 4.28], [-2, 4.1], [3, 3.35], [7, 2.15], [11, 0.85]];
  const body = smoothBody(profile, 96, 48, 0.9); part(root, body, skin);
  ellipsoid(root, skin, [0, 0.02, -11.6], [2.23, 1.65, 0.86], 32);
  const jaw = new THREE.Group(); jaw.position.set(0, -1.65, -7.4); root.add(jaw);
  ellipsoid(jaw, skin, [0, -0.15, -0.6], [3.03, 0.9, 4.0]);
  part(root, new THREE.TorusGeometry(1, 0.105, 12, 56), skin, [0, -0.72, -12.18], [1.89, 0.55, 1]);
  ellipsoid(root, dark, [0, -0.72, -12.16], [1.79, 0.48, 0.16]);
  const fins = [];
  for (const side of [-1, 1]) {
    ellipsoid(root, plate, [side * 3.3, 1.64, -8.8], [0.16, 0.57, 1.7], 28);
    ellipsoid(root, dark, [side * 3.77, 0.96, -8.3], [0.19, 0.43, 0.59]);
    ellipsoid(root, eye, [side * 3.92, 0.98, -8.4], [0.15, 0.3, 0.36], 28);
    ellipsoid(root, black, [side * 4.06, 0.98, -8.4], [0.028, 0.215, 0.135]);
    ellipsoid(root, glint, [side * 4.08, 1.1, -8.49], [0.014, 0.045, 0.045], 10);
    for (let gill = 0; gill < 4; gill++) tube(root, [[side * 2.8, 2.7, -4.8 + gill * 0.47], [side * 4.2, 0.1, -4.5 + gill * 0.49], [side * 3.05, -2.45, -4.1 + gill * 0.5]], 0.045, dark, 18);
    const fin = new THREE.Group(); fin.position.set(side * 3.35, -1.1, -2.5); fin.rotation.set(-0.2, 0, side * -0.25); fin.scale.x = side; root.add(fin);
    membrane(fin, [[0, 0], [3, -2.7], [8.8, -3.4], [10, -0.4], [7.8, 1.8], [3, 3.1], [0, 0]], finSkin, [0, 0, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    for (let rib = 0; rib < 14; rib++) tube(fin, [[0, 0, 0], [3.8, 0.055, -1.8 + rib * 0.26], [8.55 - Math.abs(rib - 6.5) * 0.18, 0.06, -2.15 + rib * 0.31]], 0.026, edge, 12);
    consolidate(fin); fins.push(fin);
    tube(root, [[side * 2.2, -1.9, -11.2], [side * 2.45, -3.1, -12.2], [side * 2.7, -3.65, -11.3]], 0.036, edge);
  }
  const random = seededRandom(187);
  for (let row = 0; row < 11; row++) {
    const depth = -2.8 + row * 1.04;
    const profileIndex = Math.max(1, profile.findIndex(point => point[0] >= depth));
    const radius = THREE.MathUtils.lerp(profile[profileIndex - 1][1], profile[profileIndex][1], THREE.MathUtils.smoothstep(depth, profile[profileIndex - 1][0], profile[profileIndex][0])) / 4.1;
    const spineHeight = 0.5 + Math.sin(row / 12 * Math.PI) * 0.9;
    part(root, new THREE.ConeGeometry(0.16, spineHeight, 9), plate, [0, 3.67 * radius + spineHeight * 0.34, depth], [1, 1, 1], [-0.35, 0, 0]);
  }
  membrane(root, [[0, 0], [-2, 3], [-4, 5], [-6, 4.9], [-9, 2.6], [-11, 0.9], [0, 0]], finSkin, [0, 3.6, -3.5], [1, 1, 1], [0, Math.PI / 2, 0]);
  for (let ray = 0; ray < 16; ray++) {
    const progress = ray / 15;
    tube(root, [[0, 3.5, -3.3], [0.025, 4.6 + Math.sin(progress * Math.PI) * 1.4, -2.7 + progress * 4.9], [0.03, 4.05 + Math.sin(progress * Math.PI) * 4.05, -3.0 + progress * 10.1]], 0.024, edge, 14);
  }
  for (let growth = 0; growth < 10; growth++) {
    const horizontal = (random() - 0.5) * 5.8; const depth = -8 + random() * 10;
    const elevation = 3.7 * Math.sqrt(Math.max(0.1, 1 - horizontal * horizontal / 20));
    ellipsoid(root, plate, [horizontal, elevation, depth], [0.09 + random() * 0.09, 0.035, 0.14], 10);
  }
  const tail = new THREE.Group(); tail.position.z = 8; root.add(tail);
  ellipsoid(tail, skin, [0, 0, 2.3], [1.3, 1.5, 4.2]);
  membrane(tail, [[0, 0], [-3, 3], [-5.8, 8], [-2, 9], [0, 7], [1, 3], [0, 0]], finSkin, [0, 0, 5], [1, 1, 1], [0, Math.PI / 2, 0]);
  membrane(tail, [[0, 0], [-3, -3], [-5.8, -8], [-2, -9], [0, -7], [1, -3], [0, 0]], finSkin, [0, 0, 5], [1, 1, 1], [0, Math.PI / 2, 0]);
  for (const side of [-1, 1]) for (let rib = 1; rib < 11; rib++) tube(tail, [[0, 0, 4.5], [0, side * rib * 0.47, 7.2], [0, side * rib * 0.72, 8.3]], 0.027, edge, 12);
  consolidate(root); consolidate(tail); consolidate(jaw);
  const swim = attachSwimming(root, { axis: 'x', start: -5, end: 15, amplitude: 0.82, frequency: 0.84, wavelength: 0.13 });
  return { root, animate(time) {
    swim.update(time); const joint = swim.sample(8, time);
    tail.position.x = joint.offset; tail.rotation.y = Math.atan(joint.slope) + Math.sin(time * 0.84 - 2.1) * 0.11;
    jaw.rotation.x = Math.sin(time * 0.91 - 0.6) * 0.017;
    fins.forEach((fin, index) => { const side = index ? 1 : -1; fin.rotation.z = side * (-0.25 + Math.sin(time * 0.84 - 0.65 + index * 0.25) * 0.14); fin.rotation.x = -0.2 + Math.cos(time * 0.84 - 0.9) * 0.055; });
  } };
}

export function createTurtle() {
  const root = new THREE.Group(); root.name = 'reef-turtle'; root.userData.creature = 'turtle';
  const skin = surface('#9a9b76', 0.78, 0); patternedSkin(skin, 'turtle'); const shell = surface('#65694a', 0.55, 0); patternedSkin(shell, 'turtle');
  const seam = surface('#b9ad79', 0.8); const eye = surface('#162f2b', 0.22);
  ellipsoid(root, shell, [0, 0.3, 0], [2.05, 0.86, 2.6], 48);
  ellipsoid(root, seam, [0, -0.15, 0], [1.9, 0.45, 2.4]);
  ellipsoid(root, skin, [0, 0, -2.35], [0.44, 0.38, 0.8]);
  ellipsoid(root, skin, [0, 0.03, -3], [0.58, 0.49, 0.75], 32);
  tube(root, [[-0.39, -0.17, -3.48], [0, -0.23, -3.7], [0.39, -0.17, -3.48]], 0.02, eye, 18);
  for (const side of [-1, 1]) ellipsoid(root, eye, [side * 0.48, 0.13, -3.05], [0.085, 0.12, 0.13], 12);
  for (let row = 0; row < 5; row++) {
    const depth = (row - 2) * 0.87;
    const vertical = Math.sqrt(1 - depth * depth / 7) * 0.78 + 0.31;
    const ring = part(root, new THREE.TorusGeometry(0.66, 0.019, 6, 6), seam, [0, vertical, depth], [1, 1, 1], [Math.PI / 2, 0, 0]);
    ring.scale.set(0.95, 0.75, 1);
    for (const side of [-1, 1]) tube(root, [[side * 0.65, vertical, depth], [side * 1.23, vertical - 0.17, depth + 0.15], [side * 1.75, 0.6, depth + 0.3]], 0.025, seam, 8);
  }
  const flippers = [];
  for (const side of [-1, 1]) for (const front of [true, false]) {
    const fin = membrane(root, [[0, 0], [1, -0.4], [3.3, -0.7], [3.9, 0.7], [3, 1.3], [0.8, 1.4], [0, 0]], skin, [side * 1.2, -0.1, front ? -1.1 : 1.8], [side * (front ? 1 : 0.55), front ? 1 : 0.6, 1], [-Math.PI / 2, 0, 0]);
    flippers.push({ fin, side, front });
  }
  part(root, new THREE.ConeGeometry(0.24, 1.2, 10), skin, [0, 0, 2.6], [1, 1, 1], [Math.PI / 2, 0, 0]);
  consolidate(root, flippers.map(item => item.fin));
  return { root, animate(time) { for (const { fin, side, front } of flippers) fin.rotation.z = side * Math.sin(time * 1.25 + (front ? 0 : 1.4)) * (front ? 0.48 : 0.2); } };
}

export function createNautilus() {
  const root = new THREE.Group(); root.name = 'spiral-shell-drifter'; root.userData.creature = 'nautilus';
  const shell = surface('#dbc7a5', 0.53); patternedSkin(shell, 'shell');
  const skin = surface('#b29a81', 0.68); const dark = surface('#263933', 0.4);
  ellipsoid(root, shell, [0, 0, 0], [0.68, 1.65, 1.65], 32);
  for (const side of [-1, 1]) {
    const spiral = Array.from({ length: 81 }, (_, index) => {
      const angle = index / 80 * Math.PI * 4.2; const radius = 0.08 + index / 80 * 1.45;
      return [side * (0.68 * Math.sqrt(Math.max(0.1, 1 - radius * radius / 2.9)) + 0.035), Math.sin(angle) * radius, Math.cos(angle) * radius];
    });
    tube(root, spiral, 0.032, skin, 80);
    ellipsoid(root, dark, [side * 0.43, -0.4, -1.37], [0.13, 0.15, 0.14], 12);
  }
  ellipsoid(root, skin, [0, -0.5, -1.15], [0.57, 0.65, 0.78]);
  const tentacles = new THREE.Group(); tentacles.position.set(0, -0.7, -1.55); root.add(tentacles);
  for (let index = 0; index < 24; index++) {
    const angle = index / 24 * Math.PI * 2; const radius = 0.55 + index % 3 * 0.22;
    tube(tentacles, [[0, 0, 0], [Math.cos(angle) * radius * 0.5, Math.sin(angle) * radius * 0.5, -0.65], [Math.cos(angle) * radius, Math.sin(angle) * radius - 0.2, -1.1 - index % 4 * 0.12], [Math.cos(angle) * radius * 0.8, Math.sin(angle) * radius - 0.3, -1.45]], 0.026, skin, 12);
  }
  consolidate(root); consolidate(tentacles);
  return { root, animate(time) { tentacles.scale.set(1 + Math.sin(time * 1.8) * 0.13, 1 + Math.sin(time * 1.8) * 0.1, 1 - Math.sin(time * 1.8) * 0.12); } };
}

export { createMermaid } from './mermaid.js';
