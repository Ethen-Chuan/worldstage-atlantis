import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const geometryLibrary = new WeakMap();

function lathe(profile, segments = 20) {
  return new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(...point)), segments);
}

function archSpandrel() {
  const shapes = [-1, 1].map(sign => {
    const shape = new THREE.Shape(); shape.moveTo(0, 1); shape.lineTo(sign, 1); shape.lineTo(sign, 0);
    for (let segment = 1; segment <= 32; segment++) {
      const angle = segment / 32 * Math.PI / 2; shape.lineTo(sign * Math.cos(angle), Math.sin(angle));
    }
    shape.closePath(); return shape;
  });
  return new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, steps: 1 }).translate(0, 0, -0.5);
}

function carvedShell() {
  const positions = []; const indices = []; const across = 48; const radial = 6;
  for (const face of [0, 1]) for (let row = 0; row <= radial; row++) for (let segment = 0; segment <= across; segment++) {
    const angle = -1.25 + segment / across * 2.5; const fraction = row / radial;
    const radius = fraction * (0.65 + Math.cos(angle) * 0.25) * (0.975 + Math.cos(angle * 25) * 0.025);
    const relief = face ? -0.025 : 0.025 + Math.sin(fraction * Math.PI) * (0.1 + Math.cos(angle * 25) * 0.045);
    positions.push(Math.sin(angle) * radius * 0.55, Math.cos(angle) * radius, relief);
    if (row === radial || segment === across) continue;
    const corner = face * (radial + 1) * (across + 1) + row * (across + 1) + segment;
    const next = corner + across + 1;
    if (face) indices.push(corner, next, corner + 1, corner + 1, next, next + 1);
    else indices.push(corner, corner + 1, next, corner + 1, next + 1, next);
  }
  const backside = (radial + 1) * (across + 1);
  for (let segment = 0; segment < across; segment++) {
    const edge = radial * (across + 1) + segment;
    indices.push(edge, edge + backside, edge + 1, edge + 1, edge + backside, edge + backside + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function craftGeometries() {
  const shaft = new THREE.CylinderGeometry(1, 1, 1, 48, 3);
  const vertices = shaft.attributes.position;
  for (let index = 0; index < vertices.count; index++) {
    const angle = Math.atan2(vertices.getZ(index), vertices.getX(index));
    const taper = 0.84 + Math.sin((vertices.getY(index) + 0.5) * Math.PI) * 0.12;
    const flute = 0.95 + Math.cos(angle * 12) * 0.05;
    vertices.setX(index, vertices.getX(index) * taper * flute);
    vertices.setZ(index, vertices.getZ(index) * taper * flute);
  }
  shaft.computeVertexNormals();
  const curtain = new THREE.PlaneGeometry(1, 1, 32, 8);
  const fabric = curtain.attributes.position;
  for (let index = 0; index < fabric.count; index++) {
    const across = fabric.getX(index) + 0.5;
    const height = fabric.getY(index) + 0.5;
    fabric.setZ(index, Math.sin(across * Math.PI * 12) * 0.07 + Math.sin(height * Math.PI) * 0.025);
    fabric.setY(index, fabric.getY(index) + (1 - height) ** 5 * Math.cos(across * Math.PI * 12) * 0.035);
  }
  curtain.computeVertexNormals();
  const leaf = new THREE.SphereGeometry(1, 8, 6);
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1), soft: new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 16), cone: new THREE.ConeGeometry(1, 1, 16),
    sphere: new THREE.SphereGeometry(1, 12, 8), bead: new THREE.SphereGeometry(1, 8, 6), shell: carvedShell(), leaf, shaft, curtain,
    filament: new THREE.CylinderGeometry(1, 1, 1, 6),
    ring: new THREE.TorusGeometry(1, 0.025, 4, 40),
    arch: new THREE.TorusGeometry(1, 0.065, 6, 48, Math.PI), spandrel: archSpandrel(),
    cup: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    inlay: new THREE.RingGeometry(0.987, 1, 64),
    disc: new THREE.CircleGeometry(1, 64), jewel: new THREE.OctahedronGeometry(1),
    baluster: lathe([[0.36, 0], [0.36, 0.07], [0.2, 0.12], [0.14, 0.26], [0.32, 0.43], [0.34, 0.54], [0.19, 0.69], [0.12, 0.83], [0.29, 0.9], [0.29, 1]]),
    urn: lathe([[0.32, 0], [0.32, 0.07], [0.17, 0.14], [0.13, 0.26], [0.37, 0.34], [0.52, 0.53], [0.48, 0.69], [0.26, 0.85], [0.27, 0.94], [0.34, 1]]),
    dome: lathe([[1, 0], [1.035, 0.055], [1, 0.12], [0.976, 0.3], [0.905, 0.5], [0.77, 0.7], [0.57, 0.88], [0.31, 1.035], [0.025, 1.14]], 40),
  };
  for (const geometry of Object.values(geometries)) geometry.computeBoundingBox();
  return geometries;
}

