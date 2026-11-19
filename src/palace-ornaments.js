import { column, moldingFrame, shellCrest } from './palace-craft.js';

export function floorMedallion(shop, horizontal, depth, radius, elongated = 1) {
  shop.add('disc', 'mosaic', [horizontal, 0.025, depth], [radius, radius * elongated, 1], [-Math.PI / 2, 0, 0], false, '海潮石拼花');
  for (const fraction of [0.36, 0.73, 0.91, 0.97]) shop.add('inlay', 'gold', [horizontal, 0.045, depth], [radius * fraction, radius * elongated * fraction, 1], [-Math.PI / 2, 0, 0]);
  for (let petal = 0; petal < 12; petal++) {
    const angle = petal / 12 * Math.PI * 2;
    const offset = radius * 0.53;
    shop.add('soft', petal % 2 ? 'ivory' : 'lapis', [horizontal + Math.sin(angle) * offset, 0.038, depth + Math.cos(angle) * offset * elongated], [radius * 0.13, 0.022, radius * 0.57], [0, angle, 0], false, '十二向潮汐纹章');
  }
  shop.add('disc', 'ivory', [horizontal, 0.05, depth], [radius * 0.32, radius * 0.32, 1], [-Math.PI / 2, 0, 0]);
  shop.add('inlay', 'gold', [horizontal, 0.06, depth], [radius * 0.29, radius * 0.29, 1], [-Math.PI / 2, 0, 0]);
}

function floorBorder(shop, horizontal, depth, width, length) {
  for (const side of [-1, 1]) {
    for (const inset of [0, 0.5]) {
      shop.add('box', inset ? 'gold' : 'mosaic', [horizontal + side * (width / 2 - inset), 0.035, depth], [inset ? 0.11 : 0.6, 0.03, length]);
      shop.add('box', inset ? 'gold' : 'mosaic', [horizontal, 0.035, depth + side * (length / 2 - inset)], [width, 0.03, inset ? 0.11 : 0.6]);
    }
  }
  for (let offset = -width / 2 + 1.7; offset < width / 2; offset += 3.4) for (const side of [-1, 1]) {
    shop.add('box', 'gold', [horizontal + offset, 0.058, depth + side * length / 2], [0.32, 0.02, 0.32], [0, Math.PI / 4, 0]);
  }
}

function wallPanel(shop, center, width, yaw, surface = 'lapis') {
  const project = (across, height, relief = 0) => [center[0] + across * Math.cos(yaw) + relief * Math.sin(yaw), height, center[1] - across * Math.sin(yaw) + relief * Math.cos(yaw)];
  shop.add('box', surface, project(0, 12), [width, 11, 0.09], [0, yaw, 0], false, '深海珐琅嵌板');
  moldingFrame(shop, project(0, 12, 0.07), width + 0.2, 11.2, yaw, 'pale', 0.4);
  moldingFrame(shop, project(0, 12, 0.29), width - 0.55, 10.4, yaw, 'gold', 0.12);
  moldingFrame(shop, project(0, 3.2, 0.1), width, 3.4, yaw, 'gold', 0.1);
  for (const sign of [-1, 1]) {
    shop.add('leaf', 'gold', project(sign * width * 0.29, 12, 0.3), [0.16, 1.75, 0.1], [0, yaw, sign * 0.27]);
    shellCrest(shop, project(sign * width * 0.33, 15.5, 0.3), 0.7, 'gold', yaw);
  }
  shellCrest(shop, project(0, 9.8, 0.3), Math.min(2.4, width * 0.4), 'gold', yaw);
  shop.add('soft', 'pale', project(0, 5.45), [width + 0.3, 0.45, 0.55], [0, yaw, 0]);
}

