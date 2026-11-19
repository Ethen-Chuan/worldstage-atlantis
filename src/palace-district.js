import * as THREE from 'three';
import { seaHeight } from './terrain.js';
import { PalaceWorkshop, palaceMaterials, beam, column, moldingFrame, shellCrest } from './palace-craft.js';
import { decorateRoom } from './palace-ornaments.js';
import { buildSanctuary, sanctuaryMaterials } from './palace-sanctuary.js';
import { livingSpaceMaterials, furnishLivingSpace, gardenRoof, furnishStoryArtifact } from './palace-living-spaces.js';

import { PALACE_CENTER, PALACE_ROOMS } from './palace-layout.js';
export { PALACE_CENTER, PALACE_ROOMS } from './palace-layout.js';

const PALACE_BACK = -162;
const ROOM_WINDOWS = { bedroom: 'conservatory', conservatory: 'bedroom', club: 'dining', dining: 'club' };

function roomVisibleThroughDoors(lateral, depth, current, destination) {
  if (!current || current.id === 'gallery' || current.id === destination.id) return true;
  if (ROOM_WINDOWS[current.id] === destination.id) return true;
  const portal = room => room.id === 'reception' ? [[-7.6, 0], [7.6, 0]] : [[Math.sign(room.center[0]) * 8, room.center[1] - 7.6], [Math.sign(room.center[0]) * 8, room.center[1] + 7.6]];
  const portals = [portal(current), portal(destination)];
  const origin = portals[0]; const reference = Math.atan2((origin[0][1] + origin[1][1]) / 2 - depth, (origin[0][0] + origin[1][0]) / 2 - lateral);
  let minimum = -Math.PI; let maximum = Math.PI;
  for (const opening of portals) {
    if (opening[0][0] === opening[1][0] && Math.abs(lateral - opening[0][0]) < 1.2) continue;
    if (opening[0][1] === opening[1][1] && Math.abs(depth - opening[0][1]) < 1.2) continue;
    const angles = opening.map(point => { const angle = Math.atan2(point[1] - depth, point[0] - lateral) - reference; return Math.atan2(Math.sin(angle), Math.cos(angle)); });
    if (Math.abs(angles[0] - angles[1]) > Math.PI) return false;
    minimum = Math.max(minimum, Math.min(...angles)); maximum = Math.min(maximum, Math.max(...angles));
    if (maximum < minimum) return false;
  }
  return true;
}

function ring(shop, material, position, radius, vertical = false) {
  shop.add('ring', material, position, [radius, radius, radius], [vertical ? 0 : Math.PI / 2, 0, 0]);
}

function arch(shop, horizontal, depth, bottom, width, height, side = false) {
  shop.add('arch', 'pale', [horizontal, bottom + height - width / 2, depth], [width / 2, width / 2, 0.55], [0, side ? Math.PI / 2 : 0, 0], false, '连续雕刻石拱');
  shop.add('arch', 'gold', [horizontal, bottom + height - width / 2, depth + (side ? 0 : 0.09)], [width / 2 - 0.14, width / 2 - 0.14, 0.2], [0, side ? Math.PI / 2 : 0, 0]);
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
    shop.add('spandrel', 'stone', [midpoint[0], 7, midpoint[1]], [7, 7, 1.4], [0, side ? Math.PI / 2 : 0, 0]);
    for (let segment = 0; segment < 16; segment++) {
      const across = -7 + (segment + 0.5) * 14 / 16; const archHeight = 7 + Math.sqrt(Math.max(0, 49 - across * across));
      const center = [midpoint[0] + (side ? 0 : across), (14 + archHeight) / 2, midpoint[1] + (side ? across : 0)];
      const size = side ? [1.4, Math.max(0.02, 14 - archHeight), 14 / 16 + 0.02] : [14 / 16 + 0.02, Math.max(0.02, 14 - archHeight), 1.4];
      shop.colliders.push({ min: center.map((value, index) => value - size[index] / 2), max: center.map((value, index) => value + size[index] / 2) });
    }
    arch(shop, midpoint[0], midpoint[1], 0, 14, 14, side);
  } else box(0, height / 2, length, height, 'stone', true);
  for (const elevation of [1, 4, 20.7]) {
    if (door && elevation < 14) for (const sign of [-1, 1]) box(sign * (length + 14) / 4, elevation, (length - 14) / 2, 0.2, 'gold', false);
    else box(0, elevation, length, 0.2, 'gold', false);
  }
  for (let offset = -length / 2 + 5; offset < length / 2; offset += 9) {
    if ((door && Math.abs(offset) < 10) || (window && Math.abs(offset) < 14)) continue;
    box(offset, 11.7, 0.35, 2.5, 'gold', false, 1.9);
    for (const face of [-1, 1]) {
      const point = [midpoint[0] + (side ? face * 1.12 : offset), 12.3, midpoint[1] + (side ? offset : face * 1.12)];
      shop.add('cup', 'gold', [point[0], 11.85, point[2]], [0.42, 0.3, 0.42]);
      shop.add('sphere', 'light', point, [0.26, 0.55, 0.26], [0, 0, 0], false, '贝珠壁灯');
      shop.add('leaf', 'gold', [point[0], 10.9, point[2]], [0.28, 0.65, 0.28]);
    }
    for (const across of [-3, 3]) box(offset + across, 2.4, 0.13, 2.7, 'pale', false, 1.6);
    box(offset, 2.4, 0.8, 0.8, 'gold', false, 1.63);
  }
}

