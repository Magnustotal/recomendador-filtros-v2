# 🍽️ Menú semanal

PWA sencilla para planificar el menú de la semana: almuerzo y cena por día, platos guardados para repetir, sugerencias de lo que hace tiempo que no comes y un mensaje de WhatsApp listo para enviar.

- **Sin servidor, sin cuenta, sin dependencias, sin build.** HTML + CSS + JS (módulos ES).
- **Los datos se guardan en el móvil** (`localStorage`). Nada sale del dispositivo.
- **Funciona sin conexión** (service worker) y es instalable.
- Diseño Material 3 Expressive hecho a mano: colores con `light-dark()` (claro/oscuro automático), formas grandes, movimiento con muelle, View Transitions al cambiar de semana. Respeta `prefers-reduced-motion`.

## Qué hace

| | |
|---|---|
| **Semana** | 7 días (lunes a domingo), cada uno con **Almuerzo** y **Cena**; varios platos por comida. Navega entre semanas, «Ir a hoy» y «Repetir semana anterior» (solo rellena huecos). Quitar tiene «Deshacer». |
| **Memoria de platos** | Todo lo que escribes queda guardado y se ofrece al añadir de nuevo (con búsqueda). Pestaña **Platos** para editar, borrar y ordenar por «hace tiempo», A–Z o más usados. |
| **Sugerencias** | Tarjeta verde: el plato que más tiempo lleva sin aparecer (≥ 14 días, o guardado y nunca planificado) para el primer hueco libre desde hoy. La hoja de «Añadir plato» también propone «Hace tiempo que no los comes». No sugiere lo ya planificado en los próximos 7 días. |
| **WhatsApp** | Botón «Enviar por WhatsApp»: mensaje con emojis, un bloque por día, almuerzo y cena diferenciados. Editable antes de enviar; abre `wa.me`, copia o usa el menú «Compartir» del sistema. |
| **Ajustes** | Exportar/importar copia en JSON, tema claro/oscuro, instalar, borrar todo. |

Ejemplo de mensaje:

```
🍽️ *Menú de la semana*
🗓️ 28 sep – 4 oct

📅 *Lunes 28 sep*
☀️ *Almuerzo:* 🍝 Macarrones con tomate
🌙 *Cena:* 🍳 Tortilla + 🥗 Ensalada

📅 *Martes 29 sep*
☀️ *Almuerzo:* 🍲 Lentejas

¡Buen provecho! 😋
```

El emoji de cada plato se deduce del nombre (pasta 🍝, pollo 🍗, ensalada 🥗…) y se puede cambiar al editar el plato.

## Estructura

```
menu-semanal/
├── public/            ← lo único que se publica
│   ├── index.html, styles.css, app.js
│   ├── lib.js         (lógica pura: fechas, sugerencias, WhatsApp, validación)
│   ├── sw.js, manifest.webmanifest, _headers, icons/
├── test/              (unitarias con node:test + E2E con Playwright)
├── scripts/make-icons.mjs
└── netlify.toml       (publish = "public")
```

## Desplegar en Netlify

**Opción A, Netlify Drop (la más rápida, también desde el móvil):** descarga `dist/menu-semanal-netlify.zip` y súbelo en Netlify → *Add new site* → *Deploy manually* (o arrástralo). Si cambias algo en `public/`, regenera el zip con `npm run zip`. También vale arrastrar la carpeta `public/`.

**Opción B, desde Git:** *Add new site* → *Import from Git*, y en la configuración:

- **Base directory:** `menu-semanal`
- **Build command:** *(vacío)*
- **Publish directory:** `public`

`_headers` añade una CSP estricta y otras cabeceras de seguridad, y evita cachear `sw.js` e `index.html`.

## Desarrollo

```bash
npm test                      # pruebas unitarias (Node ≥ 20, sin dependencias)
npx --yes serve public        # servir en local (http://localhost:3000)
npm install && npm run e2e    # prueba E2E en Chromium (instala Playwright)
node scripts/make-icons.mjs   # regenerar los PNG desde icons/icon.svg
```

## Notas

- **Actualizaciones:** el service worker usa «red primero» (4 s) y cae a la caché sin conexión, así que los cambios publicados llegan solos. Si añades archivos nuevos a `public/`, agrégalos a la lista `CORE` de `sw.js` para que estén disponibles offline.
- **Datos y navegador:** al vivir en `localStorage`, se pierden si se borran los datos del sitio o se desinstala la app; algunos navegadores (Safari en iOS, por ejemplo) pueden limpiar datos de sitios poco usados. La app pide almacenamiento persistente al guardar, pero conviene hacer una copia desde *Ajustes* de vez en cuando. Los datos no se comparten entre dispositivos.
- **iPhone/iPad:** para instalarla, Compartir → «Añadir a pantalla de inicio».
