// Prueba de extremo a extremo en Chromium. Requiere Playwright (npm i -D playwright).
// Uso: node test/e2e.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { VERSION } from '../public/version.js';

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

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
await page.route('**/api/gemini', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, accessCode: false }) }));

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
  check(await page.locator('.seg', { hasText: 'Oscuro' }).count() === 0, 'Ajustes ya no ofrece tema oscuro');
  {
    // Aunque el sistema esté en oscuro, la app sigue clara
    const [c, p] = await open(390, 844, { colorScheme: 'dark' });
    const look = await p.evaluate(() => ({ scheme: getComputedStyle(document.documentElement).colorScheme, bg: getComputedStyle(document.body).backgroundColor, field: (() => { const i = document.createElement('input'); document.body.append(i); const bgc = getComputedStyle(i).backgroundColor; i.remove(); return bgc; })() }));
    check(look.scheme === 'light' && look.bg === 'rgb(255, 248, 245)', `sistema en oscuro → la app sigue clara (${look.bg})`);
    const kitchen = await p.evaluate(() => ({ stripe: getComputedStyle(document.querySelector('.day'), '::before').content, gingham: getComputedStyle(document.body).backgroundImage.includes('linear-gradient'), garnish: !!document.querySelector('.garnish[aria-hidden=true]') }));
    check(kitchen.stripe !== 'none' && kitchen.gingham && kitchen.garnish, 'motivos de cocina presentes (vichy, tira de paño, verduras)');
    await c.close();
  }
  await page.locator('.nav-item[data-view=week]').click();
}

