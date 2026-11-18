import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = process.env.ORCHESTRA_WORK || path.join(root, 'work/orchestra');
const output = path.join(root, 'public/audio/orchestra');
const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
await fs.mkdir(scratch, { recursive: true });
if (spawnSync('ffmpeg', ['-version']).status !== 0) throw new Error('Install FFmpeg with libmp3lame before running npm run audio:prepare.');
for (const sample of manifest.samples) {
  if (!/^[a-z]+-\d+-\d+\.mp3$/.test(sample.file)) throw new Error('Invalid audio filename');
  const original = path.join(scratch, `${sample.sourceBlob}.wav`);
  try { await fs.access(original); } catch {
    const response = await fetch(`https://api.github.com/repos/sgossner/VSCO-2-CE/git/blobs/${sample.sourceBlob}`, { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`Source download failed (${response.status}): ${sample.file}`);
    const blob = await response.json();
    if (blob.encoding !== 'base64') throw new Error('Unexpected source encoding');
    await fs.writeFile(original, Buffer.from(blob.content, 'base64'));
  }
  const bytes = await fs.readFile(original);
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (blob !== sample.sourceBlob) throw new Error(`Source integrity mismatch: ${sample.file}`);
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', original, '-f', 'f32le', '-ac', '1', '-ar', '32000', 'pipe:1'], { maxBuffer: 16000000 });
  if (decoded.status) throw new Error(`Decode failed: ${sample.file}`);
  let peak = 0; for (let offset = 0; offset < decoded.stdout.length; offset += 4) peak = Math.max(peak, Math.abs(decoded.stdout.readFloatLE(offset)));
  const result = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', original, '-map_metadata', '-1', '-af', `volume=${0.82 / Math.max(peak, 0.001)},highpass=f=30`, '-t', '9', '-ar', '32000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '128k', path.join(output, sample.file)]);
  if (result.status) throw new Error(`Encode failed: ${sample.file}: ${result.stderr.toString()}`);
  console.log(`Prepared ${sample.instrument}: ${sample.file}`);
}
