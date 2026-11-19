import * as THREE from 'three';
import { beam, column, shellCrest } from './palace-craft.js';
import { decorateRoom, floorMedallion } from './palace-ornaments.js';

export function livingSpaceMaterials(materials, clock) {
  const palette = { seagrass: '#376f65', kelp: '#73866a', coralRose: '#bc7f86', coralAmber: '#b69569' };
  for (const [name, color] of Object.entries(palette)) {
    const surface = new THREE.MeshStandardMaterial({ color, roughness: 0.74, side: THREE.DoubleSide, envMap: materials.pale.envMap, envMapIntensity: 0.32 });
    surface.name = `潮汐内花园 · ${name}`;
    if (['seagrass', 'kelp'].includes(name)) {
      surface.onBeforeCompile = shader => {
        shader.uniforms.gardenTime = clock;
        shader.vertexShader = 'uniform float gardenTime;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float gardenPhase=0.0;
          #ifdef USE_INSTANCING
            gardenPhase=instanceMatrix[3].x*0.23+instanceMatrix[3].z*0.17;
          #endif
          transformed.x+=sin(gardenTime*0.7+gardenPhase+position.y*2.0)*position.y*position.y*0.09;
          transformed.z+=cos(gardenTime*0.5+gardenPhase)*position.y*position.y*0.045;`);
      };
      surface.customProgramCacheKey = () => 'palace-rooted-seagrass-1';
    }
    materials[name] = surface;
  }
  materials.gardenGlow = new THREE.MeshStandardMaterial({ color: '#d1e5cd', emissive: '#7da994', emissiveIntensity: 0.45, roughness: 0.45 });
  materials.invitationGlow = new THREE.MeshStandardMaterial({ color: '#d4be8a', emissive: '#e4b868', emissiveIntensity: 0.05, roughness: 0.42 });
  materials.guestGlow = new THREE.MeshStandardMaterial({ color: '#eee4c7', emissive: '#f1ca80', emissiveIntensity: 0.04, roughness: 0.25 });
}

function prepareBlade(shop) {
  if (shop.geometries.seagrassBlade) return;
  const blade = new THREE.PlaneGeometry(1, 1, 2, 10).translate(0, 0.5, 0);
  const points = blade.attributes.position;
  for (let index = 0; index < points.count; index++) {
    const height = points.getY(index);
    points.setXYZ(index, points.getX(index) * (0.35 + Math.sin(Math.PI * height) * 0.65) * (1 - height * 0.85) + height * height * 0.22, height, Math.sin(height * 3.6) * 0.12);
  }
  blade.computeVertexNormals(); blade.computeBoundingBox(); blade.computeBoundingSphere();
  shop.geometries.seagrassBlade = blade;
}

function seaFan(shop, horizontal, depth, base, size, yaw, material = 'coralRose') {
  const point = (across, up, bend = 0) => [horizontal + Math.cos(yaw) * across * size + Math.sin(yaw) * bend, base + up * size, depth - Math.sin(yaw) * across * size + Math.cos(yaw) * bend];
  beam(shop, point(0, 0), point(0, 0.65), 0.12 * size, material, '附着花池的海扇主干');
  for (let branch = -3; branch <= 3; branch++) {
    const reach = branch / 3;
    const path = [[0, 0.3], [reach * 0.45, 0.85], [reach * 0.85, 1.25], [reach, 1.65 - Math.abs(reach) * 0.32]];
    for (let segment = 1; segment < path.length; segment++) {
      beam(shop, point(...path[segment - 1]), point(...path[segment]), size * (0.045 - segment * 0.008), material, '珊瑚海扇细枝');
      if (segment < 2) continue;
      const tip = point(path[segment][0] + (branch < 0 ? -0.16 : 0.16), path[segment][1] + 0.18, 0.12);
      beam(shop, point(...path[segment]), tip, size * 0.015, material);
      shop.add('bead', 'gardenGlow', tip, [0.08, 0.11, 0.08], [0, 0, 0], false, '海扇枝端微光');
    }
  }
  for (let row = 1; row <= 5; row++) for (let branch = -3; branch < 3; branch++) {
    const fraction = row / 5;
    const across = branch / 3 * fraction;
    const next = (branch + 1) / 3 * fraction;
    beam(shop, point(across, 0.42 + fraction * 1.04 - Math.abs(across) * 0.15), point(next, 0.42 + fraction * 1.04 - Math.abs(next) * 0.15), size * 0.011, material, '海扇交织网脉');
  }
}

function plantedBed(shop, horizontal, depth, width, length, seed) {
  shop.add('soft', 'agedStone', [horizontal, 0.7, depth], [width, 1.4, length], [0, 0, 0], true, '内花园实体种植池');
  shop.add('soft', 'ivory', [horizontal, 1.42, depth], [width + 0.3, 0.34, length + 0.3], [0, 0, 0], true, '花池象牙石压边');
  shop.add('soft', 'reef', [horizontal, 1.65, depth], [width - 0.85, 0.18, length - 0.85], [0, 0, 0], false, '贝砂与礁石种植基质');
  for (let clump = 0; clump < 22; clump++) {
    const fraction = (clump * 0.61803398875 + seed * 0.19) % 1;
    const along = (clump * 0.41421356237 + seed * 0.37) % 1;
    const lateral = horizontal + (fraction - 0.5) * (width - 2.8);
    const distance = depth + (along - 0.5) * (length - 2.8);
    for (let blade = 0; blade < 5; blade++) {
      shop.add('seagrassBlade', clump % 3 ? 'seagrass' : 'kelp', [lateral, 1.72, distance], [0.5 + blade * 0.12, 1.6 + (clump % 5) * 0.55 + blade * 0.18, 0.7], [0, blade * 2.4 + clump, (blade - 2) * 0.09], false, '随海流摆动的有根海草');
    }
  }
  for (let fan = 0; fan < 3; fan++) seaFan(shop, horizontal + (fan - 1) * (width - 3) / 3, depth + (fan % 2 ? 1 : -1) * length * 0.16, 1.7, 2.2 + fan * 0.55, 0.25 + fan * 0.7, fan % 2 ? 'coralAmber' : 'coralRose');
}

function garden(shop) {
  prepareBlade(shop);
  floorMedallion(shop, -35, -135, 23);
  for (const horizontal of [-60, -10]) for (const depth of [-111, -159]) column(shop, horizontal, depth, 0, 22, 0.65);
  for (const depth of [-113, -157]) {
    shop.add('box', 'carvedStone', [-35, 20.6, depth], [52, 1.2, 1.6], [0, 0, 0], false, '花园柱廊横楣');
    shellCrest(shop, [-35, 17.7, depth], 3.3, 'gold', depth < -135 ? 0 : Math.PI);
  }
  plantedBed(shop, -44, -137, 15, 13, 0);
  plantedBed(shop, -45, -116, 23, 6.4, 1);
  plantedBed(shop, -47, -154, 18, 7, 2);
  for (const depth of [-123, -147]) {
    shop.add('soft', 'ivory', [-25, 2, depth], [5.5, 0.8, 8], [0, 0, 0], true, '贝壳花园休憩座');
    for (const end of [-1, 1]) shop.add('baluster', 'bronze', [-25, 0, depth + end * 2.5], [2, 1.8, 2], [0, 0, 0], true);
    shellCrest(shop, [-27.7, 2.2, depth], 5, 'carvedStone', Math.PI / 2);
  }
  for (const depth of [-115, -135, -155]) {
    shop.add('urn', 'bronze', [-58, 0, depth], [1.6, 2.5, 1.6], [0, 0, 0], true, '花园珍珠灯座');
    shop.add('sphere', 'gardenGlow', [-58, 2.8, depth], [0.55, 0.55, 0.55], [0, 0, 0], false, '花池引路珠光');
  }
}

function diningTable(shop, horizontal, depth, craft) {
  shop.add('cylinder', 'ivory', [horizontal, 4.1, depth], [4.5, 0.45, 4.5], [0, 0, 0], true, '珊瑚餐厅独立圆桌');
  shop.add('cylinder', 'gold', [horizontal, 3.82, depth], [4.55, 0.16, 4.55]);
  shop.add('baluster', 'gold', [horizontal, 0, depth], [3.5, 3.7, 3.5], [0, 0, 0], true, '圆桌雕刻中央支脚');
  shop.add('disc', 'wine', [horizontal, 4.34, depth], [2, 2, 1], [-Math.PI / 2, 0, 0], false, '餐桌织锦圆垫');
  for (const side of [-1, 1]) {
    craft.seat(shop, horizontal + side * 6.7, depth, side * Math.PI / 2);
    craft.placeSetting(shop, horizontal + side * 2.4, depth, 4.15, side);
  }
  if (depth !== -121) {
    shop.add('urn', 'ivory', [horizontal, 4.36, depth], [0.7, 0.9, 0.7], [0, 0, 0], false, '餐桌珊瑚插饰花瓶');
    seaFan(shop, horizontal, depth, 5.05, 0.72, 0.3);
  }
}

function dining(shop, room, craft) {
  decorateRoom(shop, room);
  for (const [horizontal, depth] of [[35, -121], [49, -137], [35, -151]]) diningTable(shop, horizontal, depth, craft);
  craft.chandelier(shop, 35, -135, 17, 4.7);
  craft.table(shop, 57, -151, 3.5, 13, 4.5);
  for (let stack = 0; stack < 3; stack++) for (let plate = 0; plate < 4; plate++) {
    shop.add('cylinder', 'ivory', [57, 4.88 + plate * 0.13, -155 + stack * 3.7], [0.87, 0.1, 0.87], [0, 0, 0], false, '备餐台叠放贝瓷碟');
  }
  craft.table(shop, 57, -116, 3.5, 9, 4.5);
  for (const depth of [-119, -115]) {
    shop.add('urn', 'silver', [57, 4.8, depth], [1.1, 2, 1.1], [0, 0, 0], false, '备餐台银制水壶');
    shop.add('ring', 'gold', [56.2, 6, depth], [0.6, 0.6, 0.6], [0, Math.PI / 2, 0]);
    shop.add('sphere', 'gold', [57, 6.9, depth], [0.22, 0.17, 0.22]);
  }
}

export function furnishLivingSpace(shop, room, craft) {
  if (room.id === 'conservatory') garden(shop);
  else dining(shop, room, craft);
  return shop.finish(room.name);
}

export function furnishStoryArtifact(shop, room) {
  if (room.id === 'reception') {
    shop.add('soft', 'agedStone', [10, 2, 38], [4.2, 4, 2.5], [0, 0, 0], true, '潮汐邀约铭文');
    shop.add('soft', 'carvedStone', [10, 5.2, 38], [4.4, 4, 0.8], [0, 0, 0], true, '潮汐邀约铭文');
    for (let line = 0; line < 6; line++) {
      shop.add('box', 'invitationGlow', [10, 6.6 - line * 0.45, 38.43], [2.8 - line % 3 * 0.35, 0.06, 0.04], [0, 0, 0], false, '潮汐邀约铭文');
    }
    shop.add('shell', 'invitationGlow', [10, 6.7, 38.5], [1.9, 1.9, 1.9], [0, 0, 0], false, '潮汐邀约铭文');
  }
  if (room.id === 'conservatory') {
    shop.add('baluster', 'carvedStone', [-25, 0, -135], [3.6, 4, 3.6], [0, 0, 0], true, '守园人的留声贝');
    shop.add('cup', 'bronze', [-25, 4.25, -135], [1.5, 0.65, 1.5], [0, 0, 0], false, '守园人的留声贝');
    shop.add('shell', 'gardenGlow', [-25, 4.3, -135], [3.5, 3.5, 3.5], [0, 0.6, 0], false, '守园人的留声贝');
  }
  if (room.id === 'dining') {
    shop.add('cup', 'gold', [35, 4.65, -121], [1.4, 0.5, 1.4], [0, 0, 0], false, '侍宴者的留名贝');
    shop.add('shell', 'guestGlow', [35, 4.65, -121], [2.6, 2.6, 2.6], [0, -0.6, 0], false, '侍宴者的留名贝');
    shop.add('ring', 'guestGlow', [35, 4.36, -121], [4.25, 4.25, 4.25], [Math.PI / 2, 0, 0], false, '归客席的暖光杯环');
  }
}

export function gardenRoof(shop) {
  const center = -35.5; const halfWidth = 27.5;
  for (let strip = 0; strip < 14; strip++) {
    const first = -halfWidth + strip * halfWidth * 2 / 14;
    const last = -halfWidth + (strip + 1) * halfWidth * 2 / 14;
    const height = across => 23 + 6.5 * (1 - (across / halfWidth) ** 2);
    const slope = Math.atan2(height(last) - height(first), last - first);
    const width = Math.hypot(last - first, height(last) - height(first));
    shop.add('box', 'glass', [center + (first + last) / 2, (height(first) + height(last)) / 2, -135], [width + 0.04, 0.23, 54], [0, 0, slope], true, '透光内花园拱顶');
    for (const depth of [-108, -121.5, -135, -148.5, -162]) {
      shop.add('box', 'bronze', [center + (first + last) / 2, (height(first) + height(last)) / 2, depth], [width + 0.15, 0.38, 0.38], [0, 0, slope], false, '拱顶连续青铜肋骨');
    }
    if (strip % 2 === 0) shop.add('box', 'bronze', [center + first, height(first), -135], [0.17, 0.25, 54], [0, 0, 0], false, '内花园透光顶纵向分格');
  }
  for (const depth of [-108, -162]) {
    for (let strip = 0; strip < 14; strip++) {
      const across = -halfWidth + (strip + 0.5) * halfWidth * 2 / 14;
      const rise = 1 + 6.5 * (1 - (across / halfWidth) ** 2);
      shop.add('box', 'glass', [center + across, 22 + rise / 2, depth], [halfWidth * 2 / 14 + 0.03, rise, 0.25], [0, 0, 0], true, '内花园拱顶端部封窗');
    }
  }
}
