import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GATE_LINES } from '../src/gate-language.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = path.join(root, 'work/gate-model');
const output = path.join(root, 'public/audio/gate');
const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
await fs.mkdir(scratch, { recursive: true });
for (const asset of manifest.models) {
  const file = path.join(scratch, asset.file);
  let data = await fs.readFile(file).catch(() => null);
  if (!data || createHash('sha256').update(data).digest('hex') !== asset.sha256) {
    console.log(`Downloading ${asset.file} from the pinned public model release…`);
    const response = await fetch(asset.source, { signal: AbortSignal.timeout(1800000) });
    if (!response.ok) throw new Error(`Model unavailable: ${asset.file}`);
    data = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(data).digest('hex') !== asset.sha256) throw new Error(`Model checksum changed: ${asset.file}`);
    await fs.writeFile(file, data);
  }
}
const environment = { ...process.env, UV_CACHE_DIR: process.env.UV_CACHE_DIR || path.join(scratch, 'uv-cache'), UV_PYTHON_INSTALL_DIR: path.join(scratch, 'python') };
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env: environment, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`${command} failed. Install uv, Python 3.12 and FFmpeg, then retry npm run audio:gate.`);
}
const python = path.join(scratch, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
run('uv', ['venv', '--python', '3.12', '--allow-existing', path.join(scratch, 'venv')]);
run('uv', ['pip', 'install', '--python', python, 'kokoro-onnx==0.4.9', 'soundfile==0.13.1', 'onnxruntime==1.32.0', 'numpy==2.5.5']);
const lines = path.join(scratch, 'lines.json'); await fs.writeFile(lines, JSON.stringify(GATE_LINES));
run(python, ['scripts/render-gate-voice.py', '--model-dir', scratch, '--lines', lines, '--output', output]);
console.log('Seven ancient Greek responses prepared from grc phonemes. No user input is uploaded. Synthetic pronunciation is approximate, not an authenticated historical reconstruction.');