// Cabecera centrada y decoración de lado a lado; asistente de cenas con Gemini simulado
{
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const mk = (id, name, meals = []) => ({ id, name, emoji: '', meals, createdAt: '2026-01-01' });
  const seed = { version: 1, dishes: { a: mk('a', 'Macarrones') }, plan: { '2026-09-28': { lunch: ['a'] } } };
  const gemini = { requests: [], mode: 'ok', accessCode: false };
  const reply = (text) => ({ id: 'v1_t', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text }] }] });
  const SUGGESTIONS = { days: [
    { date: '2026-09-29', daycare: 'Lentejas con arroz', dinner: 'Pescado blanco a la plancha con verduras', reason: 'Tras legumbres, proteína ligera y verdura.' },
    { date: '2026-09-30', daycare: 'Pollo con patatas', dinner: 'Carne de cerdo con puré de patata', reason: 'Cambia de proteína respecto al pollo.' },
  ] };
  const aiErrors = [];
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', acceptDownloads: true });
  const p = await c.newPage();
  p.on('console', (m) => m.type() === 'error' && aiErrors.push(m.text()));
  p.on('pageerror', (e) => aiErrors.push(e.message));
  await p.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  await p.addInitScript((st) => { if (!localStorage.getItem('menu-semanal:v1')) localStorage.setItem('menu-semanal:v1', JSON.stringify(st)); }, seed);
  await p.route('**/api/gemini', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, accessCode: gemini.accessCode }) });
    gemini.requests.push({ url: req.url(), headers: req.headers(), body: req.postDataJSON() });
    if (gemini.mode === '403') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream', message: 'API key not valid' } }) });
    if (gemini.accessCode && req.headers()['x-access-code'] !== 'familia') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: gemini.accessCode && !req.headers()['x-access-code'] ? 'code_required' : 'bad_code', message: 'x' } }) });
    const isTest = JSON.stringify(req.postDataJSON().input).includes('Responde solo con la palabra OK');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply(isTest ? 'OK' : JSON.stringify(SUGGESTIONS))) });
  });
  await p.goto(base);
  await p.waitForSelector('.day');

  // cabecera
  const head = await p.evaluate(() => {
    const h1 = document.querySelector('#title'); const range = document.createRange(); range.selectNodeContents(h1);
    const t = range.getBoundingClientRect();
    const spans = [...document.querySelectorAll('.garnish span')];
    const line = document.querySelector('.garnish').getBoundingClientRect();
    const vis = spans.filter((el) => { const r = el.getBoundingClientRect(); return r.top >= line.top - 6 && r.bottom <= line.bottom + 6; });
    return { center: (t.left + t.right) / 2, vw: document.documentElement.clientWidth, align: getComputedStyle(h1).textAlign, total: spans.length, visible: vis.length, distinct: new Set(vis.map((e) => e.textContent)).size, first: vis[0].getBoundingClientRect().left, last: vis.at(-1).getBoundingClientRect().right };
  });
  check(Math.abs(head.center - head.vw / 2) <= 2 && head.align === 'center', `título centrado en pantalla (${Math.round(head.center)} de ${head.vw / 2})`);
  check(head.total >= 20 && head.distinct === head.visible && head.visible >= 9, `decoración variada: ${head.visible} ingredientes distintos visibles de ${head.total}`);
  check(head.first <= 22 && head.last >= head.vw - 22, `decoración de lado a lado (${Math.round(head.first)}→${Math.round(head.last)} de ${head.vw})`);

  {
    const d = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES' });
    const dp = await d.newPage();
    await dp.goto(base);
    await dp.waitForSelector('.day');
    const wide = await dp.evaluate(() => {
      const line = document.querySelector('.garnish').getBoundingClientRect();
      const vis = [...document.querySelectorAll('.garnish span')].filter((el) => { const r = el.getBoundingClientRect(); return r.top >= line.top - 6 && r.bottom <= line.bottom + 6; });
      return { box: [line.left, line.right], first: vis[0].getBoundingClientRect().left, last: vis.at(-1).getBoundingClientRect().right, n: vis.length };
    });
    check(wide.n === 24 && wide.first - wide.box[0] < 2 && wide.box[1] - wide.last < 2, `escritorio: los 24 ingredientes ocupan todo el ancho (${wide.n})`);
    await d.close();
  }

  // sin clave en la app: se abre directamente el formulario (la clave vive en Netlify)
  await p.locator('[data-fk=balance]').click();
  await p.waitForSelector('#dlg textarea[name=menu-guarderia]');
  check(!(await p.locator('#dlg').innerText()).includes('Conecta Gemini') && await p.locator('#dlg input[type=password]').count() === 0, 'sin pedir ninguna clave: el asistente abre el formulario del menú');

  // vacío → aviso; con menú + foto → petición correcta
  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  check((await p.locator('#dlg .ai-status').innerText()).includes('Pega el menú'), 'pide menú o foto si está vacío');
  await p.fill('#dlg textarea[name=menu-guarderia]', 'lunes: lentejas con arroz\nmartes: pollo con patatas');
  await p.fill('#dlg input[name=notas]', 'sin frutos secos');
  await p.setInputFiles('#dlg input[accept="image/*"]', { name: 'menu.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForSelector('#dlg .item');
  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  await p.waitForSelector('#dlg .ai-card');
  const req = gemini.requests.at(-1);
  check(new URL(req.url).pathname === '/api/gemini' && !req.headers['x-goog-api-key'] && !JSON.stringify(req.body).includes('AIza') && !req.headers['x-access-code'], 'petición al servidor propio /api/gemini, sin clave en el navegador');
  check(req.body.input[0].text.includes('lunes: lentejas con arroz') && req.body.input[0].text.includes('sin frutos secos') && req.body.input[0].text.includes('martes 29 sep'), 'el prompt lleva menú, notas y fechas de la semana');
  check(req.body.input[1]?.type === 'image' && req.body.input[1].mime_type === 'image/jpeg' && req.body.input[1].data.length > 20, 'la foto viaja como imagen JPEG base64');
  check(req.body.response_format?.mime_type === 'application/json', 'pide salida JSON estructurada');
  check(await p.locator('#dlg .ai-card').count() === 2, 'muestra una tarjeta por día sugerido');

  // añadir / quitar / añadir todas
  const dinner = (date) => p.locator(`.day[data-date="${date}"] .slot.dinner`).innerText();
  await p.locator('#dlg .ai-card').first().locator('button').click();
  check((await dinner('2026-09-29')).includes('Pescado blanco a la plancha con verduras'), 'añadir sugerencia a la cena del día correcto');
  await p.locator('#dlg .ai-card').first().locator('button').click();
  check(!(await dinner('2026-09-29')).includes('Pescado blanco'), 'volver a pulsar la quita');
  await p.locator('#dlg button', { hasText: 'Añadir todas' }).click();
  check((await dinner('2026-09-29')).includes('Pescado blanco') && (await dinner('2026-09-30')).includes('Carne de cerdo con puré de patata'), '«Añadir todas» rellena las cenas');
  await p.keyboard.press('Escape');

  // errores: 403 → mensaje claro
  gemini.mode = '403';
  await p.locator('[data-fk=balance]').click();
  await p.fill('#dlg textarea[name=menu-guarderia]', 'lunes: lentejas');
  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  await p.waitForFunction(() => document.querySelector('#dlg .ai-status.error'));
  check((await p.locator('#dlg .ai-status').innerText()).includes('GEMINI_API_KEY'), 'error 403 explicado en español (apunta a la variable de Netlify)');
  await p.keyboard.press('Escape');
  gemini.mode = 'ok';

  // código de acceso: el servidor lo pide → diálogo, se guarda en el móvil y se reintenta
  gemini.accessCode = true;
  await p.locator('[data-fk=balance]').click();
  await p.fill('#dlg textarea[name=menu-guarderia]', 'lunes: lentejas');
  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  await p.waitForSelector('#dlg input[name=codigo-acceso]');
  check(true, 'si el servidor pide código de acceso, la app lo solicita');
  await p.fill('#dlg input[name=codigo-acceso]', 'familia');
  await p.locator('#dlg button', { hasText: 'Guardar código' }).click();
  await p.waitForSelector('#dlg textarea[name=menu-guarderia]');
  await p.fill('#dlg textarea[name=menu-guarderia]', 'lunes: lentejas');
  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  await p.waitForSelector('#dlg .ai-card');
  check(gemini.requests.at(-1).headers['x-access-code'] === 'familia', 'con el código guardado la petición lo envía en la cabecera');
  await p.keyboard.press('Escape');

  // Ajustes: estado del servidor, probar conexión, copia sin secretos, sin clave
  await p.locator('.nav-item[data-view=settings]').click();
  await p.waitForSelector('.ai-key');
  check((await p.locator('main').innerText()).includes('Servidor listo') && await p.locator('main input[name=gemini-key]').count() === 0, 'Ajustes muestra el estado del servidor y ya no pide clave');
  await p.locator('button', { hasText: 'Probar conexión' }).click();
  await p.waitForFunction(() => [...document.querySelectorAll('.ai-status')].some((e) => e.textContent.includes('Conexión correcta')));
  check(true, '«Probar conexión» confirma que funciona');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('button', { hasText: 'Exportar copia' }).click()]);
  const exported = (await import('node:fs')).readFileSync(await dl.path(), 'utf8');
  check(!exported.includes('AIza') && !exported.includes('gemini') && !exported.includes('familia'), 'la copia de seguridad no incluye claves ni códigos');
  const unexpected = aiErrors.filter((e) => !e.includes('status of 403') && !e.includes('status of 401')); // 403 y 401: errores simulados a propósito
  check(unexpected.length === 0, `asistente sin errores de consola ni bloqueos de CSP${unexpected.length ? ': ' + unexpected.join(' | ') : ''}`);
  await c.close();
}