function coffer(shop, horizontal, depth, width, length) {
  shop.add('box', 'pale', [horizontal, 21.4, depth], [width, 0.3, length], [0, 0, 0], false, '象牙石藻井');
  shop.add('box', 'dark', [horizontal, 21.18, depth], [width - 0.8, 0.12, length - 0.8]);
  shop.add('box', 'ivory', [horizontal, 21.08, depth], [width - 1.6, 0.09, length - 1.6]);
  for (const side of [-1, 1]) {
    shop.add('box', 'gold', [horizontal + side * (width / 2 - 0.62), 20.98, depth], [0.16, 0.16, length - 1.1]);
    shop.add('box', 'gold', [horizontal, 20.98, depth + side * (length / 2 - 0.62)], [width - 1.1, 0.16, 0.16]);
  }
  for (let petal = 0; petal < 6; petal++) {
    const angle = petal / 6 * Math.PI * 2;
    shop.add('leaf', 'gold', [horizontal + Math.sin(angle) * 0.5, 20.92, depth + Math.cos(angle) * 0.5], [0.25, 0.08, 0.63], [0, angle, 0], false, '藻井花结');
  }
  shop.add('sphere', 'pearl', [horizontal, 20.83, depth], [0.24, 0.13, 0.24]);
}

export function decorateRoom(shop, room) {
  const [horizontal, depth] = room.center;
  const width = room.id === 'reception' ? 120 : 50;
  const length = 48;
  floorBorder(shop, horizontal, depth, width - 3, length - 3);
  if (room.id === 'reception') floorMedallion(shop, 0, 26, 13);
  else if (room.id === 'salon') floorMedallion(shop, -35, -27, 17);
  else if (room.id === 'club') floorMedallion(shop, 35, -79, 17);
  else {
    shop.add('box', 'wine', [horizontal, 0.031, depth], [32, 0.04, room.id === 'banquet' ? 41 : 36], [0, 0, 0], false, '织锦地毯');
    floorBorder(shop, horizontal, depth, 30, room.id === 'banquet' ? 39 : 34);
  }
  const columns = room.id === 'reception' ? 8 : 4;
  for (let across = 0; across < columns; across++) for (let along = 0; along < 4; along++) {
    coffer(shop, horizontal + (across - (columns - 1) / 2) * width / columns, depth + (along - 1.5) * 11.7, width / columns - 0.4, 11.2);
  }
  for (const side of [-1, 1]) {
    const end = room.id === 'reception' ? (side < 0 ? 0.9 : 53.1) : depth + side * 26.05;
    for (let panel = -width / 2 + 6; panel < width / 2; panel += 11) {
      if (room.id === 'reception' && Math.abs(panel) < 10) continue;
      if (side < 0 && ['bedroom', 'club'].includes(room.id) && Math.abs(panel) < 15) continue;
      wallPanel(shop, [horizontal + panel, end], 7.2, side > 0 ? Math.PI : 0, room.id === 'bedroom' ? 'wine' : 'lapis');
    }
    const lateral = room.id === 'reception' ? side * 62.1 : horizontal + side * 26;
    for (let panel = -18; panel <= 18; panel += 12) {
      const internal = room.id !== 'reception' && Math.abs(lateral) < 10;
      if (internal && Math.abs(panel) < 12) continue;
      wallPanel(shop, [lateral, depth + panel], 8.3, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
  const cornerWidth = room.id === 'reception' ? 57 : 23.5;
  for (const lateral of [-1, 1]) for (const distance of [-1, 1]) column(shop, horizontal + lateral * cornerWidth, depth + distance * 23, 0, 21, 0.72);
  for (const side of [-1, 1]) {
    for (const elevation of [19.4, 20, 20.5]) {
      shop.add('box', 'ivory', [horizontal, elevation, depth + side * 26], [width, 0.32, 0.8]);
      shop.add('box', 'ivory', [horizontal + side * (width / 2 + 1), elevation, depth], [0.8, 0.32, 50]);
    }
  }
  shop.add('ring', 'gold', [horizontal, 20.58, depth], [6, 6, 3], [Math.PI / 2, 0, 0], false, '中央穹顶饰环');
  shop.add('ring', 'ivory', [horizontal, 20.63, depth], [6.45, 6.45, 5], [Math.PI / 2, 0, 0]);
}
