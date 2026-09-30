// Prueba de extremo a extremo en Chromium. Requiere Playwright (npm i -D playwright).
// Uso: node test/e2e.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { VERSION } from '../public/version.js';

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  let path = normalize(new URL(req.url, 'http://x').pathname).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try {
    const file = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(file);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

let failed = 0;
const check = (cond, msg) => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} - ${msg}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

const day = (i) => page.locator('.day').nth(i);
const addDish = async (i, meal, name) => {
  const slot = day(i).locator(`.slot.${meal}`);
  await (await slot.locator('.slot-empty').count() ? slot.locator('.slot-empty') : slot.locator('.icon-btn')).click();
  await page.fill('#dlg input[type=text]', name);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
};

await page.goto(base);
await page.waitForSelector('.day');
check(await page.locator('.day').count() === 7, '7 tarjetas de día');
check(await page.locator('.day.today').count() === 1, 'hoy resaltado');

await addDish(0, 'lunch', 'macarrones con tomate');
check((await day(0).locator('.slot.lunch .item').innerText()).includes('Macarrones con tomate'), 'plato añadido (mayúscula + emoji)');
await addDish(0, 'dinner', 'tortilla');
await addDish(0, 'dinner', 'ensalada');
check(await day(0).locator('.slot.dinner .item').count() === 2, 'varios platos en una comida');

await day(1).locator('.slot.lunch .slot-empty').click();
await page.locator('#dlg .seg label', { hasText: 'Cena' }).click();
await page.fill('#dlg input[type=text]', 'sopa de pescado');
await page.keyboard.press('Enter');
await page.waitForFunction(() => !document.querySelector('dialog[open]'));
check(await day(1).locator('.slot.dinner .item').count() === 1 && await day(1).locator('.slot.lunch .item').count() === 0, 'elegir cena en la hoja');

await page.reload();
await page.waitForSelector('.day');
check(await page.locator('.item').count() === 4, 'los datos persisten tras recargar');

await page.locator('.item .x').first().click();
check(await page.locator('.item').count() === 3, 'quitar plato');
await page.locator('#snack button').click();
check(await page.locator('.item').count() === 4, 'deshacer');

await addDish(2, 'lunch', '<img src=x onerror=window.__xss=1>');
check(await page.evaluate(() => window.__xss) === undefined, 'nombres con HTML no se ejecutan');

// Sugerencia: un plato comido hace ~6 semanas
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('menu-semanal:v1'));
  const d = new Date(); d.setDate(d.getDate() - 40);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  s.dishes.lent = { id: 'lent', name: 'Lentejas', emoji: '', meals: [], createdAt: '2026-01-01' };
  s.plan[iso] = { lunch: ['lent'] };
  localStorage.setItem('menu-semanal:v1', JSON.stringify(s));
});
await page.reload();
await page.waitForSelector('.day');
const idea = await page.locator('.idea').innerText();
check(idea.includes('Lentejas') && idea.includes('semanas'), 'sugiere lo que hace tiempo que no se come');
await page.locator('.idea .btn').first().click();
check(await page.locator('.item', { hasText: 'Lentejas' }).count() === 1, 'añadir la sugerencia');

// Semanas
const range = await page.locator('.range strong').innerText();
await page.locator('[data-fk=next]').click();
await page.waitForFunction((r) => document.querySelector('.range strong').innerText !== r, range);
check(await page.locator('.range span').innerText() === 'Próxima semana', 'semana siguiente');
await page.locator('[data-fk=prev]').click();
await page.waitForFunction((r) => document.querySelector('.range strong').innerText === r, range);
check(true, 'semana anterior');

// WhatsApp
await page.locator('#fab').click();
await page.waitForSelector('dialog[open] textarea');
const text = await page.locator('#share-text').inputValue();
check(text.startsWith('🍽️ *Menú de la semana*') && text.includes('☀️ *Almuerzo:*') && text.includes('🌙 *Cena:*'), 'mensaje de WhatsApp con formato');
const href = await page.locator('#dlg a.btn').getAttribute('href');
check(href === `https://wa.me/?text=${encodeURIComponent(text)}`, 'enlace wa.me');
await page.locator('#dlg .btn', { hasText: 'Copiar' }).click();
check(await page.evaluate(() => navigator.clipboard.readText()) === text, 'copiar al portapapeles');
await page.keyboard.press('Escape');

// Platos y ajustes
await page.locator('.nav-item[data-view=dishes]').click();
await page.locator('.row', { hasText: 'Lentejas' }).locator('[aria-label^=Eliminar]').click();
await page.locator('#dlg button[value=ok]').click();
await page.waitForFunction(() => ![...document.querySelectorAll('.row')].some((r) => r.textContent.includes('Lentejas')));
check(true, 'eliminar plato con confirmación');
await page.locator('.nav-item[data-view=settings]').click();
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('button', { hasText: 'Exportar copia' }).click()]);
check(download.suggestedFilename().startsWith('menu-semanal-'), 'exportar copia');

// Rutas por hash, botón atrás y atajos de la PWA
check(await page.evaluate(() => location.hash) === '#ajustes', 'la navegación actualiza la URL');
await page.goBack();
await page.waitForSelector('.row');
check(await page.locator('.nav-item[aria-current=page]').getAttribute('data-view') === 'dishes', 'botón atrás vuelve a Platos');
await page.goto(`${base}#platos`);
check(await page.locator('.nav-item[aria-current=page]').getAttribute('data-view') === 'dishes', 'enlace directo #platos');
await page.goto(`${base}?action=share`);
await page.waitForSelector('dialog[open] textarea');
check(true, 'atajo ?action=share abre WhatsApp');
check(await page.evaluate(() => location.search) === '', 'el atajo limpia la URL');
await page.keyboard.press('Escape');
check(await page.locator('main h1, header h1').count() === 1 && await page.locator('.day h2').count() === 7, 'jerarquía h1 → h2');

