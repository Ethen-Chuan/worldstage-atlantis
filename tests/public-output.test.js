import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

async function fixture(context) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atlantis-public-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const directory of ['scripts', 'dist/assets', '.vercel']) await fs.mkdir(path.join(root, directory), { recursive: true });
  await fs.copyFile(new URL('../scripts/prepare-public-output.mjs', import.meta.url), path.join(root, 'scripts/prepare-public-output.mjs'));
  const contents = {
    '.gitignore': 'dist/\nwork/\n.vercel/\n',
    'package.json': JSON.stringify({ version: '0.10.1' }),
    'vercel.json': JSON.stringify({ headers: [{ source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] }] }),
    '.vercel/project.json': JSON.stringify({ projectId: 'project-test', orgId: 'team-test', projectName: 'test', ignored: 'not-for-upload' }),
    'dist/index.html': '<!doctype html><title>Atlantis</title>',
    'dist/assets/app.js': 'export const available = false;',
    'dist/capabilities.json': JSON.stringify({ available: false }),
    'dist/media-capabilities.json': JSON.stringify({ video: { available: false }, realtime: { available: false } }),
  };
  for (const [filename, content] of Object.entries(contents)) await fs.writeFile(path.join(root, filename), content);
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init']);
  git(['add', '.']);
  git(['-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Fixture']);
  const run = () => execFileSync(process.execPath, ['scripts/prepare-public-output.mjs'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { root, git, run };
}

test('public output includes only static assets, safe routes and verifiable release metadata', async context => {
  const { root, git, run } = await fixture(context);
  run();
  const output = path.join(root, 'work/vercel-public/.vercel/output');
  assert.deepEqual((await fs.readdir(output)).sort(), ['config.json', 'static']);
  const config = JSON.parse(await fs.readFile(path.join(output, 'config.json'), 'utf8'));
  assert.equal(config.version, 3);
  assert.equal(config.routes[0].headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(config.routes.find(route => route.src === '/api/config').dest, '/capabilities.json');
  assert.equal(config.routes.find(route => route.src === '/api/media/config').dest, '/media-capabilities.json');
  assert.equal(config.routes.find(route => route.src === '/api/.*').status, 404);
  assert.equal(config.routes.at(-1).handle, 'filesystem');
  const release = JSON.parse(await fs.readFile(path.join(output, 'static/release.json'), 'utf8'));
  assert.equal(release.sourceCommit, git(['rev-parse', 'HEAD']).trim());
  assert.equal(release.mode, 'public-static');
  assert.equal(release.assets, 4);
  const project = JSON.parse(await fs.readFile(path.join(root, 'work/vercel-public/.vercel/project.json'), 'utf8'));
  assert.deepEqual(Object.keys(project).sort(), ['orgId', 'projectId', 'projectName']);
  await assert.rejects(fs.access(path.join(output, 'static/package.json')));
  const inventory = JSON.parse(await fs.readFile(path.join(root, 'work/vercel-public-inventory.json'), 'utf8'));
  assert.ok(inventory.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
});

test('public output rejects an unreviewed Git worktree', async context => {
  const { root, run } = await fixture(context);
  await fs.writeFile(path.join(root, 'unreviewed.txt'), 'Unreviewed change');
  assert.throws(run, /Commit the reviewed release/);
});

test('public output refuses hidden files, symlinks and unsupported assets', async context => {
  const { root, run } = await fixture(context);
  for (const filename of ['.env', 'source.map']) {
    await fs.writeFile(path.join(root, 'dist', filename), 'Not publishable');
    assert.throws(run, /Hidden files|Unsupported public asset/);
    await fs.unlink(path.join(root, 'dist', filename));
  }
  await fs.symlink(path.join(root, 'package.json'), path.join(root, 'dist/linked.json'));
  assert.throws(run, /Hidden files and symlinks/);
});

test('public output refuses enabled language or media interfaces', async context => {
  const { root, run } = await fixture(context);
  await fs.writeFile(path.join(root, 'dist/capabilities.json'), JSON.stringify({ available: true }));
  assert.throws(run, /Paid model interfaces must stay disabled/);
  await fs.writeFile(path.join(root, 'dist/capabilities.json'), JSON.stringify({ available: false }));
  await fs.writeFile(path.join(root, 'dist/media-capabilities.json'), JSON.stringify({ video: { available: false }, realtime: { available: true } }));
  assert.throws(run, /Paid model interfaces must stay disabled/);
});

test('public output requires a built entry point', async context => {
  const { root, run } = await fixture(context);
  await fs.unlink(path.join(root, 'dist/index.html'));
  assert.throws(run, /Run npm run build:public first/);
});
