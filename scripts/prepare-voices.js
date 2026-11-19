import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../public/audio/voices/', import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
const scratch = fileURLToPath(new URL('../work/voice-sources/', import.meta.url));
await fs.mkdir(scratch, { recursive: true });
for (const asset of manifest.assets) {
  const local = path.join(scratch, `${asset.file}.source`);
  let data = await fs.readFile(local).catch(() => null);
  if (!data || createHash('sha256').update(data).digest('hex') !== asset.sha256) {
    const response = await fetch(asset.source, { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`Source unavailable: ${asset.file}`);
    data = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(data).digest('hex') !== asset.sha256) throw new Error(`Source checksum changed: ${asset.file}`);
    await fs.writeFile(local, data);
  }
  const result = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', local, '-map_metadata', '-1', '-af', asset.filter, '-t', String(asset.duration), '-ar', '32000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '128k', path.join(directory, asset.file)]);
  if (result.error || result.status !== 0) throw new Error(`FFmpeg unavailable or conversion failed: ${asset.file}`);
  console.log(`Prepared ${asset.file}; verified source SHA-256; metadata stripped.`);
}
