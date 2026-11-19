import * as THREE from 'three';
import { seaHeight } from './terrain.js';
import { PalaceWorkshop, palaceMaterials, beam, column, moldingFrame, shellCrest } from './palace-craft.js';
import { crownDome, decorateRoom, imperialPortal } from './palace-ornaments.js';

export const PALACE_CENTER = [-610, 0, 440];
export const PALACE_ROOMS = Object.freeze([
  { id: 'reception', name: '珍珠接待厅', center: [0, 26], view: [0, 8, 43], target: [0, 12, 3], description: '双列雕饰石柱、贝冠门楣、珍珠垂饰与潮汐石拼花。' },
  { id: 'salon', name: '蓝绒客厅', center: [-35, -27], view: [-19, 7, -19], target: [-43, 7, -30], description: '绗缝蓝绒沙发、雕脚石案、贝瓷茶壶与镶金藏书柜。' },
  { id: 'banquet', name: '金枝宴会厅', center: [35, -27], view: [18, 9, -13], target: [37, 7, -32], description: '十二席织锦长桌、珠光树灯、双层餐盘与折叠餐巾。' },
  { id: 'bedroom', name: '月贝寝宫', center: [-35, -81], lamp: [-27, -68], view: [-18, 8, -65], target: [-43, 8, -86], description: '贝冠雕花床头、褶皱帷幔、鎏金床柱与梳妆器物。' },
  { id: 'club', name: '观海会所', center: [35, -81], view: [18, 7, -72], target: [43, 7, -87], description: '珐琅酒柜、雕花会客席、壁面嵌板与深海观景窗。' },
]);

