// Genera public/screenshots/*.png con datos de ejemplo (usa Playwright + Chromium).
// Uso: node scripts/make-screenshots.mjs
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const OUT = join(ROOT, 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
await mkdir(OUT, { recursive: true });

const server = createServer(async (req, res) => {
  let p = new URL(req.url, 'http://x').pathname;
  if (p.endsWith('/')) p += 'index.html';
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' }).end(await readFile(join(ROOT, p))); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, r));

const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const mon = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
const at = (i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dish = (id, name, meals) => ({ id, name, emoji: '', meals, createdAt: '2026-01-01' });
const state = {
  version: 1,
  dishes: { a: dish('a', 'Macarrones con tomate', ['lunch']), b: dish('b', 'Tortilla de patatas', ['dinner']), c: dish('c', 'Ensalada', ['lunch', 'dinner']), d: dish('d', 'Pollo asado', ['lunch']), e: dish('e', 'Lentejas', ['lunch']), f: dish('f', 'Crema de calabacín', ['dinner']), g: dish('g', 'Merluza al horno', ['dinner']), h: dish('h', 'Paella', ['lunch']) },
  plan: {
    [at(0)]: { lunch: ['a'], dinner: ['b', 'c'] }, [at(1)]: { lunch: ['d'], dinner: ['f'] }, [at(2)]: { lunch: ['h'], dinner: ['g'] },
    [at(3)]: { lunch: ['a', 'c'], dinner: ['b'] }, [at(4)]: { lunch: ['d'] }, [at(5)]: { lunch: ['h'], dinner: ['f'] },
    [iso(-70)]: { lunch: ['e'] },
  },
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-ES' })).newPage();
await page.addInitScript((s) => localStorage.setItem('menu-semanal:v1', JSON.stringify(s)), state);
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForSelector('.day');
await page.waitForTimeout(900);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: join(OUT, 'semana.png') });
await page.locator('#fab').click();
await page.waitForSelector('dialog[open] textarea');
await page.waitForTimeout(900);
await page.screenshot({ path: join(OUT, 'whatsapp.png') });
await browser.close();
server.close();
