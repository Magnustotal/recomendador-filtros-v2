import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');

test('la app es solo modo claro: sin light-dark(), sin tema oscuro y con color-scheme: light', () => {
  const css = read('styles.css');
  assert.ok(!css.includes('light-dark('));
  assert.ok(!/prefers-color-scheme:\s*dark/.test(css));
  assert.ok(!css.includes('data-theme'));
  assert.match(css, /color-scheme:\s*light;/);
  const html = read('index.html');
  assert.ok(!/prefers-color-scheme:\s*dark/.test(html));
  assert.match(html, /<meta name="color-scheme" content="light">/);
  assert.ok(!/data-theme|THEME_KEY|applyTheme/.test(read('app.js')));
});

test('no quedan pantallas de arranque oscuras', () => {
  assert.deepEqual(readdirSync(new URL('../public/splash/', import.meta.url)).filter((f) => f.startsWith('dark-')), []);
});

test('el service worker precachea todos los módulos JS locales que importa la app (si falta uno, no hay modo sin conexión)', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const pub = new URL('../public/', import.meta.url);
  const sw = readFileSync(new URL('sw.js', pub), 'utf8');
  const core = [...sw.match(/const CORE = \[(.*?)\];/s)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const modules = readdirSync(pub).filter((f) => f.endsWith('.js') && f !== 'sw.js');
  for (const f of modules) {
    const src = readFileSync(new URL(f, pub), 'utf8');
    for (const [, dep] of src.matchAll(/(?:from|import)\s*\(?\s*'\.\/([\w-]+\.js)'/g)) assert.ok(core.includes(dep), `${f} importa ${dep}, que no está en CORE`);
  }
  for (const m of modules) assert.ok(core.includes(m), `${m} no está en CORE`);
});