export class PalaceWorkshop {
  constructor(materials) {
    this.materials = materials; this.batches = new Map(); this.colliders = []; this.transform = new THREE.Object3D();
    if (!geometryLibrary.has(materials)) geometryLibrary.set(materials, craftGeometries());
    this.geometries = geometryLibrary.get(materials);
  }
  add(type, material, position, scale, rotation = [0, 0, 0], solid = false, name = '') {
    if (!this.geometries[type] || !this.materials[material]) throw new Error(`Unknown palace component: ${type}/${material}`);
    this.transform.position.fromArray(position); this.transform.scale.fromArray(scale); this.transform.rotation.set(...rotation); this.transform.updateMatrix();
    const key = `${type}:${material}`;
    if (!this.batches.has(key)) this.batches.set(key, { geometry: this.geometries[type], material: this.materials[material], matrices: [], names: [] });
    const batch = this.batches.get(key); batch.matrices.push(this.transform.matrix.clone()); batch.names.push(name);
    if (solid) {
      const bounds = this.geometries[type].boundingBox.clone().applyMatrix4(this.transform.matrix);
      this.colliders.push({ min: bounds.min.toArray(), max: bounds.max.toArray() });
    }
  }
  finish(name) {
    const root = new THREE.Group(); root.name = name; root.userData.collisionBoxes = this.colliders;
    let instances = 0;
    for (const batch of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.name = name;
      mesh.userData.instanceNames = batch.names.map(label => label || name);
      mesh.castShadow = false; mesh.receiveShadow = true; root.add(mesh); instances += mesh.count;
    }
    root.userData.craft = { batches: root.children.length, instances };
    return root;
  }
}

