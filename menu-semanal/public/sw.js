// Service worker: la app funciona sin conexión.
// Estrategia: red primero (con 4 s de margen) y, si falla, la copia en caché.
// Así los cambios publicados llegan solos y no hay que subir versiones a mano.

const CACHE = 'menu-semanal-v1';
const CORE = ['./', 'index.html', 'styles.css', 'app.js', 'lib.js', 'ai.js', 'menu-pdf.js', 'dom.js', 'week-tools.js', 'extras.js', 'version.js', 'manifest.webmanifest', 'icons/icon.svg'];
const OPTIONAL = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
// pdf.js (1,8 MB): para leer PDF sin conexión. No se precarga si el usuario ahorra datos.
const PDF_JS = ['vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' })));
    const optional = self.navigator?.connection?.saveData ? OPTIONAL : [...OPTIONAL, ...PDF_JS];
    await Promise.allSettled(optional.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('menu-semanal-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return; // la IA nunca se cachea
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetchWithTimeout(request, 4000);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const hit = (await cache.match(request, { ignoreSearch: true }))
      ?? (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    return hit ?? Response.error();
  }
}

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}
