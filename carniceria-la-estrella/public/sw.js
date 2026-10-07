// Service worker de Carnicería La Estrella — estrategia network-first con
// fallback a caché. Prototipo sencillo: no pretende ser una PWA
// offline-first completa.

const CACHE_NAME = "la-estrella-v25";
const PRECACHE_URLS = [
  "/",
  "/tienda",
  "/privacidad.html",
  "/aviso-legal.html",
  "/404.html",
  "/offline.html",
  "/qr.html",
  "/manifest.webmanifest",
  "/assets/app.js",
  "/assets/qr.js",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/photos/fachada.jpg",
  "/assets/photos/corte-parrilla-4x3.jpg",
  "/assets/photos/vacuno.jpg",
  "/assets/photos/cerdo.jpg",
  "/assets/photos/cerdo-iberico.jpg",
  "/assets/photos/pollo.jpg",
  "/assets/photos/embutidos.jpg",
  "/assets/photos/elaborados.jpg",
  "/assets/photos/casqueria.jpg",
  "/assets/photos/huevos.jpg",
  "/assets/photos/pavo.jpg",
  "/assets/photos/conejo.jpg",
  "/assets/photos/caza.jpg",
  "/assets/photos/jamones.jpg",
  "/assets/photos/quesos.jpg",
  "/assets/photos/vacuno-400.jpg",
  "/assets/photos/cerdo-400.jpg",
  "/assets/photos/cerdo-iberico-400.jpg",
  "/assets/photos/pollo-400.jpg",
  "/assets/photos/pavo-400.jpg",
  "/assets/photos/conejo-400.jpg",
  "/assets/photos/caza-400.jpg",
  "/assets/photos/casqueria-400.jpg",
  "/assets/photos/jamones-400.jpg",
  "/assets/photos/embutidos-400.jpg",
  "/assets/photos/quesos-400.jpg",
  "/assets/photos/elaborados-400.jpg",
  "/assets/photos/huevos-400.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }
  // La API y el panel nunca se guardan en la caché del navegador (llevan datos de pedidos y de acceso).
  // Única excepción: el catálogo público (productos y precios, sin datos personales), para poder ver la tienda sin conexión.
  const ruta = new URL(request.url).pathname;
  if ((ruta.startsWith("/api/") && ruta !== "/api/catalogo") || ruta.startsWith("/admin")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          // La página exacta que se pidió ya estaba guardada (visita
          // anterior a esa misma URL): se sirve tal cual, sin más.
          if (cached) return cached;
          // Una navegación a una página que nunca se llegó a guardar
          // (por ejemplo, la primera visita offline a una URL nueva): en
          // vez de servir la home fingiendo que está actualizada, se
          // muestra un aviso claro de que no hay conexión.
          if (request.mode === "navigate") return caches.match("/offline.html");
          return undefined;
        })
      )
  );
});
