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
