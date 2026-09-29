// Genera los PNG de los iconos a partir de public/icons/icon.svg (usa Playwright + Chromium).
// Uso: node scripts/make-icons.mjs   (requiere `playwright` disponible)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const out = new URL('../public/icons/', import.meta.url);
const targets = [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]];

const browser = await chromium.launch();
for (const [file, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: new URL(file, out).pathname });
  await page.close();
}
await browser.close();