function roomVisibleThroughDoors(lateral, depth, current, destination) {
  if (!current || current.id === 'gallery' || current.id === destination.id) return true;
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

function rail(shop, start, end, bottom = 1, height = 3) {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const angle = Math.atan2(end[0] - start[0], end[1] - start[1]);
  shop.add('box', 'pale', [(start[0] + end[0]) / 2, bottom + height, (start[1] + end[1]) / 2], [0.65, 0.45, length], [0, angle, 0]);
  const count = Math.ceil(length / 2.8);
  for (let index = 0; index <= count; index++) {
    const progress = index / count; const horizontal = THREE.MathUtils.lerp(start[0], end[0], progress); const depth = THREE.MathUtils.lerp(start[1], end[1], progress);
    shop.add('baluster', 'ivory', [horizontal, bottom, depth], [0.8, height, 0.8], [0, 0, 0], false, '车雕石栏杆');
  }
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

function tower(shop, horizontal, depth, bottom, height, radius, domed = false) {
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
  if (domed) {
    crownDome(shop, horizontal, depth, bottom + height, radius * 1.14);
    for (let columnIndex = 0; columnIndex < 12; columnIndex++) {
      const angle = columnIndex / 12 * Math.PI * 2;
      column(shop, horizontal + Math.sin(angle) * (radius + 0.5), depth + Math.cos(angle) * (radius + 0.5), bottom + height - 14, 13.2, 0.43);
    }
  } else {
    shop.add('cone', 'roof', [horizontal, bottom + height + radius * 1.35, depth], [radius * 1.18, radius * 2.8, radius * 1.18], [0, 0, 0], true);
    for (let tier = 0; tier < 4; tier++) {
      const elevation = radius * (tier * 0.62 + 0.05); const reach = radius * 1.18 * (1 - (elevation + radius * 0.05) / (radius * 2.8));
      ring(shop, tier ? 'roof' : 'gold', [horizontal, bottom + height + elevation, depth], reach + 0.05);
    }
    shop.add('cone', 'gold', [horizontal, bottom + height + radius * 2.9, depth], [0.25, radius * 0.65, 0.25]);
  }
  for (let edge = 0; edge < 8; edge++) {
    const angle = edge / 8 * Math.PI * 2;
    shop.add('box', 'pale', [horizontal + Math.sin(angle) * radius * 1.06, bottom + height + 1, depth + Math.cos(angle) * radius * 1.06], [1.5, 2.6, 1.2], [0, angle, 0]);
    const pilasterAngle = angle + Math.PI / 8;
    shop.add('box', 'pale', [horizontal + Math.sin(pilasterAngle) * radius, bottom + height / 2, depth + Math.cos(pilasterAngle) * radius], [0.5, height - 2, 0.5], [0, pilasterAngle, 0]);
  }
}

export class PalaceDistrict {
  constructor(scene) {
    this.scene = scene; this.root = new THREE.Group(); this.root.name = '潮冠宫城'; this.root.visible = false; this.scene.add(this.root); this.rooms = new Map(); this.visited = new Set(); this.activeRoom = null;
    this.frustum = new THREE.Frustum(); this.viewProjection = new THREE.Matrix4(); this.roomBounds = new THREE.Box3();
  }
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
      for (const distance of [-108, -27, 54]) tower(shop, side * 72, distance, 0, distance === -108 ? 75 : distance === 54 ? 49 : 58, 9, distance === 54);
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
    tower(shop, 0, -77, 24, 78, 21, true);
    for (const side of [-1, 1]) tower(shop, side * 33, -60, 24, 49, 11, true);
    tower(shop, 0, 11, 24, 33, 15, true);
    for (const side of [-1, 1]) {
      shop.add('box', 'stone', [side * 36, 39, 14], [31, 30, 43], [0, 0, 0], true);
      shop.add('soft', 'roof', [side * 36, 56, 14], [33, 3, 45], [0, 0, 0], true);
      for (const distance of [0, 28]) crownDome(shop, side * 36, distance, 57, 11.5);
      for (const edge of [-1, 1]) rail(shop, [side * 36 + edge * 15.7, -7], [side * 36 + edge * 15.7, 35], 57.5, 2);
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
    imperialPortal(shop);
    this.root.add(shop.finish('潮冠宫城 · 铜穹与雕饰柱廊'));
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
    this.fill = new THREE.PointLight('#ffe4b8', 0, 78, 1.25); this.fill.position.set(0, 17, 26); this.fill.castShadow = false; this.root.add(this.fill);
    this.lightTarget = new THREE.Vector3(0, 17, 26);
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
  update(position, offset, delta = 1 / 60, camera = null) {
    const distance = Math.hypot(position.x - PALACE_CENTER[0], position.z - PALACE_CENTER[2]);
    if (distance < 670) this.prepare();
    if (!this.ready) return;
    this.root.visible = distance < 900; this.root.position.set(PALACE_CENTER[0], this.base, PALACE_CENTER[2]).sub(offset);
    this.activeRoom = this.roomAt(position);
    if (this.activeRoom) this.visited.add(this.activeRoom.id);
    if (camera) { camera.updateMatrixWorld(); this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
    const lateral = position.x - PALACE_CENTER[0]; const depth = position.z - PALACE_CENTER[2]; const elevation = position.y - this.base;
    for (const room of PALACE_ROOMS) {
      const close = Math.hypot(position.x - PALACE_CENTER[0] - room.center[0], position.z - PALACE_CENTER[2] - room.center[1]) < 95 && position.y < this.base + 38;
      if (close && !this.rooms.has(room.id)) {
        const root = furnishings(room, this.materials); const halfWidth = room.id === 'reception' ? 63 : 28;
        root.userData.viewBounds = new THREE.Box3(new THREE.Vector3(room.center[0] - halfWidth, -0.2, room.center[1] - 28), new THREE.Vector3(room.center[0] + halfWidth, 22, room.center[1] + 28));
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
    const outside = Math.max(0, Math.abs(lateral) - 63, depth - 54, -108 - depth, elevation - 22, -elevation);
    const intensity = 65 * (1 - THREE.MathUtils.smoothstep(outside, 0, 16));
    const elapsed = Math.min(Math.max(delta, 0), 0.1);
    this.fill.position.lerp(this.lightTarget, 1 - Math.exp(-elapsed * 3));
    this.fill.intensity = THREE.MathUtils.damp(this.fill.intensity, intensity, 4, elapsed);
  }
  inspect() { return { ready: Boolean(this.ready), room: this.activeRoom?.id || null, visited: [...this.visited], loadedRooms: [...this.rooms.keys()], base: this.base, name: '潮冠宫城' }; }
}
