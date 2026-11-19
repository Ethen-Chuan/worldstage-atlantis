import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { seaHeight } from './terrain.js';

export const PALACE_CENTER = [-610, 0, 440];
export const PALACE_ROOMS = Object.freeze([
  { id: 'reception', name: '珍珠接待厅', center: [0, 26], view: [0, 8, 43], target: [0, 10, 3], description: '双阶迎宾台、珍珠吊灯与潮汐纹章。' },
  { id: 'salon', name: '蓝绒客厅', center: [-35, -27], view: [-19, 7, -19], target: [-43, 5, -30], description: '围合沙发、低茶几、贝瓷茶具与藏书。' },
  { id: 'banquet', name: '金枝宴会厅', center: [35, -27], view: [18, 7, -17], target: [37, 5, -32], description: '十二席长桌、成套餐盘、高脚杯与银色刀叉。' },
  { id: 'bedroom', name: '月贝寝宫', center: [-35, -81], view: [-19, 7, -72], target: [-43, 6, -86], description: '四柱帷幔床、床头柜、梳妆台与更衣柜。' },
  { id: 'club', name: '观海会所', center: [35, -81], view: [18, 7, -72], target: [43, 6, -87], description: '弧形酒柜、会客座席与通向深海的观景窗。' },
]);

class PalaceWorkshop {
  constructor(materials) {
    this.materials = materials; this.batches = new Map(); this.colliders = []; this.transform = new THREE.Object3D();
    this.geometries = { box: new THREE.BoxGeometry(1, 1, 1), soft: new RoundedBoxGeometry(1, 1, 1, 2, 0.12), cylinder: new THREE.CylinderGeometry(1, 1, 1, 24), cone: new THREE.ConeGeometry(1, 1, 24), sphere: new THREE.SphereGeometry(1, 12, 8), ring: new THREE.TorusGeometry(1, 0.025, 5, 48), cup: new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2) };
    this.geometries.inlay = new THREE.RingGeometry(0.991, 1, 64);
  }
  add(type, material, position, scale, rotation = [0, 0, 0], solid = false, name = '') {
    this.transform.position.fromArray(position); this.transform.scale.fromArray(scale); this.transform.rotation.set(...rotation); this.transform.updateMatrix();
    const key = `${type}:${material}:${name}`;
    if (!this.batches.has(key)) this.batches.set(key, { geometry: this.geometries[type], material: this.materials[material], matrices: [], name });
    this.batches.get(key).matrices.push(this.transform.matrix.clone());
    if (solid) {
      this.geometries[type].computeBoundingBox();
      const bounds = this.geometries[type].boundingBox.clone().applyMatrix4(this.transform.matrix);
      this.colliders.push({ min: bounds.min.toArray(), max: bounds.max.toArray() });
    }
  }
  finish(name) {
    const root = new THREE.Group(); root.name = name; root.userData.collisionBoxes = this.colliders;
    const used = new Set();
    for (const batch of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.name = batch.name || name;
      mesh.castShadow = false; mesh.receiveShadow = true; root.add(mesh); used.add(batch.geometry);
    }
    for (const geometry of Object.values(this.geometries)) if (!used.has(geometry)) geometry.dispose();
    return root;
  }
}

