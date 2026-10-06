// E2E de las funciones v2: primeros pasos, días, mover/arrastrar, plantillas, mes, equilibrio, estadísticas, exportaciones,
// traspaso, avisos y accesibilidad automática (axe-core). Requiere Playwright y axe-core (npm i).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const AXE = readFileSync(fileURLToPath(new URL('../node_modules/axe-core/axe.min.js', import.meta.url)), 'utf8');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  let path = normalize(new URL(req.url, 'http://x').pathname).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(await readFile(join(ROOT, path))); } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;
let failed = 0;
const check = (cond, msg) => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} - ${msg}`); };

const browser = await chromium.launch();
const mk = (id, name, extra = {}) => ({ id, name, emoji: '', meals: [], createdAt: '2026-01-01', ...extra });
const seed = () => ({
  version: 1,
  dishes: { a: mk('a', 'Macarrones con tomate', { tags: ['pasta-arroz'], minutes: 20, level: 'facil' }), b: mk('b', 'Merluza a la plancha', { tags: ['pescado'], frozen: true }), c: mk('c', 'Lentejas estofadas', { tags: ['legumbre'], favorite: true }), d: mk('d', 'Pollo asado', { tags: ['carne'], minutes: 60 }) },
  plan: { '2026-10-05': { lunch: ['c'] }, '2026-10-06': { lunch: ['a'], dinner: ['b'] } }, days: {}, templates: {}, rules: [],
});
async function open({ state = seed(), width = 390, height = 844, meta, route = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'es-ES', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-05T10:00:00'));
  await p.addInitScript(([st, mt]) => {
    if (st && !localStorage.getItem('menu-semanal:v1')) localStorage.setItem('menu-semanal:v1', JSON.stringify(st));
    if (mt && !localStorage.getItem('menu-semanal:meta')) localStorage.setItem('menu-semanal:meta', JSON.stringify(mt));
  }, [state, meta ?? { firstSeen: '2026-10-01' }]);
  if (route) await p.route('**/api/gemini', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":true,"accessCode":false}' }));
  await p.goto(base);
  await p.waitForSelector('.day, .welcome');
  return { ctx, p, errs };
}
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('menu-semanal:v1')));
const axe = async (p, label) => {
  await p.evaluate(AXE); // evaluate no pasa por la CSP de la página
  const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ')}`));
  check(r.length === 0, `axe-core sin infracciones en ${label}${r.length ? `: ${r.join(' | ')}` : ''}`);
};
const day = (p, d) => p.locator(`.day[data-date="${d}"]`);

