import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ICON_DEFS } from '../public/icons.js';

const pub = new URL('../public/', import.meta.url);
const sources = readdirSync(pub).filter((f) => f.endsWith('.js') && f !== 'icons.js').map((f) => [f, readFileSync(new URL(f, pub), 'utf8')]);

test('todos los iconos usados en el código existen en icons.js', () => {
  for (const [file, src] of sources) {
    for (const [, name] of src.matchAll(/\bicon\('(\w+)'\)/g)) assert.ok(ICON_DEFS[name], `${file}: falta el icono «${name}»`);
  }
});

test('cada icono usa solo etiquetas SVG conocidas y atributos sin scripts ni eventos', () => {
  for (const [name, els] of Object.entries(ICON_DEFS)) {
    assert.ok(els.length > 0, name);
    for (const [tag, attrs] of els) {
      assert.ok(['path', 'rect', 'circle', 'line', 'polyline', 'ellipse'].includes(tag), `${name}: ${tag}`);
      for (const [k, v] of Object.entries(attrs)) assert.ok(!/^on/i.test(k) && !/script|javascript:/i.test(v), `${name}: ${k}`);
    }
  }
});

test('el aviso de licencias existe, incluye el texto de Lucide y no deja iconos sin citar', () => {
  const notice = readFileSync(new URL('THIRD-PARTY-NOTICES.txt', pub), 'utf8');
  assert.match(notice, /ISC License/);
  assert.match(notice, /Copyright \(c\) 2026 Lucide Icons and Contributors/);
  assert.match(notice, /Copyright \(c\) 2013-present Cole Bemis/);
  assert.match(readFileSync(new URL('index.html', pub), 'utf8') + sources.map(([, s]) => s).join(''), /THIRD-PARTY-NOTICES\.txt/);
});
