# 🍽️ Menú semanal

PWA sencilla para planificar el menú de la semana: almuerzo y cena por día, platos guardados para repetir, sugerencias de lo que hace tiempo que no comes y un mensaje de WhatsApp listo para enviar.

- **Sin servidor, sin cuenta, sin dependencias, sin build.** HTML + CSS + JS (módulos ES).
- **Los datos se guardan en el móvil** (`localStorage`). Nada sale del dispositivo.
- **Funciona sin conexión** (service worker) y es instalable.
- Diseño Material 3 Expressive hecho a mano, **solo modo claro** (también si el sistema está en oscuro) y con motivos de cocina: mantel de cuadros vichy, tira de paño de cocina en cada día, tipografía de carta y verduras de adorno. Formas grandes, movimiento con muelle y View Transitions. Respeta `prefers-reduced-motion`.

## Qué hace

| | |
|---|---|
| **Semana** | 7 días (lunes a domingo), cada uno con **Almuerzo** y **Cena**; varios platos por comida. Navega entre semanas, «Ir a hoy» y «Repetir semana anterior» (solo rellena huecos). Quitar tiene «Deshacer». |
| **Memoria de platos** | Todo lo que escribes queda guardado y se ofrece al añadir de nuevo (con búsqueda). Pestaña **Platos** para editar, borrar y ordenar por «hace tiempo», A–Z o más usados. |
| **Sugerencias** | Tarjeta verde: el plato que más tiempo lleva sin aparecer (≥ 14 días, o guardado y nunca planificado) para el primer hueco libre desde hoy. La hoja de «Añadir plato» también propone «Hace tiempo que no los comes». No sugiere lo ya planificado en los próximos 7 días. |
| **WhatsApp** | Botón «Enviar por WhatsApp»: mensaje con emojis, un bloque por día, almuerzo y cena diferenciados. Editable antes de enviar; abre `wa.me`, copia o usa el menú «Compartir» del sistema. |
| **Cenas según la guardería** | Botón «🥗 Cenas según la guardería» en la semana: pegas el menú (o subes hasta 3 fotos) y **Gemini** propone una cena **genérica** por día para equilibrar (p. ej. «Pescado blanco a la plancha con verduras»). Cada una se añade a la cena de su día con un toque. Ver «Asistente de IA» más abajo. |
| **Ajustes** | Exportar/importar copia en JSON, instalar, borrar todo. |

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
├── dist/              (zip generado con `npm run zip`; ignorado por Git)
├── scripts/make-icons.mjs
└── netlify.toml       (publish = "public")
```

## Desplegar en Netlify

**Opción A, Netlify Drop (la más rápida):** genera el zip con `npm run zip` (queda en `dist/menu-semanal-v<versión>.zip`; esa carpeta **no se sube a Git**) y súbelo en Netlify → *Add new site* → *Deploy manually*. También vale arrastrar la carpeta `public/`.

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
node scripts/make-screenshots.mjs   # regenerar las capturas del manifest
node scripts/make-splash.mjs  # regenerar las pantallas de arranque de iOS
npm run zip                   # regenerar dist/menu-semanal-v<versión>.zip
```

## Asistente de IA (Gemini)

- Usa **tu propia clave** de Google AI Studio (https://aistudio.google.com/apikey), que se guarda solo en el móvil (`localStorage`) y **no** entra en las copias de seguridad. La app sigue siendo estática: no hay servidor propio.
- La llamada va directa del móvil a `generativelanguage.googleapis.com` (`POST /v1beta/interactions`, cabecera `x-goog-api-key`); la CSP solo permite ese dominio.
- **Lo que se envía a Google:** el menú o la foto, tus notas y los nombres de las cenas ya planeadas de esa semana. Según los términos de Google a fecha de hoy, en el nivel gratuito pueden usarlo para mejorar sus productos y revisores humanos podrían leerlo; en el de pago no. No incluyas nombres de niños.
- Google desaconseja claves en el navegador porque cualquiera con acceso al navegador podría extraerla. Para un uso personal: crea una clave solo para esta app, **restríngela a la dirección web de tu sitio** y pon alertas de facturación. (No he podido comprobar de extremo a extremo la restricción por dirección: la petición envía el origen como referente para permitirla.)
- El modelo por defecto (`gemini-3.8-flash`) sale de la documentación de Google y es editable en **Ajustes → Modelo avanzado**; **Probar conexión** valida clave y modelo.
- Las respuestas se tratan como texto no confiable: se validan, se recortan y solo se muestran como texto.

## Versiones

La versión vive en `public/version.js` (se muestra en **Ajustes**) y en `package.json`; `npm test` falla si difieren. Para publicar una nueva: súbela en ambos sitios (`1.1.0` → `1.1.1` para arreglos, `1.2.0` para novedades), ejecuta `npm test` y `npm run zip`. El zip resultante se llama `menu-semanal-v<versión>.zip` y sustituye al anterior en `dist/`.

| Versión | Cambios |
|---|---|
| 1.3.0 | Título centrado y más ingredientes de lado a lado; asistente de cenas con Gemini (menú de la guardería en texto o foto) |
| 1.2.1 | El resaltado de «hoy» se ve sobre la tira de paño; README aclara que el zip se genera, no se versiona |
| 1.2.0 | Solo modo claro (sin tema oscuro) y estilo de cocina |
| 1.1.0 | Auditoría responsive/PWA: palabras largas sin desbordes, alto contraste, landscape, safe areas, texto grande, barra lateral en escritorio, pantallas de arranque iOS, rutas por hash |
| 1.0.0 | Primera versión |

## Notas

- **Enlaces:** `#platos` y `#ajustes` abren esas pantallas (el botón atrás funciona). Atajos de la app instalada: «Enviar menú por WhatsApp» (`?action=share`) y «Mis platos».
- **Seguridad:** CSP estricta (sin scripts ni estilos inline) tanto en `_headers` como en una `<meta>` de respaldo, HSTS y `nosniff`. Los nombres de platos se insertan siempre como texto, nunca como HTML, y las copias importadas se validan.

- **Actualizaciones:** el service worker usa «red primero» (4 s) y cae a la caché sin conexión, así que los cambios publicados llegan solos. Si añades archivos nuevos a `public/`, agrégalos a la lista `CORE` de `sw.js` para que estén disponibles offline.
- **Datos y navegador:** al vivir en `localStorage`, se pierden si se borran los datos del sitio o se desinstala la app; algunos navegadores (Safari en iOS, por ejemplo) pueden limpiar datos de sitios poco usados. La app pide almacenamiento persistente al guardar, pero conviene hacer una copia desde *Ajustes* de vez en cuando. Los datos no se comparten entre dispositivos.
- **iPhone/iPad:** para instalarla, Compartir → «Añadir a pantalla de inicio».