// Offline
await page.locator('.nav-item[data-view=week]').click();
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(800);
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.day');
check(await page.locator('.item').count() >= 3, 'funciona sin conexión');

// Regresiones de la auditoría responsive (fecha fija: martes 29 sep 2026)
{
  const mk = (id, name, meals = []) => ({ id, name, emoji: '', meals, createdAt: '2026-01-01' });
  const seed = {
    version: 1,
    dishes: { a: mk('a', 'Macarrones'), e: mk('e', 'Lentejas'), f: mk('f', 'Supercalifragilisticoespialidosoextraordinariamentelargo') },
    plan: { '2026-09-28': { lunch: ['a'], dinner: ['a'] }, '2026-09-29': { lunch: ['f'], dinner: ['f'] }, '2026-08-01': { lunch: ['e'] } },
  };
  const open = async (w, h, opts = {}) => {
    const c = await browser.newContext({ viewport: { width: w, height: h }, locale: 'es-ES', ...opts });
    const p = await c.newPage();
    await p.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
    await p.addInitScript((s) => localStorage.setItem('menu-semanal:v1', JSON.stringify(s)), seed);
    await p.goto(base);
    await p.waitForSelector('.day');
    await p.waitForTimeout(600);
    return [c, p];
  };
  const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  for (const w of [320, 375, 768, 1024]) {
    const [c, p] = await open(w, 800);
    check(await noHScroll(p), `palabra larga sin scroll horizontal a ${w}px`);
    await c.close();
  }
  {
    const [c, p] = await open(1024, 768);
    await p.locator('.day').nth(2).locator('.slot.lunch .slot-empty').click();
    await p.waitForSelector('dialog[open]', { timeout: 3000 }).then(() => check(true, 'con palabra larga, el botón vecino sigue abriendo la hoja'), () => check(false, 'con palabra larga, el botón vecino sigue abriendo la hoja'));
    await c.close();
  }
  {
    const [c, p] = await open(320, 640);
    const idea = await p.evaluate(() => { const b = document.querySelector('.idea .btn'); return b.textContent + '|' + (b.getBoundingClientRect().right <= b.closest('.idea').getBoundingClientRect().right); });
    check(idea.endsWith('true'), `botón de idea cabe a 320px (${idea.split('|')[0]})`);
    await p.keyboard.press('Tab');
    check(await p.evaluate(() => document.activeElement.classList.contains('skip')), 'primer Tab va al enlace «Saltar al contenido»');
    check((await p.locator('.slot-empty').first().getAttribute('aria-label')).includes('a la cena') || !(await p.locator('[aria-label*="al cena"]').count()), 'aria-labels con «a la cena»');
    check(await p.locator('[aria-label*="al cena"]').count() === 0, 'sin «al cena» en la interfaz');
    await c.close();
  }
  {
    const [c, p] = await open(667, 375);
    const fits = await p.evaluate(() => document.querySelector('.navbar').getBoundingClientRect().height <= 64);
    check(fits, 'landscape móvil: navegación compacta');
    await c.close();
  }
  {
    const [c, p] = await open(375, 667);
    await p.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await p.waitForTimeout(200);
    check(await p.evaluate(() => { const n = document.querySelector('.navbar'); return n.scrollHeight <= n.clientHeight + 1; }), 'texto al 200%: etiquetas de navegación sin recortar');
    await c.close();
  }
  {
    const [c, p] = await open(390, 844, { forcedColors: 'active' });
    await p.locator('.day').first().locator('.slot.lunch .slot-empty, .slot.lunch .icon-btn').first().click();
    const marked = await p.evaluate(() => getComputedStyle(document.querySelector('.seg input:checked + span'), '::before').content);
    check(marked.includes('✓'), 'forced-colors: el segmento activo lleva ✓');
    await c.close();
  }
  {
    const [c, p] = await open(1280, 720);
    const geo = await p.evaluate(() => { const n = document.querySelector('.navbar').getBoundingClientRect(); return { left: n.left, w: Math.round(n.width), h: Math.round(n.height), vh: innerHeight, dayLeft: document.querySelector('.day').getBoundingClientRect().left }; });
    check(geo.left === 0 && geo.w <= 100 && geo.h === geo.vh, 'escritorio: navegación en barra lateral');
    check(geo.dayLeft >= geo.w, 'escritorio: el contenido no queda bajo la barra lateral');
    check(await noHScroll(p), 'escritorio: sin scroll horizontal');
    await c.close();
  }
  await page.locator('.nav-item[data-view=settings]').click();
  check((await page.locator('.version').innerText()).includes(`versión ${VERSION}`), `Ajustes muestra la versión ${VERSION}`);
  await page.locator('.seg label', { hasText: 'Oscuro' }).click();
  check(await page.evaluate(() => [...document.querySelectorAll('meta[name=theme-color]')].every((m) => m.content === '#1A110D')), 'theme-color sigue al tema oscuro elegido');
  await page.locator('.seg label', { hasText: 'Automático' }).click();
  await page.locator('.nav-item[data-view=week]').click();
}

check(errors.length === 0, `sin errores de consola${errors.length ? `: ${errors.join(' | ')}` : ''}`);

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
