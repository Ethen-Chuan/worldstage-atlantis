import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, symlink, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPhonePreview } from '../scripts/phone-preview.js';

test('LAN preview serves only static build files and never exposes model routes or escaped files', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'worldstage-preview-'));
  const root = path.join(folder, 'dist'); await mkdir(root);
  await writeFile(path.join(root, 'index.html'), '<main>ocean</main>');
  await writeFile(path.join(root, '.env'), 'private-test-marker');
  await writeFile(path.join(folder, 'outside.txt'), 'outside-test-marker');
  await symlink(path.join(folder, 'outside.txt'), path.join(root, 'escape.txt'));
  const hosts = []; const server = createPhonePreview(root, hosts);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `127.0.0.1:${server.address().port}`; hosts.push(address);
  const request = (route, method = 'GET', host = address) => new Promise((resolve, reject) => {
    const outgoing = http.request(`http://${address}${route}`, { method, headers: { host } }, incoming => { let body = ''; incoming.on('data', chunk => body += chunk); incoming.on('end', () => resolve({ status: incoming.statusCode, body })); });
    outgoing.on('error', reject); outgoing.end();
  });
  try {
    assert.equal((await request('/')).body, '<main>ocean</main>');
    for (const route of ['/api/config', '/api/interpret', '/api/media/config', '/.env', '/escape.txt', '/%2e%2e/outside.txt']) assert.equal((await request(route)).status, 404);
    assert.equal((await request('/', 'POST')).status, 405);
    assert.equal((await request('/', 'GET', 'untrusted.example')).status, 403);
    assert.equal((await request('/', 'HEAD')).body, '');
  } finally { await new Promise(resolve => server.close(resolve)); await rm(folder, { recursive: true, force: true }); }
});
