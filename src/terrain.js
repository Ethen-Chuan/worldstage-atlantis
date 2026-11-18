import { LANDMARKS } from './landmarks.js';
export const CHUNK_SIZE = 240;
export const STREAM_RADIUS = 2;
const smooth = value => { const fraction = Math.max(0, Math.min(1, value)); return fraction * fraction * (3 - 2 * fraction); };
export function worldHash(horizontal, depth, salt = 0) {
  let hash = Math.imul(horizontal | 0, 374761393) ^ Math.imul(depth | 0, 668265263) ^ Math.imul(salt + 17, 1274126177);
  hash = Math.imul(hash ^ hash >>> 13, 1274126177);
  return ((hash ^ hash >>> 16) >>> 0) / 4294967296;
}
function naturalHeight(horizontal, depth) {
  const distance = Math.hypot(horizontal / 1.2, (depth + 80) / 1.5);
  const outside = smooth((distance - 230) / 260);
  const dunes = Math.sin(horizontal * 0.006 + Math.sin(depth * 0.004) * 1.8) * 13 + Math.cos(depth * 0.008 - horizontal * 0.001) * 9;
  const ridges = Math.sin(horizontal * 0.016) * Math.cos(depth * 0.015) * 3;
  return -8 + outside * (dunes + ridges) + Math.sin(horizontal * 0.035 + depth * 0.016) * 1.2 + Math.sin(depth * 0.12 + horizontal * 0.05) * 0.35;
}
export function seaHeight(horizontal, depth) {
  let elevation = naturalHeight(horizontal, depth);
  for (const landmark of LANDMARKS) {
    if (landmark.kind === 'city') continue;
    const distance = Math.hypot(horizontal - landmark.center[0], depth - landmark.center[2]);
    if (distance > 125) continue;
    const influence = 1 - smooth((distance - 65) / 60);
    elevation += (naturalHeight(landmark.center[0], landmark.center[2]) - elevation) * influence;
  }
  return elevation;
}
export function biomeAt(horizontal, depth) {
  if (Math.hypot(horizontal, depth + 80) < 390) return { id: 'city', name: '潮生圣城', color: '#21484c' };
  const field = Math.sin(horizontal * 0.0017) + Math.cos(depth * 0.0023) + Math.sin((horizontal + depth) * 0.0011) * 0.55;
  if (field > 0.7) return { id: 'reef', name: '琥珀珊瑚原', color: '#225958' };
  if (field < -0.7) return { id: 'garden', name: '月光水母海', color: '#173c50' };
  if (Math.sin(depth * 0.0013 - horizontal * 0.002) > 0.48) return { id: 'ruins', name: '无名的古王国', color: '#294e4d' };
  return { id: 'trench', name: '玄武岩长谷', color: '#193e48' };
}
export function chunkCoordinates(horizontal, depth) { return [Math.floor(horizontal / CHUNK_SIZE), Math.floor(depth / CHUNK_SIZE)]; }
export function chunkKey(horizontal, depth) { return `${horizontal}:${depth}`; }
export function activeChunks(horizontal, depth, radius = STREAM_RADIUS) {
  const [centerX, centerZ] = chunkCoordinates(horizontal, depth);
  const chunks = [];
  for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) for (let offsetX = -radius; offsetX <= radius; offsetX++) chunks.push({ horizontal: centerX + offsetX, depth: centerZ + offsetZ, key: chunkKey(centerX + offsetX, centerZ + offsetZ), distance: offsetX * offsetX + offsetZ * offsetZ });
  return chunks.sort((first, second) => first.distance - second.distance);
}
export function chunkLandmarks(horizontal, depth) {
  const centerX = (horizontal + 0.5) * CHUNK_SIZE;
  const centerZ = (depth + 0.5) * CHUNK_SIZE;
  if (Math.hypot(centerX, centerZ + 80) < 490) return [];
  const random = salt => worldHash(horizontal, depth, salt);
  const biome = biomeAt(centerX, centerZ);
  const count = biome.id === 'ruins' ? 3 : biome.id === 'garden' ? 2 : 1;
  return Array.from({ length: count }, (_, index) => {
    const positionX = horizontal * CHUNK_SIZE + 35 + random(index * 4) * 170;
    const positionZ = depth * CHUNK_SIZE + 35 + random(index * 4 + 1) * 170;
    return { kind: biome.id === 'reef' ? 'coral' : biome.id === 'garden' ? 'jelly' : biome.id === 'trench' ? 'rock' : random(index + 18) > 0.5 ? 'temple' : 'arch', position: [positionX, seaHeight(positionX, positionZ), positionZ], scale: biome.id === 'garden' ? 1.5 + random(index * 4 + 2) * 1.3 : 0.7 + random(index * 4 + 2) * 0.9, rotation: random(index * 4 + 3) * Math.PI * 2 };
  });
}
