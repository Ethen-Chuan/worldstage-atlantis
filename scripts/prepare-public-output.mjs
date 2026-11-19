import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'dist');
const staging = path.join(root, 'work/vercel-public');
const output = path.join(staging, '.vercel/output');
const extensions = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.png', '.webp', '.woff', '.woff2', '.mp3', '.txt']);
const files = [];
async function inspect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) throw new Error('Hidden files and symlinks cannot enter the public bundle.');
    if (entry.isDirectory()) await inspect(location);
    else {
      if (!entry.isFile() || !extensions.has(path.extname(entry.name))) throw new Error(`Unsupported public asset: ${entry.name}`);
      const bytes = await fs.readFile(location);
      files.push({ path: path.relative(source, location).split(path.sep).join('/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
await inspect(source);
if (!files.some(file => file.path === 'index.html')) throw new Error('Run npm run build:public first.');
const capabilities = JSON.parse(await fs.readFile(path.join(source, 'capabilities.json'), 'utf8'));
const media = JSON.parse(await fs.readFile(path.join(source, 'media-capabilities.json'), 'utf8'));
if (capabilities.available !== false || media.video.available !== false || media.realtime.available !== false) throw new Error('Paid model interfaces must stay disabled in the shared build.');
const config = JSON.parse(await fs.readFile(path.join(root, 'vercel.json'), 'utf8'));
const project = JSON.parse(await fs.readFile(path.join(root, '.vercel/project.json'), 'utf8'));
const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('Commit the reviewed release before packaging production.');
await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
await fs.cp(source, path.join(output, 'static'), { recursive: true });
const headers = Object.fromEntries(config.headers.flatMap(rule => rule.headers.map(header => [header.key, header.value])));
const release = { version, sourceCommit, mode: 'public-static', assets: files.length, builtAt: new Date().toISOString() };
await fs.writeFile(path.join(output, 'static/release.json'), JSON.stringify(release));
await fs.writeFile(path.join(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '/(.*)', headers, continue: true },
    { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '/(?:index.html|release.json)?', headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' }, continue: true },
    { src: '/api/config', dest: '/capabilities.json' },
    { src: '/api/media/config', dest: '/media-capabilities.json' },
    { src: '/api/.*', status: 404 },
    { handle: 'filesystem' },
  ],
}, null, 2));
await fs.writeFile(path.join(staging, '.vercel/project.json'), JSON.stringify({ projectId: project.projectId, orgId: project.orgId, projectName: project.projectName }));
await fs.writeFile(path.join(root, 'work/vercel-public-inventory.json'), JSON.stringify({ ...release, files }, null, 2));
console.log(`Prepared ${files.length} reviewed static assets and release metadata in ${staging}. No source files, environment files, models or server functions are included.`);