function chandelier(shop, horizontal, depth, elevation = 17, radius = 4) {
  shop.add('baluster', 'gold', [horizontal, elevation - 1, depth], [0.9, 22 - elevation, 0.9]);
  for (const tier of [0, 1, 2]) {
    const reach = radius * (1 - tier * 0.29); const height = elevation - tier * 1.7;
    ring(shop, 'gold', [horizontal, height, depth], reach);
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2;
      const lateral = horizontal + Math.cos(angle) * reach; const distance = depth + Math.sin(angle) * reach;
      beam(shop, [horizontal, height + 1.4, depth], [lateral, height, distance], 0.055);
      shop.add('cup', 'gold', [lateral, height + 0.22, distance], [0.38, 0.35, 0.38]);
      shop.add('sphere', 'light', [lateral, height + 0.45, distance], [0.21, 0.35, 0.21], [0, 0, 0], false, '珍珠树灯');
      for (let bead = 0; bead < 3; bead++) shop.add('sphere', 'pearl', [lateral, height - 0.3 - bead * 0.23, distance], [0.09, 0.12, 0.09]);
      shop.add('jewel', 'pearl', [lateral, height - 1.18, distance], [0.18, 0.38, 0.18]);
    }
  }
  shop.add('jewel', 'pearl', [horizontal, elevation - 5.2, depth], [0.45, 0.8, 0.45]);
}