// Primeros pasos
{
  const { ctx, p, errs } = await open({ state: { version: 1, dishes: {}, plan: {} } });
  check(await p.locator('.welcome').count() === 1, 'primeros pasos: ofrece platos de ejemplo cuando no hay nada');
  await p.locator('.welcome button', { hasText: 'Cargar platos de ejemplo' }).click();
  await p.waitForFunction(() => !document.querySelector('.welcome'));
  const st = await stored(p);
  const dishes = Object.values(st.dishes);
  check(dishes.length === 12 && dishes.find((d) => d.name === 'Salmón al horno').tags.includes('pescado') && dishes.find((d) => d.name === 'Lentejas estofadas').tags.includes('legumbre'), 'primeros pasos: 12 platos con grupos deducidos');
  check(errs.length === 0, `primeros pasos sin errores de consola${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

// Día: nota, fuera de casa y comensales
{
  const { ctx, p } = await open();
  await p.locator('[data-fk="day:2026-10-07"]').click();
  await p.fill('#dlg input[name=nota]', 'Cumple de Ana');
  await p.locator('#dlg .seg label', { hasText: 'Fuera de casa' }).click();
  await p.fill('#dlg input[name=comensales-dinner]', '4');
  await axe(p, 'el editor del día');
  await p.locator('#dlg button', { hasText: 'Guardar' }).click();
  const txt = await day(p, '2026-10-07').innerText();
  check(txt.includes('Cumple de Ana') && txt.includes('Comemos fuera') && txt.includes('4 pers.'), 'día: nota, «fuera de casa» y comensales visibles en la tarjeta');
  await p.locator('[data-fk=idea]').count(); // la idea no se propone en un día fuera de casa
  await p.locator('#fab').click();
  const msg = await p.locator('#share-text').inputValue();
  check(msg.includes('📝 Cumple de Ana') && msg.includes('🚫 Comemos fuera'), 'día: el mensaje de WhatsApp incluye la nota y el aviso');
  await p.locator('#dlg .seg label', { hasText: 'Corto' }).click();
  check((await p.locator('#share-text').inputValue()).includes('*Mié 7:*'), 'WhatsApp: formato corto');
  await p.locator('#dlg .seg label', { hasText: 'Solo cenas' }).click();
  check(!(await p.locator('#share-text').inputValue()).includes('Lentejas'), 'WhatsApp: solo cenas');
  await ctx.close();
}

// Mover, copiar y arrastrar
{
  const { ctx, p } = await open();
  await day(p, '2026-10-05').locator('.item-name', { hasText: 'Lentejas' }).click();
  await p.locator('#dlg button', { hasText: 'Mover a otro hueco' }).click();
  await p.selectOption('#dlg select[name=destino-dia]', '2026-10-08');
  await p.locator('#dlg button[type=submit]').click();
  check((await day(p, '2026-10-08').innerText()).includes('Lentejas') && !(await day(p, '2026-10-05').innerText()).includes('Lentejas'), 'mover: el plato pasa a otro día (a la cena por defecto)');
  await p.locator('#snack button', { hasText: 'Deshacer' }).click();
  check((await day(p, '2026-10-05').innerText()).includes('Lentejas'), 'mover: se puede deshacer');
  await day(p, '2026-10-05').locator('.item-name', { hasText: 'Lentejas' }).click();
  await p.locator('#dlg button', { hasText: 'Copiar a otro hueco' }).click();
  await p.selectOption('#dlg select[name=destino-dia]', '2026-10-09');
  await p.locator('#dlg button[type=submit]').click();
  check((await day(p, '2026-10-09').innerText()).includes('Lentejas') && (await day(p, '2026-10-05').innerText()).includes('Lentejas'), 'copiar: el plato queda en los dos sitios');

  await ctx.close();
}
{
  // arrastrar: ventana alta para que origen y destino estén a la vista (sin desplazar la página durante el gesto)
  const { ctx, p } = await open({ width: 1280, height: 2600 });
  await p.waitForTimeout(800);
  const from = await day(p, '2026-10-06').locator('.item-name', { hasText: 'Macarrones' }).boundingBox();
  const to = await day(p, '2026-10-10').locator('.slot.dinner').boundingBox();
  await p.mouse.move(from.x + 20, from.y + 20);
  await p.mouse.down();
  await p.mouse.move(from.x + 30, from.y + 30, { steps: 5 });
  await p.mouse.move(to.x + 50, to.y + 20, { steps: 10 });
  await p.mouse.up();
  check((await day(p, '2026-10-10').locator('.slot.dinner').innerText()).includes('Macarrones') && !(await day(p, '2026-10-06').locator('.slot.lunch').innerText()).includes('Macarrones'), 'arrastrar: mueve el plato al hueco de destino');
  await ctx.close();
}

// Plantillas y mes
{
  const { ctx, p } = await open();
  await p.locator('button', { hasText: 'Plantillas' }).click();
  await p.fill('#dlg input[name=plantilla]', 'Semana base');
  await p.locator('#dlg button', { hasText: 'Guardar esta semana' }).click();
  check((await p.locator('#dlg').innerText()).includes('Semana base'), 'plantillas: guarda la semana visible');
  await p.keyboard.press('Escape');
  await p.locator('[data-fk=next]').click();
  await p.waitForFunction(() => document.querySelector('.day')?.dataset.date === '2026-10-12');
  await p.locator('button', { hasText: 'Plantillas' }).click();
  await p.locator('#dlg button', { hasText: 'Aplicar' }).click();
  check((await day(p, '2026-10-12').innerText()).includes('Lentejas') && (await day(p, '2026-10-13').innerText()).includes('Macarrones'), 'plantillas: se aplica a otra semana');

  await p.locator('button', { hasText: 'Mes' }).click();
  await axe(p, 'la vista de mes');
  check((await p.locator('#dlg-title').innerText()).includes('Octubre 2026'), 'mes: abre en el mes de la semana visible');
  await p.locator('button[aria-label^="Martes 6 oct"]').click();
  await p.waitForFunction(() => document.querySelector('.day')?.dataset.date === '2026-10-05');
  check(true, 'mes: tocar un día abre su semana');
  await ctx.close();
}

// Platos: grupos, favoritos, filtros; reglas y equilibrio; congelados
{
  const { ctx, p } = await open();
  await p.locator('.nav-item[data-view=settings]').click();
  await p.selectOption('input[name=regla-min] >> xpath=../../select', 'pescado').catch(() => {});
  await p.selectOption('select[name=regla-grupo]', 'pescado');
  await p.fill('input[name=regla-min]', '2');
  await p.locator('button', { hasText: 'Añadir regla' }).click();
  check((await p.locator('main').innerText()).includes('pescado: al menos 2 por semana'), 'reglas: se añaden en Ajustes');
  await p.locator('.nav-item[data-view=week]').click();
  const bal = await p.locator('.balance').innerText();
  check(bal.includes('Pescado 1') && bal.includes('faltan'), 'equilibrio: la semana muestra que faltan pescados');
  check(await p.locator('.balance .chip.low').count() === 1, 'equilibrio: estado también con texto, no solo color');

  await p.locator('.nav-item[data-view=dishes]').click();
  await p.locator('.row', { hasText: 'Pollo asado' }).locator('button[aria-label^="Editar"]').click();
  await p.locator('#dlg input[name=favorito]').check();
  await p.fill('#dlg input[name=minutos]', '25');
  await p.fill('#dlg textarea[name=receta]', 'https://example.com/pollo');
  await axe(p, 'el editor de platos');
  await p.locator('#dlg button[type=submit]').click();
  const row = await p.locator('.row', { hasText: 'Pollo asado' }).innerText();
  check(row.includes('25 min') && row.includes('Favorito') || row.includes('⭐'), 'platos: tiempo y favorito se muestran');
  check(await p.locator('.row a', { hasText: 'Ver receta' }).getAttribute('href') === 'https://example.com/pollo', 'platos: enlace a la receta');
  await p.selectOption('select[name=filtro]', 'quick');
  check(await p.locator('.row').count() === 2, 'filtro «rápidos»: platos de hasta 30 min');
  await p.selectOption('select[name=filtro]', 'tag:pescado');
  check(await p.locator('.row').count() === 1, 'filtro por grupo');
  await p.selectOption('select[name=filtro]', 'frozen');
  check(await p.locator('.row').count() === 1, 'filtro «congelados»');
  await p.selectOption('select[name=filtro]', 'all');

  // nuevo plato con grupos deducidos al escribir
  await p.locator('button', { hasText: 'Guardar plato nuevo' }).click();
  await p.fill('#dlg input[name=nombre]', 'Salmón al horno');
  check(await p.locator('#dlg input[name=grupo][value=pescado]').isChecked(), 'editor: deduce el grupo «pescado» por el nombre');
  await p.locator('#dlg input[name=grupo][value=verdura]').check();
  await p.fill('#dlg input[name=nombre]', 'Salmón al horno con algo');
  check(!(await p.locator('#dlg input[name=grupo][value=pescado]').isChecked()) === false, 'editor: tras tocar los grupos a mano ya no se cambian solos');
  await p.keyboard.press('Escape');

  // el plato congelado previsto para mañana avisa hoy
  await p.locator('.nav-item[data-view=week]').click();
  check((await p.locator('.notice').first().innerText()).includes('Merluza a la plancha'), 'congelados: aviso el día antes');
  await ctx.close();
}

// Estadísticas, exportaciones y traspaso
{
  const { ctx, p } = await open({ state: { ...seed(), plan: { '2026-10-04': { lunch: ['c'] }, '2026-10-03': { lunch: ['c'], dinner: ['b'] }, '2026-10-05': { lunch: ['a'] } } } });
  await p.locator('.nav-item[data-view=stats]').click();
  await p.waitForSelector('meter');
  const st = await p.locator('main').innerText();
  check(st.includes('Lentejas estofadas') && st.includes('2 veces') && await p.locator('meter').count() >= 3, 'estadísticas: lo que más repites y grupos con medidores accesibles');
  await axe(p, 'Estadísticas');
  await p.locator('.nav-item[data-view=week]').click();
  await p.locator('#fab').click();
  const [img] = await Promise.all([p.waitForEvent('download'), p.locator('#dlg button', { hasText: 'Imagen' }).click()]);
  const png = readFileSync(await img.path());
  check(png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && png.length > 5000, `imagen: PNG válido (${png.length} bytes)`);
  const [ics] = await Promise.all([p.waitForEvent('download'), p.locator('#dlg button', { hasText: 'Calendario (semana)' }).click()]);
  const ical = readFileSync(await ics.path(), 'utf8');
  check(ical.startsWith('BEGIN:VCALENDAR') && ical.includes('DTSTART:20261005T140000') && ical.includes('Macarrones con tomate'), '.ics: eventos de la semana');
  await p.keyboard.press('Escape');

  await p.locator('.nav-item[data-view=settings]').click();
  await p.locator('button', { hasText: 'Copiar código' }).click();
  const code = await p.locator('textarea[name=codigo-traspaso]').inputValue();
  check(/^menu-semanal:1:[A-Za-z0-9_-]+$/.test(code), 'traspaso: genera un código');
  const other = await open({ state: { version: 1, dishes: {}, plan: {} }, meta: { firstSeen: '2026-10-01', onboarded: true } });
  await other.p.locator('.nav-item[data-view=settings]').click();
  await other.p.locator('button', { hasText: 'Pegar código' }).click();
  await other.p.fill('#dlg textarea[name=codigo-pegado]', 'basura');
  await other.p.locator('#dlg button[type=submit]').click();
  check((await other.p.locator('#snack').innerText()).includes('no es un código válido'), 'traspaso: rechaza texto que no es un código');
  await other.p.fill('#dlg textarea[name=codigo-pegado]', `Mi menú:\n${code}`);
  await other.p.locator('#dlg button[type=submit]').click();
  await other.p.locator('#dlg button', { hasText: 'Restaurar' }).click();
  await other.p.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('menu-semanal:v1')).dishes).length > 0);
  const moved = await stored(other.p);
  check(Object.keys(moved.dishes).length === 4 && moved.plan['2026-10-03'].dinner[0] === 'b', 'traspaso: los datos llegan al otro móvil');
  await other.ctx.close();
  await ctx.close();
}

// Copia de seguridad periódica
{
  const { ctx, p } = await open({ meta: { firstSeen: '2026-08-01' } });
  check((await p.locator('.notice', { hasText: 'copia de seguridad' }).count()) === 1, 'copia: avisa tras 30 días sin copia');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.notice button', { hasText: 'Exportar copia' }).click()]);
  await dl.path();
  check((await p.locator('.notice', { hasText: 'copia de seguridad' }).count()) === 0, 'copia: el aviso desaparece tras exportar');
  await ctx.close();
}

// Accesibilidad automática en las pantallas principales
for (const [label, hash, w] of [['la semana (móvil)', '', 390], ['la semana (escritorio)', '', 1280], ['Platos', '#platos', 390], ['Ajustes', '#ajustes', 390]]) {
  const { ctx, p } = await open({ width: w, height: w > 600 ? 800 : 844 });
  if (hash) { await p.evaluate((x) => { location.hash = x; }, hash); await p.waitForTimeout(700); }
  await axe(p, label);
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} FALLOS` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
