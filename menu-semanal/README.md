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
│   ├── index.html, styles.css, app.js, dom.js, icons.js, week-tools.js, extras.js
│   ├── lib.js         (lógica pura: fechas, sugerencias, WhatsApp, validación)
│   ├── sw.js, manifest.webmanifest, _headers, icons/
├── netlify/functions/ (gemini.mjs + lib/gemini-proxy.mjs: proxy que guarda la clave de Gemini)
├── test/              (unitarias con node:test + E2E con Playwright)
├── dist/              (zip generado con `npm run zip`; ignorado por Git)
├── scripts/make-icons.mjs
└── netlify.toml       (publish = "public", functions = "netlify/functions")
```

## Funciones de la 2.0

- **Semana:** detalles por día (nota, «fuera de casa»/festivo, comensales por comida); menú de cada plato con **mover** y **copiar** (y **arrastrar y soltar** con ratón o lápiz; en táctil queda el menú); **plantillas** de semana; vista de **mes**; sugerencias que respetan los días fuera de casa y no repiten lo comido hace menos de 3 días.
- **Platos:** grupos de alimentos (se deducen del nombre y se pueden cambiar), favoritos, tiempo y dificultad, receta (enlace o notas), ingredientes (texto libre), «congelado» (aviso el día antes dentro de la app) y filtros.
- **Equilibrio:** reglas por semana (p. ej. pescado al menos 2) con recuento y estado en la semana; las reglas también viajan en el prompt de las cenas con IA.
- **Datos:** pestaña de estadísticas (lo que más repites, grupos, cobertura, lo que llevas más tiempo sin comer); WhatsApp en cuatro formatos; imagen PNG de la semana; calendario `.ics`; **traspaso a otro móvil** con un código de texto (es una copia puntual, no sincroniza); aviso de copia de seguridad cada 30 días; platos de ejemplo al empezar; aviso «hay una versión nueva».
- **Límites conocidos:** no hay recordatorios con la app cerrada (no hay notificaciones push); el arrastrar no funciona en todos los móviles; el aviso de versión nueva y la precarga de pdf.js sin conexión están implementados pero no los he probado en un dispositivo real; la imagen usa las fuentes y emojis del sistema.
- **Pruebas:** `npm test` (unitarias) y `npm run e2e` (dos scripts: flujos generales y funciones nuevas, esta con axe-core para accesibilidad automática en las pantallas principales).

## Terceros y licencias

Los iconos son de [Lucide](https://lucide.dev) (ISC; algunos derivan de Feather, MIT) y se copian como datos en `public/icons.js`, sin dependencia. Los textos de licencia están en `public/THIRD-PARTY-NOTICES.txt`, enlazado desde Ajustes; `npm test` comprueba que el aviso existe y que todos los iconos usados están definidos. Las ilustraciones de los estados vacíos son propias. pdf.js (Apache-2.0) va en `public/vendor/`.

## Desplegar en Netlify

**Opción A, Netlify Drop (solo sitio estático, sin IA):** genera el zip con `npm run zip` (queda en `dist/menu-semanal-v<versión>.zip`; esa carpeta **no se sube a Git**) y súbelo en Netlify → *Add new site* → *Deploy manually*. **Las funciones no se despliegan así** (no he encontrado documentado que Drop las admita), así que el asistente de IA no funcionará. Todo lo demás sí.

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

## Menús en PDF

En «🥗 Cenas según la guardería» → **📄 Añadir menú en PDF**. Todo el procesamiento es **en el navegador** (sin servidor):

- **Lectura:** [pdf.js](https://github.com/mozilla/pdf.js) 6.3.289 (Apache-2.0, compilación *legacy* para móviles antiguos), copiada en `public/vendor/` y cargada solo al usar un PDF (≈0,5 MB comprimido). Solo PDF de **texto vectorial**; los escaneados no tienen texto (la app lo avisa: súbelos como foto). Límite: 15 MB y 30 páginas.
- **Calendarios en cuadrícula** (semanas en filas, días en columnas, cabeceras «LUNES 5»): se interpretan por columnas y salen como `Lunes 5: primer plato / segundo plato / postre`, sin etiquetas de fila ni pie con datos de contacto. Si el PDF funde celdas y no se puede asignar el texto a un día, se usa el orden de lectura para no perder datos.
- **Fechas:** se deducen del día de la semana + número («Lunes 5», «Martes 6»...), así que un menú de octubre se reparte entre sus semanas aunque estés viendo otra.
- **Carta de restaurante** (sin días ni fechas): propone 3 a 5 combinaciones equilibradas usando platos de la propia carta, y eliges el día al añadirlas.
- **Dos documentos:** el diálogo tiene dos campos, «Menú del mediodía» y «Sugerencias de cena del catering (opcional)», cada uno con su botón de PDF. Un PDF cuyo nombre contenga «cena» o «sugerencia» se enruta solo al segundo campo. Con ambos, cada tarjeta muestra lo que propone el catering con su veredicto (✓ equilibra / ⚠ mejorable), la cena que recomienda la IA y, si encaja, un plato de tu lista de platos guardados (la app solo lo acepta si existe con ese nombre exacto; al usarlo se reutiliza, no se duplica). Tres botones independientes: añadir la recomendación, usar la del catering o usar tu plato.
- El texto extraído se puede **revisar y editar** antes de enviarlo. Se eliminan correos, teléfonos y webs.
- **PDF sin servidor:** se leen en el navegador. La configuración son dos cabeceras en `_headers` (tipo MIME `text/javascript` para los `.mjs` de pdf.js; la CSP ya permitía `worker-src 'self'`). Para actualizar pdf.js, copia `legacy/build/pdf.min.mjs` y `pdf.worker.min.mjs` de `pdfjs-dist` a `public/vendor/` y sube la versión.

## Asistente de IA (Gemini)

- **La clave vive solo en Netlify.** El navegador llama a `/api/gemini` (misma web); la función `netlify/functions/gemini.mjs` añade la clave y reenvía a Google (`POST /v1beta/interactions`). La app no pide ni guarda ninguna clave; si una versión anterior guardó una, se borra del móvil al abrir la app.
- **Despliegue:** debe hacerse **desde Git o con la CLI de Netlify** (no con Drop). *Base directory* `menu-semanal`, *Publish directory* `public`, *Functions directory* `netlify/functions` (ya en `netlify.toml`), sin comando de build.
- **Variables de entorno** (Site configuration → Environment variables): `GEMINI_API_KEY` (obligatoria; también se aceptan `GOOGLE_API_KEY` o `GOOGLE_GENERATIVE_AI_API_KEY`). Si tu plan permite elegir alcance, incluye **Functions**. Tras crearla hay que volver a desplegar. Opcional: `ACCESS_CODE`; si existe, la app pide ese código una vez (se guarda en el móvil) y lo envía en la cabecera `x-access-code`.
- **Protecciones de la función:** solo acepta peticiones del mismo origen, lista blanca estricta del cuerpo (modelo `gemini-*`, texto, hasta 8 partes, imágenes jpeg/png/webp, esquema JSON; sin herramientas ni streaming), máximo 5 MB, tiempo límite de 55 s, errores sin la clave y límite de 12 peticiones/minuto/IP (`config.rateLimit`). *No he podido comprobar en un Netlify real la sintaxis exacta de `rateLimit` para funciones ni los límites del plan (documentados: ~60 s por ejecución y 6 MB por petición); solo hay pruebas unitarias y E2E con la función simulada.*
- **Ajustes** muestra el estado del servidor: función no encontrada, falta la variable, o lista.
- **Lo que se envía a Google:** el menú o la foto, las sugerencias de cena que subas, tus notas, los nombres de las cenas ya planeadas y de tus platos guardados (hasta 80). Según los términos de Google a fecha de hoy, en el nivel gratuito pueden usarlo para mejorar sus productos y revisores humanos podrían leerlo; en el de pago no. No incluyas nombres de niños.
- El modelo por defecto (`gemini-3.8-flash`) es editable en **Ajustes → Modelo avanzado**. Si está saturado (503), la app reintenta y cambia sola a `gemini-3.1-flash-lite`.
- Las respuestas se tratan como texto no confiable: se validan, se recortan y solo se muestran como texto.

## Versiones

La versión vive en `public/version.js` (se muestra en **Ajustes**) y en `package.json`; `npm test` falla si difieren. Para publicar una nueva: súbela en ambos sitios (`1.1.0` → `1.1.1` para arreglos, `1.2.0` para novedades), ejecuta `npm test` y `npm run zip`. El zip resultante se llama `menu-semanal-v<versión>.zip` y sustituye al anterior en `dist/`.

| Versión | Cambios |
|---|---|
| 2.1.0 | Iconos SVG de Lucide en la navegación y los botones (con `THIRD-PARTY-NOTICES.txt`), ilustraciones propias en los estados vacíos, esqueleto de carga para la IA y pulsación más táctil en los botones |
| 2.0.0 | Gran actualización: días con nota/fuera de casa/comensales, mover/copiar/arrastrar, plantillas, vista de mes, grupos de alimentos y reglas de equilibrio, favoritos/tiempo/receta/ingredientes/congelados con filtros, estadísticas, formatos de WhatsApp, imagen y `.ics`, traspaso por código, avisos (copia, congelados, versión nueva), platos de ejemplo, pdf.js precargado, pruebas con axe-core |
| 1.7.1 | Revisión: la entrada animada ya no se repite al añadir o quitar platos; `theme_color` del manifiesto alineado con el fondo; texto de «Borrar todo» sin referencias a la clave |
| 1.7.0 | Acabado visual: luz cálida y viñeta, título con degradado, tarjetas con relieve y entrada escalonada, ingredientes con movimiento sutil, navegación de cristal esmerilado (todo respeta reduced-motion y alto contraste) |
| 1.6.0 | La clave de Gemini ya no se introduce en la app: vive como variable de entorno en Netlify y las peticiones pasan por una Netlify Function (`/api/gemini`) con código de acceso opcional; CSP sin dominios externos |
| 1.5.0 | Dos documentos: menú del mediodía + sugerencias de cena del catering; la IA los **contrasta** día a día (¿equilibra el mediodía?) y propone platos de **tu base de datos** de platos guardados (solo con nombre exacto) |
| 1.4.0 | Lee **PDF de texto** (calendario mensual de la guardería o carta de restaurante) en el navegador con pdf.js y propone cenas por fechas; reintentos y cambio automático de modelo si Gemini está saturado; regla anti-atragantamiento en el prompt |
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
