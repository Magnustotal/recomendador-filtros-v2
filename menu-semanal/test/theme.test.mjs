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
