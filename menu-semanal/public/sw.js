// Service worker: la app funciona sin conexión.
// Estrategia: red primero (con 4 s de margen) y, si falla, la copia en caché.
// Así los cambios publicados llegan solos y no hay que subir versiones a mano.

const CACHE = 'menu-semanal-v1';
const CORE = ['./', 'index.html', 'styles.css', 'app.js', 'lib.js', 'ai.js', 'version.js', 'manifest.webmanifest', 'icons/icon.svg'];
const OPTIONAL = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' })));
    await Promise.allSettled(OPTIONAL.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
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
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
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
