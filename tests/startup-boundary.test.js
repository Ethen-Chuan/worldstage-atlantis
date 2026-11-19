import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALACE_ROOMS, PALACE_CENTER } from '../src/palace-layout.js';
import { PALACE_ROOMS as runtimeRooms, PALACE_CENTER as runtimeCenter } from '../src/palace-district.js';
import { SITE_PLAY, embodimentMarkup, playMarkup } from '../src/world-interface.js';
import { SITE_PLAY as runtimePlay } from '../src/tide-play.js';

test('initial interface graph cannot pull Three.js, anatomy or rendering through metadata imports', () => {
  const visited = new Set();
  const inspect = filename => {
    if (visited.has(filename)) return;
    visited.add(filename);
    const source = fs.readFileSync(filename, 'utf8');
    for (const match of source.matchAll(/^import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      assert.doesNotMatch(match[1], /^three(?:\/|$)|human-geometry|ocean\.js/);
      if (match[1].startsWith('.') && match[1].endsWith('.js')) inspect(path.resolve(path.dirname(filename), match[1]));
    }
  };
  inspect(fileURLToPath(new URL('../src/main.js', import.meta.url)));
  assert.ok(visited.size > 10);
});

test('rendering and interface use one source for palace metadata, play labels and view controls', () => {
  assert.equal(PALACE_ROOMS, runtimeRooms);
  assert.equal(PALACE_CENTER, runtimeCenter);
  assert.equal(SITE_PLAY, runtimePlay);
  assert.equal(PALACE_ROOMS.length, 7);
  assert.match(embodimentMarkup(), /inhabit-exit/);
  assert.doesNotMatch(embodimentMarkup(), /<select/);
  assert.match(playMarkup(), /trial-start/);
});

test('HTML has a real fallback before JavaScript and dynamic entry has a retry path', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="boot-shell"/);
  assert.match(html, /src="\/src\/entry.js"/);
  const entry = fs.readFileSync(new URL('../src/entry.js', import.meta.url), 'utf8');
  assert.match(entry, /import\('\.\/main.js'\)\.catch/);
  assert.match(entry, /location.reload/);
});

test('saving and guide completion wait for the return camera instead of storing an intermediate view', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const save = main.slice(main.indexOf('function saveWorld()'), main.indexOf('function cancelUnderstanding()'));
  assert.match(save, /if \(ocean\.embodiment\.blend \|\| ocean\.travelTarget\) return toast/);
  assert.ok(save.indexOf('localStorage.setItem') < save.indexOf("kind: 'saved'"));
  assert.match(main, /elements\['guide-action'\]\.disabled = returning/);
});
