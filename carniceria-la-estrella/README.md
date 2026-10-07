# Carnicería La Estrella — web y tienda online (v5.1.0)

Web del negocio (portada, aviso legal, privacidad) **más una tienda online con panel de administración**:
el cliente elige productos (casi todo al peso, de 250 en 250 g), indica si recoge o quiere reparto, día y franja,
y el pedido **queda guardado con un número** (`LE-2610-0001`) y se envía por **WhatsApp**. No hay pasarela de pago:
se paga al recoger o al recibir (efectivo, tarjeta solo en recogida, Bizum o transferencia).

El carnicero gestiona todo desde `/admin/` con una sola contraseña: datos del negocio, horario, SEO, productos,
precios (con redondeo ,90 / ,95 en el precio por kilo), agotados, fotos, reparto y recogida, y los pedidos recibidos.

> **Importante:** esta versión usa **Netlify Functions y Netlify Blobs**. **No se puede publicar arrastrando la carpeta**
> a Netlify (esa vía solo sube archivos estáticos y las funciones no funcionarían). Hay que publicar con la línea de
> comandos de Netlify o desde un repositorio de GitHub. Ver [Desplegar](#desplegar).

## Qué incluye

| Parte | Dónde |
|---|---|
| Portada, aviso legal, política de privacidad (se generan con los datos del panel) | `templates/` → función `pagina` |
| Tienda `/tienda` | `templates/tienda.html`, `public/assets/tienda.{js,css}` |
| API pública (catálogo, fotos, pedidos) | `netlify/functions/{catalogo,pedido}.mjs`, `lib/api-publica.mjs` |
| Panel `/admin/` y su API | `public/admin/`, `netlify/functions/admin.mjs`, `lib/api-admin.mjs` |
| Datos por defecto (negocio, 225 productos sin precio, 18 categorías) | `data/` |
| Servidor local de pruebas (sin Netlify) | `scripts/dev-local.mjs` |
| Pruebas (unitarias + navegador) | `tests/` |

## Cómo funciona (resumen técnico)

- **Páginas generadas al vuelo.** La portada, `/tienda`, el aviso legal y la privacidad se rellenan en cada petición a partir
  de las plantillas y de los ajustes guardados (nombre, dirección, teléfono, horario, mapa, SEO, JSON-LD, preguntas
  frecuentes). Al guardar en el panel se **purga la caché del CDN** (etiquetas `paginas` y `catalogo`), así que el cambio se
  ve en segundos. No hace falta volver a publicar.
- **El servidor manda.** El navegador solo envía qué quiere el cliente (ids, opción, cantidad). Precios, totales, envío,
  disponibilidad, día y franja se calculan y validan en el servidor (`lib/pedido.mjs`). Dinero en céntimos, cantidades en
  gramos o unidades.
- **Almacén:** Netlify Blobs (`config`, `pedidos`, `fotos`, `seguridad`). Los pedidos **no se borran solos**.
- **Panel:** contraseña única (`ADMIN_PASSWORD`), sesión en cookie firmada (`HttpOnly`, `SameSite=Strict`, `Secure`, 8 h),
  comparación en tiempo constante, bloqueo de 15 min tras 5 fallos por IP, defensa CSRF (mismo origen + cabecera propia),
  todo el texto de pedidos se muestra como texto (nunca como HTML).
- **Seguridad de cabeceras:** CSP sin `unsafe-inline` para scripts (los scripts en línea se autorizan por huella SHA-256),
  HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Desplegar

### 1. Variables de entorno (una sola vez)

En Netlify: *Site configuration → Environment variables*:

| Variable | Qué es | Requisito |
|---|---|---|
| `ADMIN_PASSWORD` | Contraseña del panel | 10 caracteres o más |
| `SESSION_SECRET` | Cadena aleatoria para firmar la sesión | 32 caracteres o más (p. ej. `openssl rand -hex 32`) |

Sin ellas el panel responde con un aviso de que no está configurado (la tienda pública sigue funcionando).
Hay un ejemplo en `.env.example`. No subas contraseñas al repositorio.

### 2. Publicar

**Opción A — línea de comandos** (desde esta carpeta):

```bash
npm install
npx netlify login
npx netlify link          # o: npx netlify init  (la primera vez)
npx netlify deploy --prod
```

`netlify.toml` ya indica la carpeta pública (`public`), las funciones (`netlify/functions`) y el comando de
construcción (`node scripts/empaquetar.mjs`, que regenera las plantillas y datos embebidos).

**Opción B — GitHub:** sube esta carpeta a un repositorio y conéctalo en Netlify (*Add new site → Import from Git*).
Cada `git push` publica.

### 3. Comprobar que funciona (hazlo siempre tras publicar)

1. Entra en `/admin/` con la contraseña → pestaña **Estado** → **Hacer la comprobación del servidor**. Debe decir
   *correcta* en: configuración, guardado de datos, **números de pedido únicos** y ediciones a la vez. Si «números de pedido
   únicos» dice FALLA, **no abras la tienda** y avisa a quien mantiene la web (ver «Sin verificar en Netlify real»).
2. Abre `/`, `/tienda`, `/admin/`, `/sitemap.xml` y `/robots.txt`; y una ruta inexistente (debe dar 404).
3. `/test.html` ejecuta 17 comprobaciones desde el navegador (incluye catálogo y funciones).
4. Haz un **pedido de prueba** con la tienda abierta, comprueba que aparece en el panel y bórralo.

### 4. Antes de abrir la tienda a clientes

La pestaña **Estado → Antes de abrir la tienda** lista lo pendiente. Imprescindible revisar:

- **Datos de ejemplo** que he puesto yo y que **no son del negocio**: franjas horarias de recogida (09–11, 11–13, 13–15,
  17:30–19:30) y de reparto (10–13, 18–20:30), días de servicio (lunes a sábado), antelación de 2 h, 14 días de margen.
- **Reparto:** zona, pedido mínimo, coste y «gratis desde». Están vacíos.
- **Precios:** los 225 productos están **sin precio** a propósito (se verán como «Consultar»). Los precios los pone el negocio.
- **Razón social y NIF** (aparecen en aviso legal y privacidad; mientras falten se muestran marcados «a completar»).
- **Bizum** (número) y **transferencia** (IBAN): solo se muestran al cliente en el mensaje de confirmación por WhatsApp,
  que escribe el negocio.
- **Dirección de la web** (`seo.dominio`): para el mapa del sitio y los datos estructurados.
- **Activar la tienda** (pestaña Tienda → «Tienda abierta»). Mientras esté cerrada, los botones de pedir llevan a WhatsApp.

## Revisión legal (no es asesoramiento jurídico)

Los textos de `Aviso legal` y `Privacidad` son un **borrador razonable** generado a partir de cómo funciona la web
(`lib/legal.mjs`). Antes de abrir la tienda conviene que los revise una gestoría o un abogado. Puntos concretos que
recomiendo comprobar (no estoy seguro de que cubran todo lo exigible):

- **Datos personales de pedidos** (nombre, teléfono, dirección): base legal, plazo de conservación (ahora «mientras sean
  necesarios y los plazos legales»; los pedidos no se borran solos, pero se pueden borrar en el panel y exportar en CSV),
  encargados (Netlify, WhatsApp/Meta, Google Maps).
- **Venta a distancia:** información previa y desistimiento. El texto afirma que no aplica el desistimiento a alimentos
  frescos y productos a medida (art. 103 del texto refundido de la Ley General para la Defensa de los Consumidores y
  Usuarios); conviene confirmarlo.
- **Precios con impuestos incluidos** (el texto lo afirma).
- **Venta de vino por internet:** casilla de mayor de 18 años y verificación en la entrega; comprobar requisitos de la
  licencia y de la normativa autonómica.
- **Alérgenos:** el catálogo inicial los trae vacíos; en elaborados (hamburguesas, San Jacobos, flamenquines…) hay que
  rellenarlos antes de dar el pedido por bueno, o remitir al cliente a preguntar.
- **Hojas de reclamaciones y datos registrales:** no están en la web; no sé si el negocio los necesita añadir.

## Guía rápida del panel

Ver `GUIA-CARNICERO.md` (explicada sin términos técnicos).

## Desarrollo y pruebas

```bash
npm install
npm test                        # 100+ pruebas: unitarias, de API y de navegador (Chromium)
node scripts/dev-local.mjs      # web + funciones + almacén en http://127.0.0.1:8888 (panel: /admin/)
npx netlify dev                 # alternativa más fiel a Netlify
node scripts/empaquetar.mjs     # regenera lib/*.generado.mjs y public/assets/compartido/*
node scripts/empaquetar.mjs --comprobar   # verifica que lo generado está al día (lo hace también `npm test`)
```

Las pruebas de navegador usan Chromium de Playwright (`CHROME_PATH=/ruta/chrome` si no está en la ruta por defecto).
Si cambias `data/*.json`, `templates/*`, `lib/dinero.mjs` o `lib/horario.mjs`, ejecuta `empaquetar` (el *build* de Netlify
lo hace solo, pero conviene dejar el repositorio al día).

### Qué cubren las pruebas

- Dinero y redondeo, validaciones, horario, ajustes, productos, pedidos (servidor autoritativo), autenticación.
- Almacén con el servidor de Blobs real **y** con almacenes simulados atómicos (números de pedido bajo concurrencia).
- API del panel y pública (CSRF, sesión, 401/403/400, CSV seguro, fotos solo imagen real y ≤ 700 KB).
- Navegador: flujo completo de pedido (recogida y reparto), vino con +18, errores accesibles, scroll horizontal a
  320/390/768/1280 px, objetivos táctiles, panel completo (pedidos, productos con foto pesada, ajustes, negocio →
  regeneración de la portada), XSS almacenado en pedidos.
- Medición (Lighthouse en local, móvil simulado, solo orientativa): `/tienda` 99 rendimiento, 100 accesibilidad,
  100 buenas prácticas, 100 SEO; portada 94 / 100 / 100 / 100.

## Sin verificar en Netlify real

Lo he probado con el servidor de Blobs de `@netlify/blobs`, con `netlify dev` y con un servidor local propio, **no en un
sitio publicado**. Quedan por confirmar al desplegar:

1. **Escritura exclusiva de Blobs (`onlyIfNew`) y ETag.** Los números de pedido únicos y las ediciones simultáneas
   dependen de ello. En el servidor local de Blobs **no** se cumple (con 6 pedidos simultáneos hubo números repetidos);
   en Netlify debería cumplirse, pero no lo he podido comprobar. Lo comprueba el botón de la pestaña **Estado**.
2. **`rateLimit` de las funciones** (8 pedidos/min por IP; 120/min en el panel): no se aplica en local.
3. **Purga de caché** (`purgeCache` por etiquetas) al guardar en el panel: en local se omite.
4. **Orden de resolución** entre archivos, funciones y la regla `/* → /404.html`: en `netlify dev` fue el esperado
   (`/`, `/tienda` y `/privacidad.html` los sirve la función; lo demás, `public/`), pero conviene mirar el resultado real.
5. **Consistencia fuerte** de Blobs en producción (el almacén la solicita; si una lectura inmediata tras guardar no
   mostrase el cambio, avisaría la comprobación de la pestaña Estado).

## Riesgos conocidos

- La sesión del panel no se puede revocar antes de las 8 h (cookie firmada sin estado en servidor). Si se sospecha de una
  filtración: cambiar `SESSION_SECRET` y volver a publicar invalida todas las sesiones.
- Sin límite por teléfono: alguien podría enviar muchos pedidos falsos (frenado por `rateLimit` por IP y un campo trampa
  contra bots; si ocurre, se borran desde el panel).
- Las fotos de categorías de la portada son las de siempre (banco de imágenes, marcadas «Foto ilustrativa»); no hay fotos
  para cordero ni despensa, por eso la portada las menciona en un bloque de texto («Y además…») en vez de con ficha.
- Las fotos de **producto** se suben desde el panel (se reducen a ≤ 900 px y ≤ 680 KB en el navegador).
- El estado «sin conexión» de la PWA muestra la web visitada, pero **pedir exige conexión** (el carrito se conserva).

## Zona de reparto (v5.1.0)

En **Tienda → Reparto a domicilio** se puede definir la zona de tres maneras (combinables):

- **Códigos postales:** lista de CP donde se reparte (se pueden pegar varios de golpe).
- **Radio en km desde la tienda:** en línea recta desde las coordenadas del negocio (pestaña Negocio).
- **Descripción libre:** texto que ve el cliente.

Reglas: el cliente siempre escribe su código postal al pedir reparto. Si solo hay lista de CP, tiene que estar en la lista. Si hay radio, los CP de la lista entran siempre y el resto se comprueba por distancia: el servidor localiza la dirección con **OpenStreetMap (Nominatim)**, un servicio gratuito externo (máx. 1 petición/s y `User-Agent` identificado, como exige su política de uso). Si queda fuera del radio se rechaza con un mensaje que remite a WhatsApp; si el servicio no la localiza, el pedido **entra marcado «dirección por verificar»** (se ve en el panel y en el CSV). La política de privacidad menciona OpenStreetMap solo cuando el radio está activo. La distancia es en línea recta y la localización por dirección puede fallar o equivocarse en calles poco conocidas: el radio es una ayuda, no una garantía.

## Imágenes de la tienda (v5.1.0)

- **Iconos de categoría y de pieza:** 14 de [Lucide](https://lucide.dev) (licencia ISC, `lucide-static` 1.52.0) y 4 dibujados a mano en el mismo estilo (cerdo, embutidos, quesos, cordero). Están en `public/assets/iconos/<categoría>.svg`; se pintan con máscara CSS (toman el color del texto).
- **Foto en la cabecera de cada categoría** (`public/assets/photos/<categoría>.jpg` y `-400.jpg`), etiquetada «Foto ilustrativa»: 13 que ya tenía la web (Pexels/Pixabay) y 5 nuevas de **Pexels** (licencia Pexels: uso comercial libre, sin atribución obligatoria): cordero (id 17988080), especias (6397651), vino (8473122), avíos (15505487) y salsas (5604824). Son fotos genéricas, no producto real de la tienda.
- **Cada pieza** muestra su foto si el carnicero la sube desde el panel; si no, el icono de su categoría.
- Los 225 productos **no tienen una foto propia por defecto**: no tengo fuentes con licencia verificada para fotografiar cada corte. Se suben desde el panel (Productos → Editar → Subir foto).

## Historial

- **v5.1.0** — Zona de reparto por códigos postales y/o radio en km (con localización de la dirección, pedidos «por verificar» y CP en pedidos y CSV); iconos y fotos por categoría en la tienda; miniatura con icono en cada pieza; fichas de «Cordero y cabrito» y «Despensa y vinos» en la portada.
- **v5.0.0** — Tienda online, panel de administración, funciones de Netlify y almacén Blobs; páginas generadas desde los
  ajustes; catálogo de 225 productos; textos legales dependientes del estado de la tienda; servidor local y pruebas de
  navegador.
- **v4.9.0 y anteriores** — web estática (responsive, PWA, sección de bares y restaurantes, auditorías de accesibilidad,
  rendimiento y seguridad). El historial detallado está en el README de esa línea de versiones.

## Crédito

Diseño y desarrollo: [Javier B. V.](https://www.linkedin.com/in/javier-barrero-vazquez-/)