function palaceMaterials() {
  const material = (color, roughness, metalness = 0, options = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
  const materials = {
    stone: material('#527576', 0.87), pale: material('#b0b6a1', 0.7), ivory: material('#ddd6bb', 0.35),
    gold: material('#c89d50', 0.32, 0.72), dark: material('#142f3d', 0.83), roof: material('#123340', 0.55, 0.23),
    wood: material('#413c36', 0.65), velvet: material('#20606a', 0.88), wine: material('#654a61', 0.82),
    pearl: material('#e8dfc3', 0.25, 0.15), silver: material('#bbc5c3', 0.25, 0.85),
    light: material('#ffd38b', 0.3, 0, { emissive: '#e6a348', emissiveIntensity: 1.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#94cbd0', roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
  };
  for (const key of ['stone', 'ivory', 'pale', 'wood', 'roof', 'velvet']) {
    const surface = materials[key];
    surface.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 palacePoint;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 palaceWorld=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\npalaceWorld=instanceMatrix*palaceWorld;\n#endif\npalacePoint=(modelMatrix*palaceWorld).xyz;');
      shader.fragmentShader = 'varying vec3 palacePoint;\n' + shader.fragmentShader;
      const detail = key === 'stone' || key === 'pale' ? 'vec2 tile=vec2(palacePoint.x+palacePoint.z+mod(floor(palacePoint.y/2.0),2.0)*2.5,palacePoint.y);vec2 seam=abs(fract(tile/vec2(5.0,2.0))-0.5);float pigment=1.0-smoothstep(0.475,0.495,max(seam.x,seam.y))*0.22;' : key === 'ivory' ? 'float vein=sin(palacePoint.x*0.31+palacePoint.z*0.44+sin(palacePoint.z*0.8)*1.2+sin(palacePoint.x*1.7)*0.22);float pigment=0.9+pow(abs(vein),14.0)*0.1;' : key === 'wood' ? 'float pigment=0.8+sin(palacePoint.z*12.0+sin(palacePoint.x*0.6)*2.0)*0.05;' : 'float pigment=0.92+sin(palacePoint.x*24.0)*sin(palacePoint.y*24.0)*0.06;';
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${detail}\ndiffuseColor.rgb*=pigment;`);
    };
    surface.customProgramCacheKey = () => `palace-${key}-1`;
  }
  return materials;
}

function ring(shop, material, position, radius, vertical = false) {
  shop.add('ring', material, position, [radius, radius, radius], [vertical ? 0 : Math.PI / 2, 0, 0]);
}

function column(shop, horizontal, depth, bottom, height, radius = 0.65) {
  shop.add('cylinder', 'pale', [horizontal, bottom + height / 2, depth], [radius, height, radius], [0, 0, 0], true);
  for (const elevation of [bottom + 0.4, bottom + height - 0.4]) {
    shop.add('box', 'ivory', [horizontal, elevation, depth], [radius * 2.8, 0.8, radius * 2.8]);
    shop.add('cylinder', 'gold', [horizontal, elevation + 0.5, depth], [radius * 1.12, 0.18, radius * 1.12]);
  }
}

function rail(shop, start, end, bottom = 1, height = 3) {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const angle = Math.atan2(end[0] - start[0], end[1] - start[1]);
  shop.add('box', 'pale', [(start[0] + end[0]) / 2, bottom + height, (start[1] + end[1]) / 2], [0.65, 0.45, length], [0, angle, 0]);
  const count = Math.ceil(length / 2.8);
  for (let index = 0; index <= count; index++) {
    const progress = index / count; const horizontal = THREE.MathUtils.lerp(start[0], end[0], progress); const depth = THREE.MathUtils.lerp(start[1], end[1], progress);
    shop.add('cylinder', 'pale', [horizontal, bottom + height / 2, depth], [0.18, height, 0.18]);
    shop.add('sphere', 'gold', [horizontal, bottom + height * 0.62, depth], [0.27, 0.48, 0.27]);
  }
}

function arch(shop, horizontal, depth, bottom, width, height, side = false) {
  for (let index = 0; index <= 18; index++) {
    const angle = index / 18 * Math.PI;
    const across = Math.cos(angle) * width / 2;
    shop.add('box', 'gold', [horizontal + (side ? 0 : across), bottom + height - width / 2 + Math.sin(angle) * width / 2, depth + (side ? across : 0)], side ? [0.4, 0.3, width * 0.1] : [width * 0.1, 0.3, 0.4], [side ? -angle - Math.PI / 2 : 0, 0, side ? 0 : angle + Math.PI / 2]);
  }
}

function wall(shop, start, end, { door = false, side = false, height = 22, window = false } = {}) {
  const midpoint = start.map((value, index) => (value + end[index]) / 2);
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const box = (across, elevation, width, tall, material, solid, thickness = material === 'stone' ? 1.4 : 1.52) => shop.add('box', material, [midpoint[0] + (side ? 0 : across), elevation, midpoint[1] + (side ? across : 0)], side ? [thickness, tall, width] : [width, tall, thickness], [0, 0, 0], solid);
  if (window) {
    box(0, 2.5, length, 5, 'stone', true); box(0, 19.5, length, 5, 'stone', true);
    for (const sign of [-1, 1]) box(sign * (length + 25) / 4, 11, (length - 25) / 2, 12, 'stone', true);
    box(0, 11, 25, 12, 'glass', true);
    for (const across of [-12.5, -6.25, 0, 6.25, 12.5]) box(across, 11, 0.2, 12, 'gold', false);
    box(0, 11, 25, 0.2, 'gold', false);
  } else if (door) {
    for (const sign of [-1, 1]) box(sign * (length + 14) / 4, height / 2, (length - 14) / 2, height, 'stone', true);
    box(0, (height + 14) / 2, 14, height - 14, 'stone', true);
    for (let segment = 0; segment < 16; segment++) {
      const across = -7 + (segment + 0.5) * 14 / 16; const archHeight = 7 + Math.sqrt(Math.max(0, 49 - across * across));
      box(across, (14 + archHeight) / 2, 14 / 16 + 0.02, Math.max(0.02, 14 - archHeight), 'stone', true);
    }
    arch(shop, midpoint[0], midpoint[1], 0, 14, 14, side);
  } else box(0, height / 2, length, height, 'stone', true);
  for (const elevation of [1, 4, 20.7]) {
    if (door && elevation < 14) for (const sign of [-1, 1]) box(sign * (length + 14) / 4, elevation, (length - 14) / 2, 0.2, 'gold', false);
    else box(0, elevation, length, 0.2, 'gold', false);
  }
  for (let offset = -length / 2 + 5; offset < length / 2; offset += 9) {
    if ((door && Math.abs(offset) < 10) || (window && Math.abs(offset) < 14)) continue;
    box(offset, 7, 0.22, 4, 'gold', false);
    box(offset, 17.2, 0.22, 4.4, 'gold', false);
    box(offset, 12, 1.3, 4.8, 'light', false, 1.9);
    for (const elevation of [9.4, 14.6]) box(offset, elevation, 1.7, 0.25, 'gold', false, 2.03);
    for (const across of [-3, 3]) box(offset + across, 2.4, 0.13, 2.7, 'pale', false, 1.6);
    box(offset, 2.4, 0.8, 0.8, 'gold', false, 1.63);
  }
}

function chandelier(shop, horizontal, depth, elevation = 17, radius = 4) {
  shop.add('cylinder', 'gold', [horizontal, (elevation + 22) / 2, depth], [0.1, 22 - elevation, 0.1]);
  for (const tier of [0, 1]) {
    ring(shop, 'gold', [horizontal, elevation - tier * 1.5, depth], radius * (1 - tier * 0.38));
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2;
      const lateral = horizontal + Math.cos(angle) * radius * (1 - tier * 0.38); const distance = depth + Math.sin(angle) * radius * (1 - tier * 0.38);
      shop.add('sphere', 'light', [lateral, elevation - tier * 1.5, distance], [0.18, 0.36, 0.18]);
      shop.add('cone', 'pearl', [lateral, elevation - tier * 1.5 - 0.85, distance], [0.2, 0.85, 0.2], [Math.PI, 0, 0]);
    }
  }
}

function seat(shop, horizontal, depth, yaw = 0, wide = false) {
  const width = wide ? 10 : 3.1;
  const place = (type, material, point, scale, solid = false) => {
    const local = new THREE.Vector3(...point).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    shop.add(type, material, [horizontal + local.x, local.y, depth + local.z], scale, [0, yaw, 0], solid, wide ? '蓝绒长沙发' : '雕花扶手椅');
  };
  place('soft', 'velvet', [0, 2.1, 0], [width, 1.3, 3.3], true);
  place('soft', 'velvet', [0, 4.1, 1.4], [width, 3.4, 0.9], true);
  place('soft', 'gold', [0, 5.85, 1.4], [width + 0.12, 0.16, 1]);
  for (let button = 0; button < (wide ? 7 : 2); button++) place('sphere', 'gold', [(button - (wide ? 3 : 0.5)) * 1.15, 4.6, 0.92], [0.075, 0.075, 0.04]);
  for (const sign of [-1, 1]) {
    place('soft', 'gold', [sign * (width / 2 - 0.25), 3.4, 0], [0.45, 0.55, 3.3]);
    for (const edge of [-1, 1]) place('cylinder', 'gold', [sign * (width / 2 - 0.5), 0.8, edge], [0.15, 1.6, 0.15]);
  }
}

function table(shop, horizontal, depth, width, length, elevation = 4) {
  shop.add('soft', 'wood', [horizontal, elevation, depth], [width, 0.5, length], [0, 0, 0], true, '金边实木桌');
  shop.add('box', 'gold', [horizontal, elevation - 0.3, depth], [width + 0.1, 0.12, length + 0.1]);
  for (const lateral of [-1, 1]) for (const along of [-1, 1]) shop.add('cylinder', 'gold', [horizontal + lateral * (width / 2 - 0.7), elevation / 2, depth + along * (length / 2 - 0.7)], [0.2, elevation, 0.2]);
}

function placeSetting(shop, horizontal, depth, elevation, sign = 1) {
  shop.add('cylinder', 'ivory', [horizontal, elevation + 0.35, depth], [0.8, 0.09, 0.8], [0, 0, 0], false, '贝瓷餐盘与银制餐具');
  ring(shop, 'gold', [horizontal, elevation + 0.41, depth], 0.74);
  shop.add('cylinder', 'gold', [horizontal + sign * 0.95, elevation + 0.35, depth - 0.85], [0.27, 0.05, 0.27]);
  shop.add('cylinder', 'gold', [horizontal + sign * 0.95, elevation + 0.72, depth - 0.85], [0.045, 0.7, 0.045]);
  shop.add('cup', 'pearl', [horizontal + sign * 0.95, elevation + 1.35, depth - 0.85], [0.4, 0.7, 0.4], [0, 0, 0], false, '珍珠高脚杯');
  for (const side of [-1, 1]) shop.add('box', 'silver', [horizontal + side * 1.12, elevation + 0.38, depth + 0.12], [0.1, 0.07, 1.25]);
  for (let tine = 0; tine < 3; tine++) shop.add('box', 'silver', [horizontal - 1.12 + (tine - 1) * 0.075, elevation + 0.38, depth - 0.56], [0.035, 0.06, 0.35]);
}

function furnishings(room, materials) {
  const shop = new PalaceWorkshop(materials); const [horizontal, depth] = room.center;
  chandelier(shop, horizontal, depth, 17, room.id === 'reception' ? 6 : 4);
  if (room.id === 'reception') {
    for (const side of [-1, 1]) {
      table(shop, side * 23, 13, 10, 7, 5); seat(shop, side * 23, 7);
      for (const distance of [9, 44]) column(shop, side * 27, distance, 0, 22, 0.9);
      shop.add('sphere', 'pearl', [side * 23, 6.5, 13], [1.1, 1.1, 1.1]);
      seat(shop, side * 23, 37, side * Math.PI / 2, true);
    }
    for (const radius of [7, 11, 15]) shop.add('inlay', 'gold', [0, 0.018, 26], [radius, radius, 1], [-Math.PI / 2, 0, 0]);
  } else if (room.id === 'salon') {
    seat(shop, -46, -27, -Math.PI / 2, true); seat(shop, -35, -42, Math.PI, true); seat(shop, -32, -13, 0, true);
    table(shop, -36, -27, 9, 10, 2.7);
    for (const side of [-1, 1]) placeSetting(shop, -36 + side * 2.3, -27, 2.7, side);
    shop.add('box', 'wood', [-55, 6, -43], [3, 12, 12], [0, 0, 0], true, '海国藏书柜');
    for (let index = 0; index < 36; index++) shop.add('box', index % 3 ? 'wine' : 'gold', [-53.35, 2 + Math.floor(index / 12) * 3.6, -48 + index % 12 * 0.88], [0.35, 2.6 + index % 3 * 0.15, 0.58]);
  } else if (room.id === 'banquet') {
    table(shop, 36, -27, 10, 31);
    for (let index = 0; index < 6; index++) for (const side of [-1, 1]) {
      const distance = -40 + index * 5;
      seat(shop, 36 + side * 8, distance, side * Math.PI / 2);
      placeSetting(shop, 36 + side * 3.2, distance, 4, side);
    }
    for (const distance of [-37, -27, -17]) {
      shop.add('cylinder', 'gold', [36, 5.3, distance], [0.3, 2.3, 0.3]);
      shop.add('sphere', 'light', [36, 6.7, distance], [0.55, 0.65, 0.55]);
    }
    table(shop, 53, -27, 3.2, 28, 4);
  } else if (room.id === 'bedroom') {
    shop.add('soft', 'wood', [-42, 1.5, -86], [16, 3, 19], [0, 0, 0], true, '四柱帷幔床');
    shop.add('soft', 'ivory', [-42, 3.3, -86], [15, 2, 18]);
    shop.add('soft', 'wine', [-42, 4.35, -83], [15.1, 0.3, 12]);
    shop.add('soft', 'wood', [-42, 6, -96], [16, 10, 1.1], [0, 0, 0], true, '贝冠雕花床头');
    for (let rib = 0; rib < 9; rib++) shop.add('box', 'gold', [-48 + rib * 1.5, 7, -95.38], [0.12, 5.5 + Math.cos((rib - 4) * 0.3) * 1.8, 0.16]);
    for (const elevation of [2, 10.9]) shop.add('box', 'gold', [-42, elevation, -95.35], [16, 0.16, 0.16]);
    for (const side of [-1, 1]) {
      shop.add('soft', 'pearl', [-42 + side * 3.7, 4.6, -92], [6, 1.1, 3]);
      table(shop, -42 + side * 12, -91, 4.4, 4.4, 4);
      shop.add('sphere', 'light', [-42 + side * 12, 6, -91], [0.8, 1, 0.8]);
      for (const edge of [-1, 1]) column(shop, -42 + side * 8, -86 + edge * 10, 0, 15, 0.28);
    }
    shop.add('soft', 'wine', [-42, 15.2, -86], [17.5, 0.7, 21]);
    for (const side of [-1, 1]) shop.add('box', 'velvet', [-42 + side * 7.8, 10.2, -94], [0.2, 9.2, 4]);
    table(shop, -29, -102, 12, 3, 4);
    ring(shop, 'gold', [-29, 8.5, -102.6], 3, true);
    shop.add('sphere', 'silver', [-29, 8.5, -102.65], [2.8, 2.8, 0.08]);
    shop.add('soft', 'wood', [-54, 6, -64], [9, 12, 4], [0, 0, 0], true, '镶金更衣柜');
    for (const lateral of [-56, -52]) shop.add('sphere', 'gold', [lateral, 5.8, -61.8], [0.16, 0.16, 0.12]);
  } else {
    table(shop, 48, -93, 5, 21, 4.5);
    for (let index = 0; index < 5; index++) {
      seat(shop, 41, -102 + index * 4.6, -Math.PI / 2);
      placeSetting(shop, 47, -102 + index * 4.6, 4.5);
    }
    seat(shop, 30, -66, 0, true); seat(shop, 48, -68, Math.PI / 2, true); table(shop, 36, -73, 8, 6, 2.5);
    for (let row = 0; row < 3; row++) {
      shop.add('box', 'gold', [57, 3 + row * 3.2, -92], [3, 0.15, 23]);
      for (let index = 0; index < 14; index++) {
        shop.add('cylinder', index % 3 ? 'glass' : 'wine', [57, 4.1 + row * 3.2, -102 + index * 1.5], [0.33, 1.9, 0.33]);
        shop.add('cylinder', 'gold', [57, 5.2 + row * 3.2, -102 + index * 1.5], [0.13, 0.3, 0.13]);
      }
    }
  }
  return shop.finish(room.name);
}

function tower(shop, horizontal, depth, bottom, height, radius) {
  shop.add('cylinder', 'stone', [horizontal, bottom + height / 2, depth], [radius, height, radius], [0, 0, 0], true);
  shop.add('cylinder', 'pale', [horizontal, bottom + 1.4, depth], [radius * 1.14, 2.8, radius * 1.14]);
  for (let tier = 0; tier < 4; tier++) {
    const elevation = bottom + 4 + tier * (height - 7) / 3;
    shop.add('cylinder', 'pale', [horizontal, elevation, depth], [radius * 1.07, 1.1, radius * 1.07]);
    ring(shop, 'gold', [horizontal, elevation + 0.7, depth], radius * 1.07);
    for (let side = 0; side < 8; side++) {
      const angle = side / 8 * Math.PI * 2;
      const place = (across, above, material, scale) => {
        const reach = radius + 0.24;
        shop.add('box', material, [horizontal + Math.sin(angle) * reach + Math.cos(angle) * across, elevation + above, depth + Math.cos(angle) * reach - Math.sin(angle) * across], scale, [0, angle, 0]);
      };
      shop.add('box', 'light', [horizontal + Math.sin(angle) * (radius + 0.08), elevation + 4, depth + Math.cos(angle) * (radius + 0.08)], [1, 3.7, 0.25], [0, angle, 0]);
      for (const edge of [-1, 1]) place(edge * 0.76, 4, 'pale', [0.22, 4.7, 0.32]);
      place(0, 1.65, 'gold', [1.9, 0.2, 0.5]); place(0, 6.4, 'pale', [1.9, 0.35, 0.5]);
    }
  }
  shop.add('cone', 'roof', [horizontal, bottom + height + radius * 1.7, depth], [radius * 1.25, radius * 3.6, radius * 1.25], [0, 0, 0], true);
  for (let tier = 0; tier < 4; tier++) {
    const elevation = radius * (tier * 0.7 + 0.08); const reach = radius * 1.25 * (1 - (elevation + radius * 0.1) / (radius * 3.6));
    ring(shop, tier ? 'roof' : 'gold', [horizontal, bottom + height + elevation, depth], reach + 0.05);
  }
  shop.add('cone', 'gold', [horizontal, bottom + height + radius * 3.8, depth], [0.28, radius * 0.9, 0.28]);
  for (let edge = 0; edge < 8; edge++) {
    const angle = edge / 8 * Math.PI * 2;
    shop.add('box', 'pale', [horizontal + Math.sin(angle) * radius * 1.06, bottom + height + 1, depth + Math.cos(angle) * radius * 1.06], [1.5, 2.6, 1.2], [0, angle, 0]);
    const pilasterAngle = angle + Math.PI / 8;
    shop.add('box', 'pale', [horizontal + Math.sin(pilasterAngle) * radius, bottom + height / 2, depth + Math.cos(pilasterAngle) * radius], [0.5, height - 2, 0.5], [0, pilasterAngle, 0]);
  }
}

export class PalaceDistrict {
  constructor(scene) { this.scene = scene; this.root = new THREE.Group(); this.root.name = '潮冠宫城'; this.root.visible = false; this.scene.add(this.root); this.rooms = new Map(); this.visited = new Set(); this.activeRoom = null; }
  prepare() {
    if (this.ready) return;
    this.ready = true; this.materials = palaceMaterials(); this.base = seaHeight(PALACE_CENTER[0], PALACE_CENTER[2]) + 12;
    const shop = new PalaceWorkshop(this.materials);
    shop.add('box', 'dark', [0, -5, -25], [166, 9.6, 204], [0, 0, 0], true);
    for (let tier = 0; tier < 3; tier++) shop.add('box', 'pale', [0, -9.5 + tier * 3.1, -25], [171 - tier * 2, 0.7, 209 - tier * 2]);
    shop.add('box', 'ivory', [0, -0.25, -27], [126, 0.5, 164], [0, 0, 0], true);
    shop.add('box', 'dark', [0, 23, -27], [126, 2, 164], [0, 0, 0], true);
    wall(shop, [-63, 54], [63, 54], { door: true }); wall(shop, [-63, -108], [-8, -108], { window: true }); wall(shop, [8, -108], [63, -108], { window: true }); wall(shop, [-8, -108], [8, -108]);
    for (const side of [-1, 1]) {
      wall(shop, [side * 63, -108], [side * 63, 54], { side: true });
      wall(shop, [side * 8, -54], [side * 8, 0], { side: true, door: true });
      wall(shop, [side * 8, -108], [side * 8, -54], { side: true, door: true });
      wall(shop, [side * 8, -54], [side * 63, -54]);
      for (let distance = -101; distance < 52; distance += 12) {
        for (const elevation of [6, 15]) shop.add('box', 'light', [side * 63.78, elevation, distance], [0.15, 5.5, 2.2]);
        column(shop, side * 66, distance, 0, 25, 0.7);
      }
      for (const distance of [-108, -27, 54]) tower(shop, side * 72, distance, 0, distance === -108 ? 75 : 58, 9);
      for (let avenue = 0; avenue < 4; avenue++) tower(shop, side * (112 + avenue % 2 * 32), -102 + avenue * 48, -5, 30 + avenue % 3 * 9, 8);
      shop.add('box', 'stone', [side * 123, 1, -26], [52, 2, 168], [0, 0, 0], true);
      shop.add('box', 'pale', [side * 121, 18, -26], [18, 1.2, 154], [0, 0, 0], true);
      for (let distance = -91; distance <= 37; distance += 16) {
        for (const edge of [-1, 1]) column(shop, side * 121 + edge * 7, distance, 2, 15, 0.65);
        arch(shop, side * 121, distance, 2, 14, 15);
      }
      for (const edge of [-1, 1]) rail(shop, [side * 121 + edge * 8, -101], [side * 121 + edge * 8, 49], 18.5, 2.5);
      rail(shop, [side * 14, 73], [side * 81, 73], 0, 3);
      for (let planter = 0; planter < 4; planter++) {
        const lateral = side * (28 + planter * 14);
        shop.add('cylinder', 'pale', [lateral, 1, 66], [2.7, 2, 2.7]);
        shop.add('cup', 'gold', [lateral, 4, 66], [2.9, 3, 2.9]);
        for (let stem = 0; stem < 7; stem++) {
          const angle = stem / 7 * Math.PI * 2;
          shop.add('sphere', 'velvet', [lateral + Math.sin(angle) * 1.4, 4 + Math.sin(stem * 3) * 0.8, 66 + Math.cos(angle) * 1.4], [0.7, 1.8, 0.7]);
          shop.add('sphere', 'pearl', [lateral + Math.sin(angle) * 1.4, 5.6 + Math.sin(stem * 3) * 0.8, 66 + Math.cos(angle) * 1.4], [0.15, 0.22, 0.15]);
        }
      }
    }
    wall(shop, [-63, 0], [63, 0], { door: true });
    for (let distance = -104; distance < 55; distance += 7) {
      shop.add('box', 'gold', [0, 0.06, distance], [0.18, 0.04, 3]);
      for (const side of [-1, 1]) shop.add('box', 'gold', [side * 6, 0.06, distance], [0.12, 0.04, 7]);
    }
    tower(shop, 0, -77, 24, 87, 17);
    for (const side of [-1, 1]) tower(shop, side * 33, -60, 24, 49, 11);
    tower(shop, 0, 11, 24, 33, 15);
    for (const side of [-1, 1]) {
      shop.add('box', 'stone', [side * 36, 39, 14], [31, 30, 43], [0, 0, 0], true);
      shop.add('cone', 'roof', [side * 36, 64, 14], [24, 24, 32], [0, Math.PI / 4, 0], true);
      for (let tier = 0; tier < 3; tier++) {
        shop.add('box', 'gold', [side * 36, 27 + tier * 10, 35.8], [32, 0.3, 0.3]);
        for (let index = 0; index < 5; index++) {
          const lateral = side * 36 + (index - 2) * 5.3;
          shop.add('box', 'dark', [lateral, 31 + tier * 10, 35.6], [2.6, 7, 0.5]);
          shop.add('box', 'light', [lateral, 31 + tier * 10, 35.92], [0.9, 5.8, 0.14]);
          arch(shop, lateral, 36.1, 27 + tier * 10, 2.8, 8);
        }
      }
      for (const elevation of [24.8, 34.8, 44.8, 54.5]) shop.add('box', 'pale', [side * 36, elevation, 14], [32.5, 0.7, 44.5]);
      for (const lateral of [-14, -8, 8, 14]) shop.add('box', 'pale', [side * 36 + lateral, 39, 36], [0.6, 29, 0.8]);
    }
    for (let depth = -102; depth < 50; depth += 13) {
      shop.add('box', 'gold', [0, 21.8, depth], [124, 0.18, 0.35]);
      for (const lateral of [-56, -35, -14, 14, 35, 56]) shop.add('box', 'gold', [lateral, 21.8, depth + 6.5], [0.3, 0.18, 13]);
    }
    for (let step = 0; step < 6; step++) shop.add('box', step % 2 ? 'pale' : 'stone', [0, -5.5 + step * 0.8, 66 - step * 1.5], [55 - step * 2, 0.8, 4]);
    shop.add('box', 'pale', [0, -1, 92], [23, 1.7, 78], [0, 0, 0], true);
    for (const side of [-1, 1]) {
      shop.add('box', 'gold', [side * 11, 3.4, 92], [0.4, 0.35, 76]);
      for (let distance = 59; distance < 131; distance += 5) {
        column(shop, side * 11, distance, 0, 3.3, 0.22);
        shop.add('sphere', 'light', [side * 11, 4, distance], [0.3, 0.4, 0.3]);
      }
      column(shop, side * 9, 55, 0, 15, 0.75);
    }
    arch(shop, 0, 55, 0, 18, 19);
    this.root.add(shop.finish('潮冠宫城 · 连廊与尖塔'));
    const entrance = new THREE.Mesh(new THREE.TorusGeometry(2, 0.08, 6, 48), this.materials.light);
    entrance.name = '进入珍珠接待厅'; entrance.position.set(0, 6, 57); entrance.userData.palaceDestination = 'reception'; this.root.add(entrance);
    const pickMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
    const hitArea = (marker, radius) => {
      const hit = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), pickMaterial);
      hit.name = marker.name; hit.userData.palaceDestination = marker.userData.palaceDestination; hit.userData.noAO = true; marker.add(hit);
    };
    hitArea(entrance, 2.7);
    for (const room of PALACE_ROOMS.slice(1)) {
      const marker = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32), this.materials.light);
      marker.position.set(Math.sign(room.center[0]) * 8, 6, room.center[1]); marker.rotation.y = Math.PI / 2;
      marker.name = `进入${room.name}`; marker.userData.palaceDestination = room.id; this.root.add(marker);
      hitArea(marker, 1.7);
    }
    this.fill = new THREE.PointLight('#ffe0a2', 80, 60, 1.2); this.fill.castShadow = false; this.root.add(this.fill);
  }
  roomAt(position) {
    if (!this.ready || position.y < this.base || position.y > this.base + 22) return null;
    const lateral = position.x - PALACE_CENTER[0]; const depth = position.z - PALACE_CENTER[2];
    if (Math.abs(lateral) > 62 || depth > 54 || depth < -108) return null;
    if (depth >= 0) return PALACE_ROOMS[0];
    if (Math.abs(lateral) < 8) return { id: 'gallery', name: '潮光长廊' };
    return PALACE_ROOMS.find(room => Math.sign(room.center[0]) === Math.sign(lateral) && Math.abs(room.center[1] - depth) <= 27);
  }
  route(position, id) {
    this.prepare(); const room = PALACE_ROOMS.find(candidate => candidate.id === id); if (!room && id !== 'exit') return null;
    const local = position.clone().sub(new THREE.Vector3(PALACE_CENTER[0], this.base, PALACE_CENTER[2]));
    const current = this.roomAt(position); const points = [];
    if (current && current.id !== 'reception' && current.id !== 'gallery') points.push([Math.sign(local.x) * 18, 7, current.center[1]], [0, 7, current.center[1]]);
    else if (current?.id === 'reception') points.push([0, 7, 26]);
    else if (!current) {
      if (local.length() > 440 || local.z < 54) return null;
      if (local.z > 130 || Math.abs(local.x) > 30) points.push([0, 40, 175], [0, 7, 125]);
      points.push([0, 7, 75], [0, 7, 39]);
    }
    if (id === 'exit') points.push([0, 7, 26], [0, 7, 80]);
    else if (id === 'reception') points.push(room.view);
    else points.push([0, 7, room.center[1]], [Math.sign(room.center[0]) * 18, 7, room.center[1]], room.view);
    const translate = point => new THREE.Vector3(...point).add(new THREE.Vector3(PALACE_CENTER[0], this.base, PALACE_CENTER[2])).toArray();
    return { points: points.map(translate), target: translate(room?.target || [0, 10, 145]), name: room?.name || '宫城前庭' };
  }
  update(position, offset) {
    const distance = Math.hypot(position.x - PALACE_CENTER[0], position.z - PALACE_CENTER[2]);
    if (distance < 670) this.prepare();
    if (!this.ready) return;
    this.root.visible = distance < 900; this.root.position.set(PALACE_CENTER[0], this.base, PALACE_CENTER[2]).sub(offset);
    this.activeRoom = this.roomAt(position);
    if (this.activeRoom) this.visited.add(this.activeRoom.id);
    for (const room of PALACE_ROOMS) {
      const close = Math.hypot(position.x - PALACE_CENTER[0] - room.center[0], position.z - PALACE_CENTER[2] - room.center[1]) < 95 && position.y < this.base + 38;
      if (close && !this.rooms.has(room.id)) { const root = furnishings(room, this.materials); this.root.add(root); this.rooms.set(room.id, root); }
      if (this.rooms.has(room.id)) this.rooms.get(room.id).visible = close;
    }
    this.fill.visible = Boolean(this.activeRoom); this.fill.position.set(position.x - PALACE_CENTER[0], 15, position.z - PALACE_CENTER[2] - 6);
  }
  inspect() { return { ready: Boolean(this.ready), room: this.activeRoom?.id || null, visited: [...this.visited], loadedRooms: [...this.rooms.keys()], base: this.base, name: '潮冠宫城' }; }
}
