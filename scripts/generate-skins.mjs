import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const width = 1024;
const height = 1024;
const output = new URL('../public/textures/', import.meta.url);
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const bounded = clamp(value); return bounded * bounded * (3 - 2 * bounded); };
const fract = value => value - Math.floor(value);
const hash = (horizontal, vertical) => fract(Math.sin(horizontal * 127.1 + vertical * 311.7) * 43758.5453);
const noise = (horizontal, vertical) => {
  const column = Math.floor(horizontal); const row = Math.floor(vertical);
  const offsetX = smooth(fract(horizontal)); const offsetY = smooth(fract(vertical));
  const low = hash(column, row) * (1 - offsetX) + hash(column + 1, row) * offsetX;
  const high = hash(column, row + 1) * (1 - offsetX) + hash(column + 1, row + 1) * offsetX;
  return low * (1 - offsetY) + high * offsetY;
};

function crc32(bytes) {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit++) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const label = Buffer.from(type); const header = Buffer.alloc(4); header.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([header, label, data, checksum]);
}

function writeTexture(name, sampler) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const channels = sampler(column / width, row / height);
      const offset = row * (width * 4 + 1) + 1 + column * 4;
      channels.forEach((channel, index) => { scanlines[offset + index] = Math.round(clamp(channel) * 255); });
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const file = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(new URL(name, output), file);
  console.log(`${name}: ${file.length} bytes, ${width} × ${height}, opaque packed pigment / relief / roughness`);
}

mkdirSync(output, { recursive: true });
writeTexture('ancient-skin.png', (horizontal, vertical) => {
  const rows = vertical * 36; const row = Math.floor(rows);
  const columns = horizontal * 28 + row % 2 * 0.5;
  const across = fract(columns) - 0.5; const along = fract(rows);
  const ridge = 0.36 + Math.sqrt(Math.max(0, 0.25 - across * across)) * 0.72;
  const seam = Math.exp(-Math.pow((along - ridge) * 36, 2));
  const scale = Math.pow(Math.max(0, 1 - across * across * 4), 0.6) * smooth(along * 1.5);
  const cloud = noise(horizontal * 19, vertical * 15) * 0.65 + noise(horizontal * 71, vertical * 73) * 0.35;
  const grain = noise(horizontal * 310, vertical * 330);
  const pores = smooth((grain - 0.69) * 5);
  const pigment = 0.47 + cloud * 0.37 + seam * 0.15 - pores * 0.1;
  const relief = 0.4 + scale * 0.27 - seam * 0.19 + (grain - 0.5) * 0.085;
  return [pigment, relief, 0.43 + cloud * 0.3 + pores * 0.2, 1];
});
writeTexture('whale-skin.png', (horizontal, vertical) => {
  const cloud = noise(horizontal * 13, vertical * 9) * 0.55 + noise(horizontal * 47, vertical * 43) * 0.3 + noise(horizontal * 109, vertical * 101) * 0.15;
  const grain = noise(horizontal * 390, vertical * 420);
  const scars = Math.exp(-Math.pow(Math.sin(vertical * 122 + noise(horizontal * 7, vertical * 4) * 2.4) * 31, 2)) * smooth((noise(horizontal * 39, vertical * 23) - 0.48) * 5);
  return [0.47 + cloud * 0.37 + scars * 0.16, 0.48 + (grain - 0.5) * 0.16 - scars * 0.15, 0.31 + cloud * 0.34, 1];
});