function seat(shop, horizontal, depth, yaw = 0, wide = false) {
  const width = wide ? 10 : 3.1;
  const place = (type, material, point, scale, solid = false) => {
    const local = new THREE.Vector3(...point).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    shop.add(type, material, [horizontal + local.x, local.y, depth + local.z], scale, [0, yaw, 0], solid, wide ? '蓝绒长沙发' : '雕花扶手椅');
  };
  place('soft', 'wood', [0, 1.4, 0], [width + 0.35, 0.65, 3.5], true);
  place('soft', 'velvet', [0, 2.1, 0], [width, 1.1, 3.3], true);
  place('soft', 'gold', [0, 4.2, 1.4], [width + 0.38, 3.9, 1.05], true);
  place('soft', 'velvet', [0, 4.2, 1.25], [width, 3.5, 1]);
  place('soft', 'velvet', [0, 4.2, 1.97], [width - 0.05, 3.45, 0.22]);
  place('soft', 'gold', [0, 1.65, -1.69], [width, 0.12, 0.1]);
  for (let row = 0; row < 3; row++) for (let button = 0; button < (wide ? 7 : 2); button++) place('sphere', 'pearl', [(button - (wide ? 3 : 0.5)) * 1.15 + (row % 2 ? 0.24 : 0), 3.3 + row * 0.72, 0.735], [0.065, 0.065, 0.04]);
  if (wide) for (const side of [-1, 1]) place('soft', 'wine', [side * 3.25, 3.1, 0.15], [1.8, 1.65, 0.65]);
  const crest = new THREE.Vector3(0, 5.95, 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  shellCrest(shop, [horizontal + crest.x, crest.y, depth + crest.z], wide ? 1.9 : 1.2, 'gold', yaw + Math.PI);
  for (const sign of [-1, 1]) {
    place('soft', 'gold', [sign * (width / 2 - 0.12), 3.45, 0], [0.55, 0.58, 3.3]);
    place('soft', 'velvet', [sign * (width / 2 - 0.12), 3.72, 0], [0.46, 0.4, 2.9]);
    place('sphere', 'gold', [sign * (width / 2 - 0.12), 3.5, -1.7], [0.3, 0.36, 0.23]);
    for (const edge of [-1, 1]) place('baluster', 'gold', [sign * (width / 2 - 0.5), 0, edge], [0.62, 1.4, 0.62]);
  }
}

function table(shop, horizontal, depth, width, length, elevation = 4) {
  shop.add('soft', length > 25 ? 'wood' : 'ivory', [horizontal, elevation, depth], [width, 0.5, length], [0, 0, 0], true, '镶金雕脚石案');
  shop.add('soft', 'gold', [horizontal, elevation - 0.3, depth], [width + 0.15, 0.18, length + 0.15]);
  shop.add('box', 'wood', [horizontal, elevation - 0.9, depth], [width - 0.7, 1, length - 0.7]);
  for (const lateral of [-1, 1]) for (const along of [-1, 1]) {
    shop.add('baluster', 'gold', [horizontal + lateral * (width / 2 - 0.7), 0, depth + along * (length / 2 - 0.7)], [1.2, elevation - 0.6, 1.2]);
    shop.add('sphere', 'gold', [horizontal + lateral * (width / 2 - 0.7), elevation - 1.1, depth + along * (length / 2 - 0.7)], [0.5, 0.4, 0.5]);
  }
}

function placeSetting(shop, horizontal, depth, elevation, sign = 1) {
  shop.add('cylinder', 'ivory', [horizontal, elevation + 0.35, depth], [0.8, 0.09, 0.8], [0, 0, 0], false, '贝瓷餐盘与银制餐具');
  ring(shop, 'gold', [horizontal, elevation + 0.41, depth], 0.74);
  shop.add('cylinder', 'pearl', [horizontal, elevation + 0.43, depth], [0.52, 0.06, 0.52]);
  ring(shop, 'gold', [horizontal, elevation + 0.48, depth], 0.5);
  shop.add('soft', 'wine', [horizontal, elevation + 0.58, depth], [0.58, 0.18, 0.62], [0, Math.PI / 4, 0], false, '折叠织锦餐巾');
  shop.add('ring', 'gold', [horizontal, elevation + 0.7, depth], [0.2, 0.2, 0.24], [Math.PI / 2, 0, 0]);
  shop.add('cylinder', 'gold', [horizontal + sign * 0.95, elevation + 0.35, depth - 0.85], [0.27, 0.05, 0.27]);
  shop.add('cylinder', 'gold', [horizontal + sign * 0.95, elevation + 0.72, depth - 0.85], [0.045, 0.7, 0.045]);
  shop.add('cup', 'glass', [horizontal + sign * 0.95, elevation + 1.35, depth - 0.85], [0.4, 0.7, 0.4], [0, 0, 0], false, '水晶高脚杯');
  ring(shop, 'gold', [horizontal + sign * 0.95, elevation + 1.35, depth - 0.85], 0.39);
  for (const side of [-1, 1]) shop.add('box', 'silver', [horizontal + side * 1.12, elevation + 0.38, depth + 0.12], [0.1, 0.07, 1.25]);
  for (let tine = 0; tine < 3; tine++) shop.add('box', 'silver', [horizontal - 1.12 + (tine - 1) * 0.075, elevation + 0.38, depth - 0.56], [0.035, 0.06, 0.35]);
}

function furnishings(room, materials) {
  const shop = new PalaceWorkshop(materials); const [horizontal, depth] = room.center;
  furnishStoryArtifact(shop, room);
  if (['conservatory', 'dining'].includes(room.id)) return furnishLivingSpace(shop, room, { seat, table, placeSetting, chandelier });
  decorateRoom(shop, room);
  const lamp = room.lamp || room.center;
  chandelier(shop, lamp[0], lamp[1], 17, room.id === 'reception' ? 6 : 4);
  if (room.id === 'reception') {
    for (const side of [-1, 1]) {
      table(shop, side * 23, 13, 10, 7, 5); seat(shop, side * 23, 7);
      for (const distance of [9, 44]) column(shop, side * 27, distance, 0, 22, 0.9);
      shop.add('sphere', 'pearl', [side * 23, 6.5, 13], [1.1, 1.1, 1.1]);
      seat(shop, side * 23, 37, side * Math.PI / 2, true);
      for (const distance of [7, 47]) column(shop, side * 15, distance, 0, 20.5, 0.8);
      shop.add('urn', 'lapis', [side * 44, 0, 28], [5.3, 8.2, 5.3], [0, 0, 0], true, '珐琅礼瓶');
      shellCrest(shop, [side * 44, 8, 28], 2.4);
    }
    for (const distance of [1.2, 52.8]) {
      for (const side of [-1, 1]) column(shop, side * 8.4, distance, 0, 17, 0.65);
      shellCrest(shop, [0, 15.5, distance], 4.1, 'gold', distance > 26 ? Math.PI : 0);
      arch(shop, 0, distance, 0, 15, 15.2);
    }
  } else if (room.id === 'salon') {
    seat(shop, -46, -27, -Math.PI / 2, true); seat(shop, -35, -42, Math.PI, true); seat(shop, -32, -13, 0, true);
    table(shop, -36, -27, 9, 10, 2.7);
    for (const side of [-1, 1]) placeSetting(shop, -36 + side * 2.3, -27, 2.7, side);
    shop.add('box', 'wood', [-55, 6, -43], [3, 12, 12], [0, 0, 0], true, '海国藏书柜');
    for (let index = 0; index < 36; index++) shop.add('box', index % 3 ? 'wine' : 'gold', [-53.35, 2 + Math.floor(index / 12) * 3.6, -48 + index % 12 * 0.88], [0.35, 2.6 + index % 3 * 0.15, 0.58]);
    for (const elevation of [0.7, 4.7, 8.7, 12.3]) shop.add('box', 'gold', [-53.25, elevation, -43], [0.4, 0.18, 12.5]);
    for (const distance of [-48.8, -37.2]) column(shop, -53.3, distance, 0, 12.5, 0.24);
    shop.add('urn', 'ivory', [-36, 3, -27], [1.5, 1.2, 1.5], [0, 0, 0], false, '贝瓷茶壶');
    ring(shop, 'gold', [-36, 4.22, -27], 0.5);
    shop.add('sphere', 'gold', [-36, 4.42, -27], [0.14, 0.12, 0.14]);
    shop.add('ring', 'gold', [-37, 3.65, -27], [0.45, 0.45, 0.45], [0, 0, 0]);
    beam(shop, [-35.5, 3.4, -27], [-34.8, 4, -27], 0.2, 'ivory');
  } else if (room.id === 'banquet') {
    table(shop, 36, -27, 10, 31);
    shop.add('box', 'wine', [36, 4.3, -27], [2.6, 0.05, 30.5], [0, 0, 0], false, '金枝织锦桌旗');
    for (const side of [-1, 1]) shop.add('box', 'gold', [36 + side * 1.2, 4.34, -27], [0.08, 0.04, 30]);
    for (let index = 0; index < 6; index++) for (const side of [-1, 1]) {
      const distance = -40 + index * 5;
      seat(shop, 36 + side * 8, distance, side * Math.PI / 2);
      placeSetting(shop, 36 + side * 3.2, distance, 4, side);
    }
    for (const distance of [-37, -27, -17]) {
      shop.add('baluster', 'gold', [36, 4.4, distance], [0.9, 2.2, 0.9]);
      for (let branch = 0; branch < 5; branch++) {
        const angle = branch / 5 * Math.PI * 2;
        const reach = branch ? 1.1 : 0;
        beam(shop, [36, 5.7, distance], [36 + Math.sin(angle) * reach, 6.5, distance + Math.cos(angle) * reach], 0.07);
        shop.add('cup', 'gold', [36 + Math.sin(angle) * reach, 6.7, distance + Math.cos(angle) * reach], [0.25, 0.3, 0.25]);
        shop.add('sphere', 'light', [36 + Math.sin(angle) * reach, 6.8, distance + Math.cos(angle) * reach], [0.2, 0.3, 0.2]);
      }
    }
    table(shop, 53, -27, 3.2, 28, 4);
    for (const distance of [-39, -15]) chandelier(shop, 36, distance, 17.4, 3);
  } else if (room.id === 'bedroom') {
    shop.add('soft', 'wood', [-42, 1.5, -86], [16, 3, 19], [0, 0, 0], true, '四柱帷幔床');
    shop.add('soft', 'ivory', [-42, 3.3, -86], [15, 2, 18]);
    shop.add('soft', 'wine', [-42, 4.35, -83], [15.1, 0.3, 12]);
    shop.add('soft', 'wood', [-42, 6, -96], [16, 10, 1.1], [0, 0, 0], true, '贝冠雕花床头');
    shop.add('soft', 'wine', [-42, 7.1, -95.32], [13.5, 6, 0.45]);
    moldingFrame(shop, [-42, 7.1, -94.96], 14, 6.5, 0, 'gold', 0.28);
    shellCrest(shop, [-42, 8.7, -94.6], 4.4);
    for (const elevation of [2, 10.9]) shop.add('box', 'gold', [-42, elevation, -95.35], [16, 0.16, 0.16]);
    for (const side of [-1, 1]) {
      shop.add('soft', 'pearl', [-42 + side * 3.7, 4.6, -92], [6, 1.1, 3]);
      table(shop, -42 + side * 12, -91, 4.4, 4.4, 4);
      shop.add('sphere', 'light', [-42 + side * 12, 6, -91], [0.8, 1, 0.8]);
      for (const edge of [-1, 1]) column(shop, -42 + side * 8, -86 + edge * 10, 0, 15, 0.28);
    }
    shop.add('soft', 'wine', [-42, 15.2, -86], [17.5, 0.7, 21]);
    for (const side of [-1, 1]) {
      shop.add('curtain', 'drape', [-42 + side * 7.8, 10.1, -93], [4.5, 9.1, 2.2], [0, Math.PI / 2, 0], false, '褶皱垂幔');
      shop.add('curtain', 'wine', [-42 + side * 7.8, 13.8, -86], [20, 2.3, 1.2], [0, Math.PI / 2, 0]);
      beam(shop, [-42 + side * 8, 15, -96], [-42 + side * 8, 15, -76], 0.13);
      shop.add('sphere', 'gold', [-42 + side * 8, 15.6, -76], [0.37, 0.48, 0.37]);
    }
    shop.add('curtain', 'wine', [-42, 13.8, -76], [16, 2.3, 1.2], [0, 0, 0], false, '织锦床冠');
    table(shop, -29, -102, 12, 3, 4);
    ring(shop, 'gold', [-29, 8.5, -102.6], 3, true);
    shop.add('sphere', 'silver', [-29, 8.5, -102.65], [2.8, 2.8, 0.08]);
    shop.add('soft', 'wood', [-54, 6, -64], [9, 12, 4], [0, 0, 0], true, '镶金更衣柜');
    for (const lateral of [-56, -52]) shop.add('sphere', 'gold', [lateral, 5.8, -61.8], [0.16, 0.16, 0.12]);
    moldingFrame(shop, [-54, 6, -61.7], 8.4, 11, 0, 'gold', 0.2);
    for (const lateral of [-33, -26]) {
      shop.add('urn', 'glass', [lateral, 4.3, -102], [0.8, 1.35, 0.8], [0, 0, 0], false, '梳妆香瓶');
      shop.add('jewel', 'gold', [lateral, 5.75, -102], [0.15, 0.2, 0.15]);
    }
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
    shop.add('box', 'lapis', [59, 6.5, -92], [0.8, 13, 24], [0, 0, 0], true, '珐琅酒柜背板');
    moldingFrame(shop, [56.5, 6.5, -92], 24, 13, -Math.PI / 2, 'gold', 0.3);
    for (const distance of [-103, -92, -81]) column(shop, 56, distance, 0, 13.4, 0.28);
    shellCrest(shop, [56.5, 13.3, -92], 2.5, 'gold', -Math.PI / 2);
  }
  return shop.finish(room.name);
}

export class PalaceDistrict {
  constructor(scene) {
    this.scene = scene; this.root = new THREE.Group(); this.root.name = '潮冠宫城'; this.root.visible = false; this.scene.add(this.root); this.rooms = new Map(); this.visited = new Set(); this.activeRoom = null;
    this.frustum = new THREE.Frustum(); this.viewProjection = new THREE.Matrix4(); this.roomBounds = new THREE.Box3(); this.portalBounds = new THREE.Box3();
    this.storyFlags = new Set();
  }
  prepare() {
    if (this.ready) return;
    this.ready = true; this.materials = palaceMaterials(); this.base = seaHeight(PALACE_CENTER[0], PALACE_CENTER[2]) + 12;
    this.tideClock = sanctuaryMaterials(this.materials);
    livingSpaceMaterials(this.materials, this.tideClock);
    const shop = new PalaceWorkshop(this.materials);
    shop.add('box', 'ivory', [0, -0.25, -54], [126, 0.5, 218], [0, 0, 0], true);
    shop.add('box', 'agedStone', [0, -6.2, -140], [134, 11.4, 48], [0, 0, 0], true, '花园与餐厅连续承重基座');
    shop.add('box', 'dark', [0, 23, -27], [126, 2, 164], [0, 0, 0], true);
    shop.add('box', 'dark', [27.5, 23, -135], [71, 2, 54], [0, 0, 0], true, '餐厅与后廊实体顶板');
    gardenRoof(shop);
    wall(shop, [-63, 54], [63, 54], { door: true });
    wall(shop, [-63, -108], [-8, -108], { window: true });
    wall(shop, [8, -108], [63, -108], { window: true });
    wall(shop, [-63, PALACE_BACK], [-8, PALACE_BACK], { window: true });
    wall(shop, [8, PALACE_BACK], [63, PALACE_BACK], { window: true });
    wall(shop, [-8, PALACE_BACK], [8, PALACE_BACK]);
    for (const side of [-1, 1]) {
      wall(shop, [side * 63, -108], [side * 63, 54], { side: true });
      wall(shop, [side * 63, PALACE_BACK], [side * 63, -108], { side: true, window: side < 0 });
      wall(shop, [side * 8, -54], [side * 8, 0], { side: true, door: true });
      wall(shop, [side * 8, -108], [side * 8, -54], { side: true, door: true });
      wall(shop, [side * 8, PALACE_BACK], [side * 8, -108], { side: true, door: true });
      wall(shop, [side * 8, -54], [side * 63, -54]);
    }
    wall(shop, [-63, 0], [63, 0], { door: true });
    for (let distance = PALACE_BACK + 4; distance < 55; distance += 7) {
      shop.add('box', 'gold', [0, 0.06, distance], [0.18, 0.04, 3]);
      for (const side of [-1, 1]) shop.add('box', 'gold', [side * 6, 0.06, distance], [0.12, 0.04, 7]);
    }
    for (let depth = -102; depth < 50; depth += 13) {
      shop.add('box', 'gold', [0, 21.8, depth], [124, 0.18, 0.35]);
      for (const lateral of [-56, -35, -14, 14, 35, 56]) shop.add('box', 'gold', [lateral, 21.8, depth + 6.5], [0.3, 0.18, 13]);
    }
    this.shell = shop.finish('潮冠宫城 · 七处空间实体墙壳'); this.root.add(this.shell);
    const exteriorShop = new PalaceWorkshop(this.materials);
    this.sanctuary = buildSanctuary(exteriorShop);
    this.exterior = exteriorShop.finish('潮冠宫城 · 海神圣域');
    for (const mesh of this.exterior.children) mesh.castShadow = ['limestone', 'agedStone', 'patina', 'reef', 'carvedStone'].some(name => mesh.material === this.materials[name]);
    const exteriorCollision = new THREE.Group(); exteriorCollision.name = '海神圣域 · 持续实体阻挡'; exteriorCollision.userData.collisionBoxes = this.exterior.userData.collisionBoxes; this.exterior.userData.collisionBoxes = [];
    this.root.add(exteriorCollision, this.exterior);
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
      marker.position.set(Math.sign(room.center[0]) * 8, 6, room.center[1]); marker.rotation.y = -Math.sign(room.center[0]) * Math.PI / 2;
      marker.name = `进入${room.name}`; marker.userData.palaceDestination = room.id; this.root.add(marker);
      hitArea(marker, 1.7);
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 144;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#13363b'; context.fillRect(0, 0, 512, 144);
          context.strokeStyle = '#b99a5b'; context.lineWidth = 4; context.strokeRect(8, 8, 496, 128);
          context.fillStyle = '#eee0bf'; context.font = '500 54px serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(room.name, 256, 74);
          const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.36), new THREE.MeshBasicMaterial({ map: texture }));
          sign.position.set(0, 4, 0.22); sign.name = `进入${room.name}`; sign.userData.palaceDestination = room.id; sign.userData.noAO = true; marker.add(sign);
        }
      }
    }
    this.fill = new THREE.PointLight('#ffe4b8', 0, 78, 1.25); this.fill.position.set(0, 17, 26); this.fill.castShadow = false; this.root.add(this.fill);
    this.lightTarget = new THREE.Vector3(0, 17, 26);
    this.sanctuaryLight = new THREE.PointLight('#ffe0a0', 0, 190, 1.3); this.sanctuaryLight.position.set(-32, 62, 45); this.root.add(this.sanctuaryLight);
    this.altarLight = new THREE.PointLight('#ffc579', 0, 72, 1.2); this.altarLight.position.set(0, 49, -72); this.root.add(this.altarLight);
  }
  roomAt(position) {
    if (!this.ready || position.y < this.base || position.y > this.base + 30) return null;
    const lateral = position.x - PALACE_CENTER[0]; const depth = position.z - PALACE_CENTER[2];
    if (Math.abs(lateral) > 62 || depth > 54 || depth < PALACE_BACK) return null;
    if (position.y > this.base + 22 && !(lateral < -8 && depth < -108)) return null;
    if (depth >= 0) return PALACE_ROOMS[0];
    if (Math.abs(lateral) < 8) return { id: 'gallery', name: '潮光长廊' };
    return PALACE_ROOMS.find(room => Math.sign(room.center[0]) === Math.sign(lateral) && Math.abs(room.center[1] - depth) <= 27);
  }
  setStoryState(state) { this.storyFlags = new Set(state.flags.filter(flag => ['accepted', 'garden', 'table', 'ending'].includes(flag))); }
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
  update(position, offset, delta = 1 / 60, camera = null, reduced = false) {
    const distance = Math.hypot(position.x - PALACE_CENTER[0], position.z - PALACE_CENTER[2]);
    if (distance < 670) this.prepare();
    if (!this.ready) return;
    this.root.visible = distance < 900; this.root.position.set(PALACE_CENTER[0], this.base, PALACE_CENTER[2]).sub(offset);
    this.activeRoom = this.roomAt(position);
    if (this.activeRoom) this.visited.add(this.activeRoom.id);
    if (camera) { camera.updateMatrixWorld(); this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
    const lateral = position.x - PALACE_CENTER[0]; const depth = position.z - PALACE_CENTER[2]; const elevation = position.y - this.base;
    const portalInView = (minimum, maximum) => {
      this.portalBounds.min.fromArray(minimum).add(this.root.position); this.portalBounds.max.fromArray(maximum).add(this.root.position);
      return this.frustum.intersectsBox(this.portalBounds);
    };
    let exteriorVisible = !camera || !this.activeRoom;
    if (!exteriorVisible) {
      exteriorVisible = roomVisibleThroughDoors(lateral, depth, this.activeRoom, PALACE_ROOMS[0]) && portalInView([-9, -1, 52], [9, 16, 57]);
      if (['bedroom', 'club', 'conservatory', 'dining'].includes(this.activeRoom.id)) {
        const center = this.activeRoom.center[0];
        const rear = this.activeRoom.center[1] - 27;
        exteriorVisible ||= portalInView([center - 14.5, 3.5, rear - 2], [center + 14.5, 18.5, rear + 2]);
      }
      exteriorVisible ||= this.activeRoom.id === 'conservatory';
    }
    this.exterior.visible = exteriorVisible;
    for (const room of PALACE_ROOMS) {
      const close = Math.hypot(position.x - PALACE_CENTER[0] - room.center[0], position.z - PALACE_CENTER[2] - room.center[1]) < 95 && position.y < this.base + 38;
      if (close && !this.rooms.has(room.id)) {
        const root = furnishings(room, this.materials); const halfWidth = room.id === 'reception' ? 63 : 28;
        root.userData.viewBounds = new THREE.Box3(new THREE.Vector3(room.center[0] - halfWidth, -0.2, room.center[1] - 28), new THREE.Vector3(room.center[0] + halfWidth, room.id === 'conservatory' ? 30 : 22, room.center[1] + 28));
        const collisionAnchor = new THREE.Group(); collisionAnchor.name = `${room.name} · 实体阻挡`; collisionAnchor.userData.collisionBoxes = root.userData.collisionBoxes; root.userData.collisionBoxes = [];
        this.root.add(collisionAnchor, root); this.rooms.set(room.id, root);
      }
      if (this.rooms.has(room.id)) {
        const root = this.rooms.get(room.id);
        const inView = !camera || this.frustum.intersectsBox(this.roomBounds.copy(root.userData.viewBounds).translate(this.root.position));
        root.visible = close && inView && roomVisibleThroughDoors(lateral, depth, this.activeRoom, room);
      }
    }
    const center = this.activeRoom?.lamp || this.activeRoom?.center || [0, depth < 0 ? (depth < -54 ? -81 : -27) : 26];
    this.lightTarget.set(center[0], 17, center[1]);
    const outside = Math.max(0, Math.abs(lateral) - 63, depth - 54, PALACE_BACK - depth, elevation - (this.activeRoom?.id === 'conservatory' ? 30 : 22), -elevation);
    const intensity = 65 * (1 - THREE.MathUtils.smoothstep(outside, 0, 16));
    const elapsed = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), 0.1) : 0;
    this.materials.gardenGlow.emissiveIntensity = THREE.MathUtils.damp(this.materials.gardenGlow.emissiveIntensity, this.storyFlags.has('ending') ? 2 : this.storyFlags.has('garden') ? 1.65 : 0.45, 2, elapsed);
    this.materials.guestGlow.emissiveIntensity = THREE.MathUtils.damp(this.materials.guestGlow.emissiveIntensity, this.storyFlags.has('ending') ? 2.05 : this.storyFlags.has('table') ? 1.7 : 0.04, 2, elapsed);
    this.materials.invitationGlow.emissiveIntensity = THREE.MathUtils.damp(this.materials.invitationGlow.emissiveIntensity, this.storyFlags.has('ending') ? 2 : this.storyFlags.has('accepted') ? 0.8 : 0.05, 2, elapsed);
    if (!reduced) this.tideClock.value = (this.tideClock.value + elapsed) % 3600;
    const exteriorBlend = THREE.MathUtils.smoothstep(outside, 0, 18);
    this.sanctuaryLight.intensity = THREE.MathUtils.damp(this.sanctuaryLight.intensity, 280 * exteriorBlend, 3, elapsed);
    this.altarLight.intensity = THREE.MathUtils.damp(this.altarLight.intensity, 115 * exteriorBlend, 3, elapsed);
    this.sanctuaryLight.visible = exteriorVisible && this.sanctuaryLight.intensity > 0.05;
    this.altarLight.visible = exteriorVisible && this.altarLight.intensity > 0.05;
    this.fill.position.lerp(this.lightTarget, 1 - Math.exp(-elapsed * 3));
    this.fill.intensity = THREE.MathUtils.damp(this.fill.intensity, intensity, 4, elapsed);
  }
  inspect() { return { ready: Boolean(this.ready), room: this.activeRoom?.id || null, visited: [...this.visited], loadedRooms: [...this.rooms.keys()], base: this.base, name: '潮冠宫城', architecture: this.sanctuary?.style || null, exterior: this.exterior?.userData.craft || null }; }
}
