import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../public/version.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('la versión coincide en version.js y package.json y tiene formato semver', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(read('../package.json')).version, VERSION);
});

test('el service worker precachea version.js (la app lo importa)', () => {
  assert.match(read('../public/sw.js'), /'version\.js'/);
});

test('cada pantalla de arranque enlazada en index.html existe', () => {
  const hrefs = [...read('../public/index.html').matchAll(/apple-touch-startup-image" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 16);
  for (const h of hrefs) assert.ok(readFileSync(new URL(`../public/${h}`, import.meta.url)).length > 100, h);
});
