// Genera public/splash/*.png (pantallas de arranque de iOS, claras y oscuras) y
// reescribe los <link rel="apple-touch-startup-image"> de index.html entre los marcadores.
// Uso: node scripts/make-splash.mjs   (requiere Playwright + Chromium)
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pub = new URL('../public/', import.meta.url);
const icon = await readFile(new URL('icons/icon.svg', pub), 'utf8');
await mkdir(new URL('splash/', pub), { recursive: true });

// [ancho CSS, alto CSS, ratio de píxeles] de iPhone en vertical
const DEVICES = [[430, 932, 3], [393, 852, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2], [414, 736, 3]];
const THEMES = { light: '#FFF8F5', dark: '#1A110D' };

const browser = await chromium.launch();
const links = [];
for (const [w, h, r] of DEVICES) {
  for (const [theme, bg] of Object.entries(THEMES)) {
    const file = `splash/${theme}-${w * r}x${h * r}.png`;
    const size = Math.round(Math.min(w, h) * 0.28);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
    await page.setContent(`<body style="margin:0;background:${bg};display:grid;place-items:center;height:100vh"><div style="width:${size}px;height:${size}px;border-radius:22%;overflow:hidden">${icon.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
    await page.screenshot({ path: fileURLToPath(new URL(file, pub)) });
    await page.close();
    links.push(`  <link rel="apple-touch-startup-image" href="${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${theme})">`);
  }
}
await browser.close();

const htmlUrl = new URL('index.html', pub);
const html = await readFile(htmlUrl, 'utf8');
const block = `  <!-- splash:start (generado por scripts/make-splash.mjs) -->\n${links.join('\n')}\n  <!-- splash:end -->`;
const next = /  <!-- splash:start[\s\S]*?<!-- splash:end -->/.test(html)
  ? html.replace(/  <!-- splash:start[\s\S]*?<!-- splash:end -->/, block)
  : html.replace('  <link rel="stylesheet" href="styles.css">', `${block}\n  <link rel="stylesheet" href="styles.css">`);
await writeFile(htmlUrl, next);
console.log(`${links.length} pantallas de arranque`);