function reflectionPalette() {
  const width = 128; const height = 64; const pixels = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const latitude = row / (height - 1);
    const skylight = Math.sin(latitude * Math.PI) * 0.32 + latitude * 0.28;
    const panel = Math.max(0, Math.cos(column / width * Math.PI * 8)) ** 20 * Math.exp(-(((latitude - 0.55) * 6) ** 2));
    const index = (row * width + column) * 4;
    pixels[index] = 26 + skylight * 130 + panel * 100;
    pixels[index + 1] = 35 + skylight * 136 + panel * 78;
    pixels[index + 2] = 39 + skylight * 125 + panel * 41;
    pixels[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  texture.name = '宫城材质高光环境'; return texture;
}

export function palaceMaterials() {
  const environment = reflectionPalette();
  const material = (color, roughness, metalness = 0, options = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: environment, envMapIntensity: 0.65, ...options });
  const materials = {
    stone: material('#a8b5ab', 0.76), pale: material('#d0c8ad', 0.61), ivory: material('#e7dec3', 0.29),
    gold: material('#b99a5b', 0.29, 0.7), dark: material('#173b43', 0.6), roof: material('#306768', 0.47, 0.35),
    wood: material('#3c2827', 0.44), velvet: material('#254d58', 0.88), wine: material('#6a3045', 0.83),
    pearl: material('#f0e6cb', 0.23, 0.08), silver: material('#b7c9c8', 0.17, 0.85),
    lapis: material('#1d455d', 0.37, 0.1), mosaic: material('#384a48', 0.42),
    light: material('#ffdfa4', 0.27, 0, { emissive: '#f5bd70', emissiveIntensity: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#b1d3ce', roughness: 0.12, metalness: 0.15, envMap: environment, envMapIntensity: 0.8, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
    drape: material('#466c70', 0.93, 0, { side: THREE.DoubleSide }),
  };
  for (const [key, surface] of Object.entries(materials)) {
    surface.name = `宫城 · ${key}`;
    if (['glass', 'light', 'pearl', 'silver', 'gold'].includes(key)) continue;
    surface.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 palacePoint;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 palaceLocal=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\npalaceLocal=instanceMatrix*palaceLocal;\n#endif\npalacePoint=palaceLocal.xyz;');
      shader.fragmentShader = 'varying vec3 palacePoint;\n' + shader.fragmentShader;
      const marble = 'float winding=palacePoint.x*0.29+palacePoint.z*0.37+palacePoint.y*0.19+sin(palacePoint.z*0.45+palacePoint.x*0.21)*2.4+sin(palacePoint.x*1.3+palacePoint.y*0.43)*0.23;float vein=pow(0.5+0.5*sin(winding),28.0);float pigment=0.97-vein*0.21;';
      const stone = 'float grain=sin(palacePoint.x*31.0+palacePoint.y*27.0)*sin(palacePoint.z*39.0-palacePoint.y*41.0);float pigment=0.94+grain*0.025;';
      const wood = 'float grain=sin(palacePoint.z*7.0+sin(palacePoint.x*0.75)*2.0);float pigment=0.87+grain*0.06;';
      const textile = 'float threads=sin(palacePoint.x*34.0)*sin((palacePoint.y+palacePoint.z)*36.0);float pigment=0.91+threads*0.045;';
      const detail = ['ivory', 'lapis', 'mosaic'].includes(key) ? marble : key === 'wood' ? wood : ['velvet', 'wine', 'drape'].includes(key) ? textile : stone;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${detail}\ndiffuseColor.rgb*=pigment;`);
    };
    surface.customProgramCacheKey = () => `palace-crafted-${key}-2`;
  }
  return materials;
}

export function beam(shop, start, end, radius = 0.08, material = 'gold', name = '') {
  const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
  const length = direction.length(); if (length < 0.001) return;
  const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.divideScalar(length)));
  shop.add(radius < 0.16 ? 'filament' : 'cylinder', material, start.map((value, index) => (value + end[index]) / 2), [radius, length, radius], [rotation.x, rotation.y, rotation.z], false, name);
}

export function shellCrest(shop, position, width = 4, material = 'gold', yaw = 0) {
  const place = (across, height, depth) => [position[0] + across * Math.cos(yaw) + depth * Math.sin(yaw), position[1] + height, position[2] - across * Math.sin(yaw) + depth * Math.cos(yaw)];
  shop.add('shell', material, position, [width, width, width], [0, yaw, 0], false, '雕刻贝冠浮雕');
  for (let rib = 0; rib < 5; rib++) {
    const angle = -1.25 + rib / 4 * 2.5;
    const length = width * (0.65 + Math.cos(angle) * 0.25);
    shop.add('bead', 'pearl', place(Math.sin(angle) * length * 0.55, Math.cos(angle) * length, 0), [width * 0.03, width * 0.045, width * 0.03]);
  }
  shop.add('jewel', 'lapis', place(0, width * 0.12, width * 0.06), [width * 0.17, width * 0.24, width * 0.1], [0, yaw, 0], false, '海蓝石徽章');
}

export function column(shop, horizontal, depth, bottom, height, radius = 0.65) {
  shop.add('shaft', 'pale', [horizontal, bottom + height / 2, depth], [radius, height - radius * 1.5, radius], [0, 0, 0], true, '凹槽石柱');
  for (const elevation of [bottom + 0.28, bottom + height - 0.28]) {
    shop.add('box', 'ivory', [horizontal, elevation, depth], [radius * 3, 0.55, radius * 3]);
    shop.add('cylinder', 'gold', [horizontal, elevation + (elevation < bottom + 1 ? 0.5 : -0.5), depth], [radius * 1.07, 0.16, radius * 1.07]);
  }
  if (height < 8) return;
  for (let petal = 0; petal < 8; petal++) {
    const angle = petal / 8 * Math.PI * 2;
    shop.add('leaf', 'gold', [horizontal + Math.sin(angle) * radius * 0.96, bottom + height - 1.04, depth + Math.cos(angle) * radius * 0.96], [radius * 0.29, radius * 0.78, radius * 0.2], [Math.sin(angle) * 0.32, angle, Math.cos(angle) * 0.32], false, '莨苕叶柱头');
  }
}

export function moldingFrame(shop, center, width, height, yaw = 0, material = 'gold', thickness = 0.14) {
  const place = (across, elevation, scale) => shop.add('box', material, [center[0] + Math.cos(yaw) * across, center[1] + elevation, center[2] - Math.sin(yaw) * across], scale, [0, yaw, 0], false, '镶金线脚');
  for (const sign of [-1, 1]) {
    place(sign * width / 2, 0, [thickness, height, thickness * 1.5]);
    place(0, sign * height / 2, [width, thickness, thickness * 1.5]);
  }
}