// PDF de texto vectorial: calendario mensual (varias semanas) y carta de restaurante
{
  const cells = (label, arr) => `<tr><td>${label}</td>${arr.map((x) => `<td>${x}</td>`).join('')}</tr>`;
  const week = (n, days, first, second) => `<tr><td>${n}º SEMANA</td>${days.map((d) => `<th>${d}</th>`).join('')}</tr>${cells('1ºPLATO', first)}${cells('2ºPLATO', second)}`;
  const calendarHtml = `<html><body style="font-family:sans-serif;font-size:8px"><style>td,th{white-space:nowrap}</style><h1>MENÚ DE OCTUBRE</h1><table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;text-align:center">`
    + week(2, ['LUNES 5', 'MARTES 6', 'MIÉRCOLES 7', 'JUEVES 8', 'VIERNES 9'], ['PATATAS GUISADAS CON CHOCOS', 'POTAJE DE GARBANZOS', 'ESPIRALES A LA BOLOÑESA', 'ALUBIAS ESTOFADAS CON VERDURAS', 'CREMA DE CALABAZA'], ['LOMO ADOBADO AL HORNO', 'JAMONCITOS DE POLLO EN SALSA', 'TORTILLA FRANCESA', 'MERLUZA EN SALSA', 'HAMBURGUESA DE POLLO'])
    + week(3, ['LUNES 12', 'MARTES 13', 'MIÉRCOLES 14', 'JUEVES 15', 'VIERNES 16'], ['FESTIVO', 'LENTEJAS ESTOFADAS', 'MACARRONES CON TOMATE', 'PUCHERO CON ARROZ', 'CREMA DE CALABACÍN'], ['', 'TORTILLA DE PATATAS', 'JAMONCITOS DE POLLO AL HORNO', 'BACALAO AL HORNO', 'ALBÓNDIGAS DE MERLUZA EN SALSA'])
    + `</table><p>Razón social: Catering Pérez. Tlf: 664700725 e-mail: contacto@catering.example</p></body></html>`;
  const cartaHtml = '<html><body style="font-family:sans-serif"><h1>Carta del restaurante</h1><h2>Entrantes</h2><p>Ensalada mixta 7 €</p><p>Croquetas caseras 9 €</p><h2>Principales</h2><p>Lubina a la plancha 18 €</p><p>Entrecot de ternera 21 €</p><h2>Postres</h2><p>Fruta de temporada 5 €</p></body></html>';
  const pdf = async (html) => { const pg = await browser.newPage(); await pg.setContent(html); const buf = await pg.pdf({ format: 'A4', landscape: true }); await pg.close(); return buf; };
  const [calendarPdf, cartaPdf, blankPdf] = [await pdf(calendarHtml), await pdf(cartaHtml), await pdf('<div style="width:80px;height:80px;background:red"></div>')];

  const calls = [];
  const errs = [];
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' });
  const p = await c.newPage();
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  await p.route('**/api/gemini', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, accessCode: false }) });
    const body = req.postDataJSON();
    calls.push(body);
    const isCarta = Boolean(body.response_format?.schema?.properties?.combos);
    const payload = isCarta
      ? { combos: [{ title: 'Ligera de pescado', items: ['Lubina a la plancha', 'Ensalada mixta'], reason: 'Proteína magra y verdura.' }, { title: 'Sin invención', items: ['Fruta de temporada'], reason: 'Postre ligero.' }] }
      : { days: [
        { date: '2026-10-05', daycare: 'Patatas con chocos', dinner: 'Pescado blanco a la plancha con verduras', reason: 'Compensa lomo y guiso.' },
        { date: '2026-10-06', daycare: 'Potaje', dinner: 'Tortilla con ensalada', reason: 'Huevo tras legumbres.' },
        { date: '2026-10-13', daycare: 'Lentejas', dinner: 'Merluza al horno con verduras', reason: 'Pescado tras legumbres.' },
        { date: '2026-11-30', daycare: 'inventado', dinner: 'No debe aparecer', reason: 'fuera del menú' },
      ] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(payload) }] }] }) });
  });
  await p.goto(base);
  await p.waitForSelector('.day');
  const upload = (name, buffer) => p.setInputFiles('#dlg input[data-role=lunch]', { name, mimeType: 'application/pdf', buffer });
  const dinnerText = (date) => p.locator(`.day[data-date="${date}"] .slot.dinner`).innerText();

  // calendario mensual
  await p.locator('[data-fk=balance]').click();
  await upload('menu-octubre.pdf', calendarPdf);
  await p.waitForFunction(() => document.querySelector('#dlg textarea[name=menu-guarderia]').value.includes('Lunes 5:'), null, { timeout: 15000 });
  const text = await p.locator('#dlg textarea[name=menu-guarderia]').inputValue();
  check(text.includes('Lunes 5: Patatas guisadas con chocos / Lomo adobado al horno') && text.includes('Lunes 12: Festivo') && text.includes('Viernes 16: Crema de calabacín'), 'PDF: calendario leído por columnas y en minúsculas legibles');
  check(!text.includes('contacto@') && !text.includes('664700725') && !/PLATO|SEMANA/i.test(text), 'PDF: sin datos de contacto ni etiquetas de fila');
  const st = await p.locator('#dlg .ai-status').innerText();
  check(st.includes('PDF leído') && st.includes('5 oct') && st.includes('16 oct') && st.includes('10 días'), `PDF: detecta el rango de fechas (${st.slice(0, 70)}…)`);
  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  await p.waitForSelector('#dlg .ai-card');
  const req = calls.at(-1);
  check(req.input[0].text.includes('(2026-10-16)') && req.input[0].text.includes('(2026-10-05)') && !req.input[0].text.includes('(2026-09-28)'), 'PDF: el prompt usa las fechas del menú, no solo la semana visible');
  check(req.input[0].text.includes('Lunes 5: Patatas guisadas con chocos') && !req.input[0].text.includes('contacto@'), 'PDF: el texto enviado es el extraído y limpio');
  check(await p.locator('#dlg .ai-card').count() === 3 && !(await p.locator('#dlg').innerText()).includes('No debe aparecer'), 'PDF: descarta fechas que no pidió');
  await p.locator('#dlg button', { hasText: 'Añadir todas' }).click();
  await p.keyboard.press('Escape');
  await p.locator('[data-fk=next]').click();
  await p.waitForFunction(() => document.querySelector('.day')?.dataset.date === '2026-10-05');
  check((await dinnerText('2026-10-05')).includes('Pescado blanco a la plancha con verduras') && (await dinnerText('2026-10-06')).includes('Tortilla con ensalada'), 'PDF: «Añadir todas» rellena las cenas de octubre');
  await p.locator('[data-fk=next]').click();
  await p.waitForFunction(() => document.querySelector('.day')?.dataset.date === '2026-10-12');
  check((await dinnerText('2026-10-13')).includes('Merluza al horno con verduras'), 'PDF: también la segunda semana');

  // carta de restaurante (sin fechas ni días)
  await p.locator('[data-fk=balance]').click();
  await upload('carta.pdf', cartaPdf);
  await p.waitForFunction(() => document.querySelector('#dlg textarea[name=menu-guarderia]').value.includes('Lubina'), null, { timeout: 15000 });
  check((await p.locator('#dlg .ai-status').innerText()).includes('carta'), 'carta: se reconoce como carta de restaurante');
  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  await p.waitForSelector('#dlg select');
  check(Boolean(calls.at(-1).response_format.schema.properties.combos) && calls.at(-1).input[0].text.includes('Entrecot de ternera'), 'carta: usa el prompt y el esquema de carta con el texto del PDF');
  await p.locator('#dlg select').first().selectOption('2026-10-14');
  await p.locator('#dlg .ai-card').first().locator('button').click();
  await p.keyboard.press('Escape');
  check((await dinnerText('2026-10-14')).includes('Lubina a la plancha + Ensalada mixta'), 'carta: añade la combinación al día elegido');

  // PDF sin texto → mensaje claro
  await p.locator('[data-fk=balance]').click();
  await upload('escaneado.pdf', blankPdf);
  await p.waitForFunction(() => document.querySelector('#dlg .ai-status.error'), null, { timeout: 15000 });
  check((await p.locator('#dlg .ai-status').innerText()).includes('no tiene texto'), 'PDF sin texto: explica que debe subirlo como foto');
  await p.keyboard.press('Escape');
  check(errs.length === 0, `PDF sin errores de consola ni bloqueos de CSP${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await c.close();
}

// Dos documentos: menú del mediodía + sugerencias de cena del catering, contrastados con los platos guardados
{
  const grid = (rows) => `<html><body style="font-family:sans-serif;font-size:8px"><style>td,th{white-space:nowrap}</style><table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;text-align:center"><tr><td>2º SEMANA</td>${['LUNES 5', 'MARTES 6', 'MIÉRCOLES 7'].map((d) => `<th>${d}</th>`).join('')}</tr>${rows.map((r, i) => `<tr><td>${i + 1}ºPLATO</td>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
  const pdf = async (html) => { const pg = await browser.newPage(); await pg.setContent(html); const buf = await pg.pdf({ format: 'A4', landscape: true }); await pg.close(); return buf; };
  const lunchPdf = await pdf(grid([['PATATAS GUISADAS CON CHOCOS', 'POTAJE DE GARBANZOS', 'ESPIRALES A LA BOLOÑESA'], ['LOMO ADOBADO AL HORNO', 'JAMONCITOS DE POLLO EN SALSA', 'TORTILLA FRANCESA']]));
  const dinnerPdf = await pdf(grid([['CREMA DE PUERRO', 'VERDURITAS REHOGADAS', 'SOPA DE VERDURAS'], ['MERO AL HORNO', 'MERLUZA A LA PLANCHA', 'PAVO AL HORNO']]));
  const seed = { version: 1, dishes: { m: { id: 'm', name: 'Merluza a la plancha', emoji: '', meals: ['dinner'], createdAt: '2026-01-01' }, t: { id: 't', name: 'Tortilla de patatas', emoji: '', meals: ['lunch'], createdAt: '2026-01-01' } }, plan: {} };
  const calls = [];
  const errs = [];
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' });
  const p = await c.newPage();
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  await p.addInitScript(([st]) => { if (!localStorage.getItem('menu-semanal:v1')) localStorage.setItem('menu-semanal:v1', JSON.stringify(st)); }, [seed]);
  await p.route('**/api/gemini', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, accessCode: false }) });
    calls.push(req.postDataJSON());
    const payload = { days: [
      { date: '2026-10-05', daycare: 'Patatas con chocos y lomo', dinner: 'Pescado blanco a la plancha con verduras', reason: 'Tras guiso y cerdo, pescado ligero.', catering: 'Crema de puerro + Mero al horno', catering_fit: 'bien', saved_dish: 'merluza a la PLANCHA' },
      { date: '2026-10-06', daycare: 'Potaje y pollo', dinner: 'Tortilla con ensalada', reason: 'Huevo tras legumbres.', catering: 'Verduritas rehogadas + Merluza a la plancha', catering_fit: 'mejorable', saved_dish: 'Plato que no existe' },
    ] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(payload) }] }] }) });
  });
  await p.goto(base);
  await p.waitForSelector('.day');
  await p.locator('[data-fk=balance]').click();

  // solo sugerencias, sin menú del mediodía → pide el menú
  await p.setInputFiles('#dlg input[data-role=dinner]', { name: 'doc.pdf', mimeType: 'application/pdf', buffer: dinnerPdf });
  await p.waitForFunction(() => document.querySelector('#dlg textarea[name=sugerencias-cena]').value.includes('Lunes 5:'), null, { timeout: 15000 });
  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  check((await p.locator('#dlg .ai-status').innerText()).includes('menú del mediodía'), 'dos PDF: sin menú del mediodía no se puede contrastar, y lo explica');

  // el PDF «sugerencias_de_cena» subido por el botón del mediodía va solo al campo de cena
  await p.fill('#dlg textarea[name=sugerencias-cena]', '');
  await p.setInputFiles('#dlg input[data-role=lunch]', { name: 'menu-octubre.pdf', mimeType: 'application/pdf', buffer: lunchPdf });
  await p.waitForFunction(() => document.querySelector('#dlg textarea[name=menu-guarderia]').value.includes('Lunes 5:'), null, { timeout: 15000 });
  await p.setInputFiles('#dlg input[data-role=lunch]', { name: 'sugerencias_de_cena_octubre.pdf', mimeType: 'application/pdf', buffer: dinnerPdf });
  await p.waitForFunction(() => document.querySelector('#dlg textarea[name=sugerencias-cena]').value.includes('Lunes 5:'), null, { timeout: 15000 });
  const lunchTxt = await p.locator('#dlg textarea[name=menu-guarderia]').inputValue();
  const dinnerTxt = await p.locator('#dlg textarea[name=sugerencias-cena]').inputValue();
  check(lunchTxt.includes('Patatas guisadas con chocos') && !lunchTxt.includes('Crema de puerro'), 'dos PDF: el menú del mediodía queda en su campo');
  check(dinnerTxt.includes('Lunes 5: Crema de puerro / Mero al horno') && (await p.locator('#dlg .ai-status').innerText()).includes('sugerencias de cena'), 'dos PDF: «sugerencias_de_cena…» se enruta solo a su campo y lo indica');

  await p.locator('#dlg button', { hasText: 'Sugerir cenas' }).click();
  await p.waitForSelector('#dlg .ai-card');
  const prompt = calls.at(-1).input[0].text;
  check(prompt.includes('Menú de la guardería (mediodía):') && prompt.includes('Sugerencias de cena del catering:') && prompt.includes('Crema de puerro / Mero al horno'), 'dos PDF: el prompt lleva ambos documentos etiquetados');
  check(prompt.includes('Platos guardados por la familia') && prompt.includes('Merluza a la plancha') && prompt.includes('Tortilla de patatas'), 'dos PDF: el prompt incluye los platos guardados de la base de datos');
  const card = p.locator('#dlg .ai-card').first();
  const cardTxt = await card.innerText();
  check(cardTxt.includes('Catering propone: Crema de puerro + Mero al horno') && cardTxt.includes('Equilibra el mediodía'), 'contraste: muestra lo que propone el catering y si equilibra');
  check((await p.locator('#dlg .ai-card').nth(1).innerText()).includes('Mejorable'), 'contraste: marca como mejorable cuando no equilibra');
  check(await card.locator('button', { hasText: 'Usar «Merluza a la plancha»' }).count() === 1 && await p.locator('#dlg .ai-card').nth(1).locator('button', { hasText: 'Usar «' }).count() === 0, 'plato guardado: solo se ofrece si existe de verdad en tu lista (con el nombre exacto)');

  // usar el plato guardado no lo duplica; usar el del catering añade su nombre
  await card.locator('button', { hasText: 'Usar «Merluza a la plancha»' }).click();
  await card.locator('button', { hasText: 'Usar la del catering' }).click();
  await p.keyboard.press('Escape');
  await p.locator('[data-fk=next]').click();
  await p.waitForFunction(() => document.querySelector('.day')?.dataset.date === '2026-10-05');
  const dinner = await p.locator('.day[data-date="2026-10-05"] .slot.dinner').innerText();
  check(dinner.includes('Merluza a la plancha') && dinner.includes('Crema de puerro + Mero al horno'), 'se añaden a la cena tanto el plato guardado como la propuesta del catering');
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('menu-semanal:v1')));
  check(Object.values(st.dishes).filter((d) => d.name === 'Merluza a la plancha').length === 1, 'el plato guardado se reutiliza: no se duplica en la base de datos');
  check(errs.length === 0, `dos PDF sin errores de consola${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await c.close();
}

// Clave heredada de versiones anteriores: se borra del móvil; función ausente: mensaje claro
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' });
  const p = await c.newPage();
  await p.addInitScript(() => { if (!localStorage.getItem('menu-semanal:ai')) localStorage.setItem('menu-semanal:ai', JSON.stringify({ key: 'AIza' + 'q'.repeat(35), model: 'gemini-3.1-flash-lite' })); });
  await p.route('**/api/gemini', (route) => route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>Not found</h1>' }));
  await p.goto(base);
  await p.waitForSelector('.day');
  await p.locator('.nav-item[data-view=settings]').click();
  await p.waitForFunction(() => document.querySelector('main')?.textContent.includes('No encuentro el servidor de IA'));
  const stored = await p.evaluate(() => localStorage.getItem('menu-semanal:ai') ?? '');
  check(!stored.includes('AIza') && stored.includes('gemini-3.1-flash-lite'), 'la clave guardada por versiones anteriores se elimina del móvil y se conservan las preferencias');
  check(true, 'sin función desplegada, Ajustes lo explica');
  await c.close();
}

check(errors.length === 0, `sin errores de consola${errors.length ? `: ${errors.join(' | ')}` : ''}`);

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
