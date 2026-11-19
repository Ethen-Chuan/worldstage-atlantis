import fs from 'node:fs/promises';
const directory = new URL('../public/audio/orchestra/', import.meta.url);
const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', directory), 'utf8'));
for (const sample of manifest.samples) {
  try { await fs.access(new URL(sample.file, directory)); }
  catch { throw new Error(`Missing orchestral sample ${sample.file}. Run npm run audio:prepare first (requires FFmpeg and network access).`); }
}
console.log(`Orchestral assets ready: ${manifest.samples.length} samples.`);
for (const file of ['mermaid-song.mp3', 'distant-whale.mp3']) {
  try { await fs.access(new URL(`../public/audio/voices/${file}`, import.meta.url)); }
  catch { throw new Error(`Missing creature voice ${file}. Run npm run audio:voices first.`); }
}
console.log('Lyrical song and recorded whale assets ready.');
const gateManifest = JSON.parse(await fs.readFile(new URL('../public/audio/gate/manifest.json', import.meta.url), 'utf8'));
for (const file of gateManifest.files) {
  try {
    const info = await fs.stat(new URL(`../public/audio/gate/${file}`, import.meta.url));
    if (info.size < 1000) throw new Error('Empty asset');
  } catch { throw new Error(`Missing ancient Greek gate voice ${file}. Run npm run audio:gate first (uv, Python 3.12 and FFmpeg required).`); }
}
console.log('Seven ancient Greek male gate responses ready. No Chinese fallback.');
