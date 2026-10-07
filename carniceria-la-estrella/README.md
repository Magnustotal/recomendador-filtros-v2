# Carnicería La Estrella — web y tienda online (v5.10.0)

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

Los textos del aviso legal y de privacidad son un borrador que sale de cómo funciona la web (`lib/legal.mjs`). Antes de abrir la tienda, que los mire una gestoría o un abogado. Esto es lo que he comprobado y lo que no (revisiones del 7 de octubre de 2026; las tablas «Verificación legal» de más abajo llevan el detalle y las fuentes).

Leído en el texto consolidado del BOE, no en resúmenes: Ley 7/1996 (LOCM), arts. 14, 18-21, 24, 32-34 y 63-68; texto refundido de la LGDCU, arts. 20, 61, 82, 85, 89, 92, 97, 98 y 102-108 y anexo I; Ley 34/2002 (LSSI), arts. 10 y 27; Ley 7/2017, arts. 40 y 41; Ley 11/2023, arts. 2 y 3; Real Decreto 3423/2000 entero; Real Decreto 126/2015, arts. 1-10; Código Civil, arts. 1262 y 1265-1266. Además, la Orden andaluza de 24/04/2026 (BOJA) y el Reglamento (UE) 1169/2011 (arts. 9, 14, 21 y 44 y anexo II).

Lo que cambió al comprobarlo:

- Desistimiento. El texto anterior lo negaba en todos los productos. La ley solo exceptúa lo que «pueda deteriorarse o caducar con rapidez» y lo hecho a medida (art. 103, letras d y c). Ahora el aviso legal separa los dos casos, da 14 días naturales en el resto (art. 102) e incluye el modelo de formulario (anexo I.B), la garantía (art. 97.1.n) y las condiciones de reembolso y devolución (arts. 107-108). Queda por decidir con la gestoría qué pasa con los embutidos curados, los quesos, los jamones y los huevos: la ley no los nombra y no he encontrado fuente que diga que caduquen «con rapidez».
- Datos del titular. La LSSI (art. 10) pide el NIF y la LGDCU (art. 97.1.c) pide dirección, teléfono y correo electrónico. La web no tenía campo de correo; ahora está en el panel (pestaña Negocio). En la web publicada la razón social, el NIF y el correo siguen sin rellenar y se ven como «a completar».
- Botón del pedido. Si hacer el pedido obliga a pagar, el botón debe decir «pedido con obligación de pago» o algo equivalente; si no, el cliente no queda obligado (art. 98.2). Ahora dice «Enviar pedido con obligación de pago». La zona de reparto y las formas de pago salen ya en la introducción de la tienda (art. 98.3).
- Alérgenos. En una venta a distancia tienen que estar disponibles antes de comprar (Reglamento 1169/2011, art. 14.1; RD 126/2015, arts. 4.1.b y 9). El panel guardaba el campo pero la tienda no lo enseñaba. Ahora cada tarjeta lo muestra, y un producto sin revisar de una categoría con alérgenos habituales dice «consúltanos antes de pedir». Rellenarlos es trabajo del negocio: son 83 productos del catálogo inicial, y el panel avisa mientras falten.
- Precio por kilo o litro de lo envasado (RD 3423/2000, art. 3). Es nuevo en la ficha del producto y en la tienda; ver la tabla.
- Quejas y reclamaciones. La información del anexo II de la orden andaluza sale bajo el pedido y en el aviso legal. Falta el alta en Hoj@, las hojas en papel y el cartel.
- Venta de vino por internet. La casilla de mayor de 18 años y la comprobación en la entrega están. La prohibición de vender alcohol a menores es de la ley andaluza de drogas (Ley 4/1997, con la reforma de la Ley 12/2003), pero no he podido leer su texto vigente en el BOJA. Comprueba también los requisitos de la licencia.
- Datos personales de los pedidos. Constan la base legal (art. 6.1.b del RGPD), los derechos y la AEPD. No lo he auditado a fondo: el plazo de conservación es «mientras sean necesarios», los pedidos no se borran solos (se pueden borrar en el panel y exportar en CSV) y quedan por mirar las transferencias fuera de la UE (Netlify, WhatsApp/Meta, Google) y los contratos con esos encargados.

## Pendientes de la revisión legal

Decididos el 7 de octubre de 2026: se dejan para más adelante, sin tocar la web.

1. RGPD en detalle: transferencias de datos fuera de la UE (Netlify, WhatsApp/Meta, Google) y contratos con esos encargados. El texto de privacidad actual cubre la base legal, los derechos y la AEPD, pero no se ha auditado.
2. Periodo transitorio del precio por unidad de medida (RD 3423/2000, disposición transitoria única): comprobar si Andalucía lo fijó para el pequeño comercio. Mientras tanto, la web enseña el precio por kilo o litro de lo envasado.
3. Etiquetado de origen de la carne, registro sanitario y licencia de venta de alcohol: no leídos y fuera de lo que muestra la web.

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
- Las fotos de **producto** se suben desde el panel: solo **JPG, PNG o WebP**; el navegador las deja entre **400 y 1000 px** por el lado largo (reduce las grandes, amplía las pequeñas; por debajo de 120 px se rechazan), las recomprime como JPG de ≤ 680 KB y así elimina los datos ocultos (GPS, modelo del móvil). El servidor lo vuelve a comprobar: tipo real por cabecera, ≤ 700 KB y 400–1600 px por el lado largo **según lo que declara la cabecera de la imagen** (415/422 si no); no decodifica la foto, así que el límite de peso es la garantía real frente a archivos manipulados.
- El estado «sin conexión» de la PWA muestra la web visitada, pero **pedir exige conexión** (el carrito se conserva).

## Versión, fechas de actualización y productos por categorías (v5.3.0)

- **Pie de página** (portada y tienda): «Web actualizada el 7 de octubre de 2026 · versión 5.4.0». La fecha es la más reciente entre la de publicación de esa versión (`public/VERSION`, que `scripts/empaquetar.mjs` incrusta en la web) y el último cambio hecho desde el panel. La versión sale de `public/VERSION` y debe coincidir con `package.json` (hay una prueba).
- **Fecha de los precios** (en la tienda, bajo el título: «Precios actualizados por última vez el … Los precios pueden variar a diario; procuramos mantenerlos lo más al día posible»). Se actualiza **sola** cuando el carnicero cambia un precio (a mano, con «Aceptar» o con el redondeo masivo si cambia algo) y con el botón **«Los precios están al día (hoy)»** (Productos → Herramientas de precios) para cuando los repasa sin tocar ninguno. **Aceptar de golpe los orientativos no la actualiza**, porque son estimaciones sin revisar. Mientras no haya fecha, la tienda muestra solo la frase general.
- **Panel → Productos por categorías**: plegables como `<details>`, con su icono, número de productos y cuántos faltan por precio; botones de categoría fijos arriba (como en la tienda) que abren y llevan a la categoría; «Abrir todas / Cerrar todas»; el buscador abre solo las categorías con coincidencias. Un producto nuevo nace en la categoría en la que se estaba trabajando. Las herramientas de precios (redondeo, orientativos, fecha) van plegadas en el móvil.
- **Aviso sobre los rangos de mercado:** el semáforo dice de dónde salen (estimación propia de octubre de 2026, no oficial, que no se actualiza sola) y el panel avisa cuando tienen más de dos meses. No hay hoy ninguna fuente que los actualice automáticamente (ver abajo).

### Fuentes de los rangos de mercado: estado actual y lo que se ha comprobado

**Desde v5.5.0** existe la pestaña **Mercado** (`lib/mercado.mjs`, `public/admin/mercado.js`, datos de partida en `data/mercado.default.json`), según lo decidido con el dueño:

- **Nada se lee automáticamente.** Las 8 fuentes de partida (Mercadona, Carrefour / Hipermercado, Dia, Alcampo, Lidl, Aldi, El Corte Inglés / Hipercor, Supersol; todas «semanal» y a mano) y las que se añadan (carnicerías online, mayoristas…) se anotan a mano; el dueño prefirió no leer ninguna web salvo que alguien revise antes sus condiciones. Las direcciones web de partida son las webs principales de cada cadena y **no se han comprobado una a una**.
- **30 productos de referencia** («ancla»: pollo, cerdo, ternera, cordero, picada, embutidos básicos…); también se pueden anotar todos los productos al peso.
- **Semáforo:** con precios recientes, el rango es la **mediana** de las fuentes vigentes ±12 % (3 o más fuentes), ±20 % (2) o ±30 % (1), y el semáforo dice «mediana de N fuentes, la más antigua de hace X días». Cuenta un precio hasta **45 días** (14 si la fuente es «diaria»); pasado eso se ignora. Sin precios vigentes se sigue usando la estimación propia de abajo.
- **Avisos:** el panel avisa si una fuente semanal lleva más de 7 días sin anotarse, y la pestaña Estado lo recoge.
- **Solo uso interno:** los precios de otras tiendas no salen en el catálogo público ni en la web (hay una prueba). Los clientes no ven ninguna comparación.
- Se guardan en el almacén (`config/mercado`) como `{fuentes, precios}` y la API es `PUT /api/admin/mercado` (valida fuentes, tipos, frecuencias, URLs http(s), precios 0,01–2000 € y fechas no futuras).

Lo que sigue pendiente de decidir: **carnicerías online concretas** (la búsqueda que hice solo confirmó dos nombres, Comprar Carne Gallega / Carnicería Frebas y Eduardo Benito Carnicería —ternera de Ávila—; no he revisado sus precios ni condiciones) y si algún día se automatiza alguna fuente. Hasta v5.4.0 los rangos eran solo una **estimación propia**, sin ninguna fuente que los actualice. Se ha explorado, el 7 de octubre de 2026, qué se podría usar para mejorarlo (comprobaciones puntuales desde el entorno de desarrollo, no una auditoría):

| Fuente | Qué se ha visto | Idoneidad |
|---|---|---|
| Mercadona (tienda online) | Su web responde con datos en JSON (con código de almacén de Sevilla), sin acceso público documentado: es una interfaz interna | Técnicamente posible; **sus condiciones de uso no se han revisado** y podría cambiar sin aviso |
| Carrefour, El Corte Inglés | Devuelven 403 a consultas automáticas | **No** se debe intentar sortearlo |
| Dia, Alcampo, Lidl | Sin datos de carne accesibles con una consulta sencilla (no se ha profundizado) | Por explorar |
| OCU (observatorio mensual), observatorios autonómicos de consumo (p. ej. Castilla-La Mancha), MAPA (precios semanales en origen/canal) | Publican informes (PDF/web), no una interfaz de datos que se haya localizado | Sirven de **contraste manual** mensual o semanal, no de actualización automática |
| Carnicerías online | No se ha identificado aún cuáles | Pendiente de decidir con el negocio |

Limitaciones de fondo: los supermercados venden pocos cortes (cubrirían quizá una cuarta parte de los 225 productos) y a precios distintos de una carnicería de barrio, y emparejar cada producto con el suyo exige un trabajo de correspondencias que hay que mantener. Nada de esto está implementado: es el punto de partida para decidirlo.

## Precios orientativos, calculadora y semáforo (v5.2.0)

- **Precios orientativos (`data/precios-orientativos.json`):** los 225 productos llevan un precio sugerido (€ con IVA, por kg o por unidad) y una fiabilidad (media o baja). Es **una estimación mía** para una carnicería de barrio de precio medio en Sevilla, otoño de 2026. Me he apoyado en pocos datos de internet, dispersos y de fechas distintas (por ejemplo, secreto ibérico en torno a 21 €/kg, presa 29 €/kg, entrecot de ternera 19–21 €/kg, chuletas de cordero 22 €/kg, paleta ibérica de bellota 46 €/kg en pieza) y en mi criterio; **no está verificada** y puede estar desfasada. Es un punto de partida, no una tarifa. Los de jamones, caza, despensa, vinos y encargos son los menos fiables.
- **No salen a la tienda por sí solos.** El orientativo solo se ve en el panel (Productos). Hasta que el carnicero lo **acepta** (uno a uno con «Aceptar», o todos de golpe con «Aceptar los N precios orientativos pendientes»), el cliente ve «Consultar». Aceptar nunca pisa un precio ya puesto y respeta el redondeo ,90/,95 en los precios por kilo.
- **Calculadora** (al editar un producto → «Ayuda para poner el precio»): (1) escribirlo directamente; (2) **desde mi coste**: coste de compra sin IVA + merma (%) + recargo sobre coste (%) + IVA de la categoría → precio de venta, con el redondeo; (3) **ajustar el orientativo** con botones −10/−5/−1/+1/+5/+10 %, que trabajan con el valor exacto para que el redondeo no «se coma» los pasos.
- **Semáforo** (en la lista y en la calculadora, siempre con texto y símbolo, no solo color): con coste, mide el recargo real frente al objetivo (rojo si no cubre costes o deja muy poco, ámbar si es algo bajo/alto, verde si está en la zona buscada, que es entre el 80 % y el 150 % del objetivo). Sin coste, compara con el rango habitual (orientativo ±20 % o ±30 % según fiabilidad) con tramos «muy barato / algo barato / en rango / algo caro / muy caro».
- **Datos privados:** el coste, la merma y el recargo de cada producto **nunca salen en el catálogo público** (hay pruebas que lo comprueban). Los ajustes generales (recargo habitual del 30 % y el IVA por categoría) están en **Tienda → Precios y márgenes**.
- **IVA de partida** (carne y casi todo, 10 %; huevos, 4 %; vino, 21 %): son tipos que he puesto yo; en especias y salsas no estoy seguro (algunas fuentes dicen 10 % y otras 21 %). **Confírmalos con la gestoría** antes de fiarte de la calculadora. El 30 % de recargo tampoco es un dato del sector, es un punto de partida editable.

## Zona de reparto (v5.1.0)

En **Tienda → Reparto a domicilio** se puede definir la zona de tres maneras (combinables):

- **Códigos postales:** lista de CP donde se reparte (se pueden pegar varios de golpe).
- **Radio en km desde la tienda:** en línea recta desde las coordenadas del negocio (pestaña Negocio).
- **Descripción libre:** texto que ve el cliente.

Reglas: el cliente siempre escribe su código postal al pedir reparto. Si solo hay lista de CP, tiene que estar en la lista. Si hay radio, los CP de la lista entran siempre y el resto se comprueba por distancia: el servidor localiza la dirección con **OpenStreetMap (Nominatim)**, un servicio gratuito externo (máx. 1 petición/s y `User-Agent` identificado, como exige su política de uso). Si queda fuera del radio se rechaza con un mensaje que remite a WhatsApp; si el servicio no la localiza, el pedido **entra marcado «dirección por verificar»** (se ve en el panel y en el CSV). La política de privacidad menciona OpenStreetMap solo cuando el radio está activo. La distancia es en línea recta y la localización por dirección puede fallar o equivocarse en calles poco conocidas: el radio es una ayuda, no una garantía.

## Imágenes de la tienda (v5.1.0)

- **Iconos de categoría y de pieza:** 9 de [Lucide](https://lucide.dev) (licencia ISC, `lucide-static` 1.52.0) y 9 dibujados a mano en el mismo estilo (cerdo, quesos, cordero y, desde v5.5.2, caza —cabeza de ciervo—, cerdo ibérico —bellota—, embutidos —chorizo de herradura—, especias —guindilla—, pavo y salsas —botella—, que sustituyen a otros menos claros: un hueso, una mancha, una hoja, un pájaro y una gota). Los dibujé yo y se ven razonablemente bien, pero son dibujo de aficionado: se pueden cambiar por otros sustituyendo el SVG de `public/assets/iconos/<categoría>.svg`. Están en `public/assets/iconos/<categoría>.svg`; se pintan con máscara CSS (toman el color del texto).
- **Foto en la cabecera de cada categoría** (`public/assets/photos/<categoría>.jpg` y `-400.jpg`), etiquetada «Foto ilustrativa»: 13 que ya tenía la web (Pexels/Pixabay) y 5 nuevas de **Pexels** (licencia Pexels: uso comercial libre, sin atribución obligatoria): cordero (id 17988080), especias (6397651), vino (8473122), avíos (15505487) y salsas (5604824). Son fotos genéricas, no producto real de la tienda.
- **Cada pieza** muestra su foto si el carnicero la sube desde el panel; si no, el icono de su categoría.
- Los 225 productos **no tienen una foto propia por defecto**: no tengo fuentes con licencia verificada para fotografiar cada corte. Se suben desde el panel (Productos → Editar → Subir foto).

## Historial

- **v5.10.0** — Lo que quedaba por resolver de la revisión legal: precio por kilo o litro de lo envasado (campo «Contenido» en la ficha, visible en la tienda y en el escaparate de ofertas), lectura en el BOE de la accesibilidad (Ley 11/2023) y del arbitraje de consumo (Ley 7/2017), y los textos de cara al público reescritos con un tono más natural.
- **v5.9.0** — Segunda revisión legal (lo que faltaba): alérgenos visibles en la tienda con aviso «consúltanos» mientras no se revisen, botones de la lista oficial de 14 alérgenos en la ficha, datos de quejas y reclamaciones (Andalucía, Hoj@) en la tienda y el aviso legal, y documentación de lo pendiente (ver «Verificación legal (v5.9.0)»).
- **v5.8.1** — Verificación de los textos legales contra el BOE: desistimiento corregido (solo se excluye lo perecedero y lo personalizado) con modelo de formulario y garantía, botón «Enviar pedido con obligación de pago», campo de correo del negocio, precios «finales» (no «orientativos»), plazo de confirmación del pedido, aviso de venta con pérdida en las ofertas y una cita errónea del README corregida (ver «Verificación legal»).
- **v5.8.0** — Regla legal del precio anterior de 30 días (historial de precios, tachado automático, avisos al programar una rebaja), aviso de errores de precio en la tienda y en el aviso legal, y confirmación ante precios que parecen una errata.
- **v5.7.0** — Pestaña «Ofertas» en el panel (crear la oferta eligiendo el producto en una lista; ofertas y regalos centralizados) y escaparate «Oferta(s) de la semana» en la portada y en la tienda.
- **v5.6.0** — Ofertas temporales por producto (rebaja de precio con el habitual tachado, y «lleva N, paga M» tipo 3x2) con fecha de inicio y fin, y regalo por compra («por cada 30 € de compra, de regalo…»). Las calcula el servidor al hacer el pedido.
- **v5.5.3** — Calidad de uso: en el móvil la tienda enseña antes el buscador y las categorías (se esconden los 3 pasos), el botón «volver arriba» ya no tapa el formulario del pedido, y las filas de producto del panel son más bajas (y los botones de arriba, menos).
- **v5.5.2** — Seis iconos de categoría más claros (caza, cerdo ibérico, embutidos, especias, pavo, salsas).
- **v5.5.1** — Revisión de seguridad, código, accesibilidad y PWA (ver «Revisión de calidad»). Mercado: control de ediciones simultáneas, limpieza al borrar un producto, fecha de Madrid; huella de IP con clave; accesibilidad (nombres accesibles, región del panel); la tienda se puede ver sin conexión con el último catálogo.
- **v5.5.0** — Pestaña «Mercado»: fuentes de precios de otras tiendas (8 supermercados de partida, más las que se añadan), precios anotados a mano con fecha, semáforo por mediana de las fuentes recientes y avisos de atraso.
- **v5.4.0** — Fotos de producto: solo JPG/PNG/WebP, ajuste automático a 400–1000 px (cualquier resolución de origen), JPG ligero sin metadatos y comprobación de medidas en el servidor.
- **v5.3.0** — Pie con la fecha de actualización y la versión de la web; fecha de «precios actualizados» visible en la tienda (automática, más botón «Los precios están al día»); rangos de mercado con su origen y fecha; productos del panel agrupados por categorías plegables con navegación por botones.
- **v5.2.0** — Precios orientativos para los 225 productos (se aceptan desde el panel; hasta entonces, «Consultar»), calculadora de precio (desde el coste, con merma, recargo e IVA, o ajustando el orientativo), semáforo de precio en la lista y en el editor, recargo habitual e IVA por categoría en los ajustes, y coste/merma/recargo privados por producto.
- **v5.1.0** — Zona de reparto por códigos postales y/o radio en km (con localización de la dirección, pedidos «por verificar» y CP en pedidos y CSV); iconos y fotos por categoría en la tienda; miniatura con icono en cada pieza; fichas de «Cordero y cabrito» y «Despensa y vinos» en la portada.
- **v5.0.0** — Tienda online, panel de administración, funciones de Netlify y almacén Blobs; páginas generadas desde los
  ajustes; catálogo de 225 productos; textos legales dependientes del estado de la tienda; servidor local y pruebas de
  navegador.
- **v4.9.0 y anteriores** — web estática (responsive, PWA, sección de bares y restaurantes, auditorías de accesibilidad,
  rendimiento y seguridad). El historial detallado está en el README de esa línea de versiones.

## Crédito

Diseño y desarrollo: [Javier B. V.](https://www.linkedin.com/in/javier-barrero-vazquez-/)

## Revisión de calidad (v5.5.1)

Hecha el 7 de octubre de 2026 con revisión de seguridad, revisión de código del trabajo de v5.4–5.5, accesibilidad y PWA.

- **Seguridad.** Se arregló: la huella de IP de los intentos de acceso ya no es un SHA-256 simple (se deshace probando todas las IPv4) sino un HMAC con una clave derivada de `SESSION_SECRET`; `netlify-cli` (solo desarrollo) deja de estar en `"*"`. Revisado y sin cambios: contraseña con comparación en tiempo constante, cookie `HttpOnly; Secure; SameSite=Strict`, protección CSRF (origen + cabecera propia), bloqueo tras 5 fallos, límites de tamaño, textos del cliente siempre como texto (sin XSS), CSV sin fórmulas, tipo real de las fotos, CSP y demás cabeceras, `npm audit --omit=dev` sin vulnerabilidades. **Aceptado y documentado:** la sesión es una cookie firmada sin lista en el servidor, así que «Salir» la borra del navegador pero un token copiado seguiría valiendo hasta las 8 horas (cambiar `SESSION_SECRET` invalida todas); el bloqueo de intentos no es atómico (con el límite de 120 peticiones/min de Netlify y una contraseña larga no es explotable en la práctica); los 16 avisos de `npm audit` (completo) son de herramientas de desarrollo (`netlify-cli` y sus dependencias), que no se empaquetan en las funciones; los pedidos no se borran solos (la política de privacidad lo dice).
- **Revisión de código.** Corregido: precios de mercado huérfanos al borrar un producto (bloqueaban todo guardado), fecha inválida que daba 500 en vez de 400, `in` sobre objetos (admitía `constructor`), ediciones simultáneas de Mercado que se pisaban (ahora `version` + 409), borrador de precios perdido al recargar, aviso de «poco fiable» perdido con una sola fuente, fecha «de hoy» en UTC en vez de Madrid. Precisado: el servidor lee las medidas de la **cabecera** de la foto; no la decodifica.
- **Accesibilidad.** Pasado axe-core (WCAG 2.0/2.1/2.2 A y AA + buenas prácticas) en portada, tienda con productos en el carrito, privacidad, acceso y las 6 pestañas del panel, en móvil y escritorio: tras los arreglos, 0 violaciones en las 20 pantallas. Corregido: el botón «Pedir» de la cabecera y «Añadir/✓ Añadido» tenían un nombre accesible que no contenía su texto visible (WCAG 2.5.3), y las pestañas del panel quedaban fuera de toda región. Contrastes de la paleta calculados a mano: todos ≥ 7,6:1 salvo `--terracotta` (3,1:1), que no se usa para texto. axe no puede decidir el contraste sobre fondos con imagen o transparencia; eso queda por revisar a ojo. No sustituye una revisión con lector de pantalla.
- **PWA.** Ya cumplía lo esencial (manifest completo con iconos, capturas y accesos directos, service worker con precarga, limpieza de cachés y página sin conexión, HTTPS, HSTS, CSP). Mejorado: la tienda abre sin conexión con el último catálogo (única parte de `/api/` que se cachea; probado que pedidos, panel y fotos no) y se añade el acceso directo «Hacer un pedido». **No hecho, a propósito:** pantallas de inicio de iOS (`apple-touch-startup-image`), botón propio de instalación, notificaciones push y sincronización en segundo plano: no aportan a una carnicería de barrio. **Por comprobar:** los iconos «maskable» son el mismo archivo que los normales; si no tienen margen de seguridad, Android puede recortarlos al instalar. No he calculado la puntuación de 192 puntos de la auditoría.
- **Calidad de uso (v5.5.3).** Lighthouse móvil sobre la web servida en local (sin la compresión ni la caché de Netlify, con la simulación de 4G lenta): tienda 96 de rendimiento y portada 93; accesibilidad, buenas prácticas y SEO, 100 en ambas. El LCP de la portada sale en 3,2 s (objetivo, menos de 2,5 s); su foto principal ya lleva `fetchpriority=high` y carga en milisegundos, y el retraso es de pintado, así que lo medido aquí **no es fiable para decidir** y habría que repetirlo sobre la web publicada con una conexión normal (desde este entorno no se puede abrir Chrome contra el dominio real por el certificado del proxy). Revisión de diseño hecha por mí con capturas en móvil (la skill `impeccable` solo trae su guion; sus referencias y scripts no estaban instalados, así que apliqué sus criterios generales a mano); arreglado lo que estorbaba de verdad: pantallas de explicación antes del primer producto, botón flotante sobre el formulario y filas del panel demasiado altas. **Queda por probar con personas**: que el carnicero cambie un precio, oculte un producto y anote precios de mercado, y que alguien haga un pedido de prueba desde su móvil. Pendiente menor: los pedidos del panel marcan su estado con una banda de color en el lateral (además del texto del estado); es un patrón discutible que no he cambiado.

## Ofertas temporales y regalo por compra (v5.6.0)

Código en `lib/ofertas.mjs` (compartido con el navegador). No hay tareas programadas: cada oferta lleva su fecha de inicio y de fin (días completos, hora de Madrid, ambos incluidos) y se comprueba contra el día de hoy cada vez que se calcula, así que se activa y se desactiva sola y no puede quedarse colgada.

- **Rebaja de precio** (`tipo: "precio"`): en esas fechas el producto se vende al precio de oferta y la tienda enseña el habitual tachado, el de oferta y «hasta el …». El precio de oferta se guarda exacto (el redondeo ,90/,95 solo afecta al precio habitual). Tiene que ser más barato que el habitual, que debe existir; si después el habitual baja por debajo de la oferta, la oferta deja de aplicarse sola.
- **Lleva N, paga M** (`tipo: "cantidad"`, p. ej. 3x2): cuenta tramos completos de N kg (o N unidades) sumando todo lo que haya de ese producto en el pedido, aunque esté en varias líneas. 3 kg pagan 2 kg; 4,5 kg regalan 1 kg (pagan 3,5 kg); 6 kg regalan 2 kg. Necesita que el producto tenga precio.
- **Solo una oferta a la vez por producto** (hasta 8 programadas; no pueden solaparse). Lo programado para más adelante no sale al público hasta su fecha.
- **Regalo por compra** (`tienda.regalos`, hasta 5): «por cada X € de compra, de regalo Y», con fechas opcionales (vacías = siempre). Se calcula sobre lo que se paga por los productos, ya con las ofertas y **sin el envío**; «Se repite» da uno más por cada tramo completo (si no, uno solo) y el máximo por pedido es opcional. El regalo es un texto libre: no descuenta existencias. Sale en la tienda, en el pedido, en el mensaje de WhatsApp, en el panel y en el CSV (`ahorro_eur`, `regalos`).
- **Los importes los decide el servidor** con la fecha de Madrid del momento del pedido; el navegador solo los enseña. Alrededor de medianoche el catálogo guardado en caché (hasta unos 5 minutos) puede mostrar la oferta un poco de más o de menos; lo cobrado y el mensaje de WhatsApp salen siempre del cálculo del servidor. El pedido mínimo y el envío gratis se miden sobre lo que se paga ya con las ofertas.
- **Pedidos guardados:** cada línea lleva `precio` (el cobrado), `precioHabitual`, `ahorroCent`, `oferta` y `gratis`, y el pedido `ahorroCent` y `regalos`; los pedidos anteriores a v5.6.0 no los tienen y se muestran como siempre.
- **Pestaña «Ofertas» del panel (v5.7.0)** (`public/admin/ofertas.js`): una sola pantalla con todas las ofertas (activas hoy, programadas y terminadas) y un botón «Crear oferta» cuyo formulario pide el producto (buscador + lista por categorías), el tipo (rebaja o «lleva N, paga M»), el valor y las fechas (una semana por defecto). Guarda cada oferta en el propio producto, con la validación de siempre (`PUT /api/admin/producto`), así que no hay endpoint nuevo. La ficha del producto ya no edita ofertas: las resume y lleva a esta pestaña. Los regalos por compra se movieron aquí desde la pestaña Tienda y se guardan con su propio botón (`tienda.regalos` dentro de los ajustes, sin pisar lo que haya a medias en la pestaña Tienda).
- **Escaparate «Oferta(s) de la semana» (v5.7.0)** (`public/assets/destacadas.js`, `ofertas-portada.js`, `ofertas.css`; lógica en `destacadas()` de `lib/ofertas.mjs`): tarjetas con las ofertas de producto activas hoy (con precio, sin ocultar ni agotar, por orden de fin) y después los regalos por compra activos. Una sola tarjeta: «Oferta de la semana»; varias: «Ofertas de la semana»; ninguna: la sección no aparece. Móvil: tarjetas que se deslizan (la zona recibe foco de teclado solo si desborda); escritorio: rejilla. Sin carrusel automático (accesibilidad). **Se pinta en el navegador desde `/api/catalogo`**, no en el HTML de la página: la página se guarda en caché unos minutos (hasta un día mientras revalida) y las ofertas empiezan y acaban por fechas, así que un HTML con las ofertas incrustadas podría enseñar una oferta ya terminada. Enlaces: en la tienda, «Ir al producto» salta a la tarjeta y la destaca (`#p-<id>`, también válido desde fuera, p. ej. `/tienda#p-cerdo-iberico-secreto-iberico`); en la portada, «Pedir en la tienda» lleva a ese enlace, o a WhatsApp si la tienda está cerrada. El bloque de regalos que había arriba de la tienda se sustituyó por su tarjeta del escaparate.
- **Precio anterior de 30 días (v5.8.0): lo que dice la ley y lo que hace la web.** Fuente: [Ley 7/1996, de Ordenación del Comercio Minorista, art. 20.1 (BOE)](https://www.boe.es/buscar/act.php?id=BOE-A-1996-1072), en la redacción del art. 85 del Real Decreto-ley 24/2021 (vigente desde el 28 de mayo de 2022). Cuando se anuncia una rebaja hay que mostrar el precio anterior junto al reducido; «precio anterior» es **el menor aplicado a productos idénticos en los 30 días precedentes**; no hace falta en artículos que se venden por primera vez, y no cuenta el precio aplicado para reducir el desperdicio alimentario en productos próximos a caducar. No mostrar los precios habituales en lo rebajado es infracción leve (art. 64.d; multa de hasta 6.000 €, art. 68.3), y **«la falta de veracidad en los anuncios de prácticas promocionales calificando indebidamente las correspondientes ventas u ofertas» es grave** (art. 65.1.i; de 6.000 a 30.000 €, art. 68.2): por eso la web no llama «oferta» a lo que no cumple la regla. Sanciona la comunidad autónoma (art. 63.1). Texto leído directamente en el BOE (versión consolidada). Qué hace la web:
  - **Historial de precios** (`historial` en cada producto, solo lo ve el panel): cada cambio de precio (ficha, precio en la lista, redondeo, aceptar orientativos) añade una entrada con la fecha de Madrid; otro cambio el mismo día sustituye a la entrada de ese día (se supone una errata corregida). Un producto que ya tenía precio antes de v5.8.0 arranca con ese precio como «de siempre» (**no se puede saber desde cuándo lo tenía**: si lo cambiaste en las semanas anteriores a esta versión, ese cambio no consta).
  - **Precio anterior = el menor de los 30 días justos antes del inicio de la rebaja**, contando el precio habitual de cada día y las demás rebajas que hubiera (`precioAnterior` en `lib/ofertas.mjs`, con tests de los límites). Es lo que se tacha, se guarda en el pedido (`precioHabitual`) y sirve para medir el ahorro. La ley dice «treinta días precedentes», sin decir «naturales»: se cuentan como días naturales (es la lectura corriente y la que sigue la directiva europea de la que sale la norma, aunque eso último **no lo he podido comprobar**).
  - **Rebajas seguidas:** una segunda rebaja a menos de 30 días de la primera tiene como anterior el precio de la primera; si no es más barata que ese, **no es una rebaja**: se cobra lo programado pero sin tachar nada ni anunciarla como oferta (tampoco sale en el escaparate). El texto de la ley que he leído no recoge ninguna excepción para rebajas encadenadas (la directiva europea deja a los países añadirla; no he podido comprobar si España lo hizo).
  - **Producto sin precio en esos 30 días** (sale a la venta por primera vez): tampoco es una rebaja.
  - **Avisos en el panel:** al crear o cambiar una rebaja se ve, antes de guardar, qué se tachará o por qué no cuenta; la lista de ofertas marca con ⚠ las que no cuentan.
  - **No cubierto:** el 3x2 y los regalos se tratan como promociones (art. 18-19: duración y reglas visibles) y no como reducción de precio; es una interpretación mía. La ley **sí** exceptúa del cálculo el precio aplicado «con la finalidad de reducir el desperdicio alimentario» a productos con la caducidad o el consumo preferente próximos (art. 20.1, párrafo segundo; leído en el BOE). La web no tiene forma de marcarlo: cuenta como cualquier otro precio, lo que deja un precio anterior igual o más bajo, es decir, el lado prudente.
- **Errores de precio (v5.8.0, revisado en v5.8.1).** Texto en la tienda y en el aviso legal: *«Si detectamos un error evidente en algún precio, te lo comunicaremos antes de preparar tu pedido y podrás mantenerlo con el precio correcto o cancelarlo sin coste.»* Es coherente con el flujo real (el pedido no queda confirmado hasta que se confirma). **Qué dice la ley (texto leído en el BOE):** una oferta por vía electrónica «será válida durante el período que fije el oferente o, en su defecto, durante todo el tiempo que permanezcan accesibles» (LSSI art. 27.3); el contenido de la oferta, promoción o publicidad «será exigible por los consumidores» aunque no figure en el contrato (TRLGDCU art. 61.2); es abusivo reservarse la facultad de **aumentar el precio** sin razones objetivas y sin reconocer al consumidor el derecho a resolver el contrato (art. 85.10) y las modificaciones unilaterales exigen «motivos válidos especificados en el contrato» (art. 85.3); y el error solo invalida el consentimiento si recae sobre la sustancia de la cosa o las condiciones que principalmente motivaron el contrato (Código Civil art. 1266; el art. 1266 dice además que «el simple error de cuenta sólo dará lugar a su corrección»). **Conclusión prudente:** el aviso no te da derecho a anular una venta por sí solo; lo que hace es (a) especificar un motivo válido y (b) dar al cliente la salida de cancelar sin coste, que es lo que exige el art. 85.10. La exigencia de que el error sea «excusable» y no negligente es doctrina de los tribunales que recogen fuentes secundarias ([Consumoteca](https://www.consumoteca.com/legal/errores-de-precio-en-catalogos-online-y-derechos-del-consumidor/); [Gómez-Acebo & Pombo, 2012, anterior a la reforma](https://ga-p.com/publicaciones/errores-en-la-fijacion-de-los-precios-de-los-productos-en-los-catalogos-de-venta-on-line-hay-algun-remedio/)); **no he leído ninguna sentencia** (circulan citas del Tribunal Supremo que no he podido verificar, así que no las cito). En la práctica: rectifica enseguida, avisa al cliente antes de preparar y conserva la prueba. La protección contra erratas del panel (siguiente punto) es la defensa real. No es asesoramiento jurídico: **que la gestoría revise el texto**.
- **Contra las erratas (v5.8.0):** al escribir un precio (en la lista o en la ficha) que se aleja mucho del que tenía (menos de la mitad o más del doble) o del orientativo (menos del 40 % o más de 2,5 veces), el panel pregunta «¿Es correcto?» antes de guardarlo; si se dice que no, vuelve al de antes. «Aceptar todos los orientativos» avisa ahora de que son estimaciones sin verificar.

## Verificación legal (v5.8.1)

Hecha el 7 de octubre de 2026 leyendo el texto consolidado de [BOE-A-1996-1072 (LOCM)](https://www.boe.es/buscar/act.php?id=BOE-A-1996-1072), [BOE-A-2007-20555 (TRLGDCU)](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555), [BOE-A-2002-13758 (LSSI)](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) y [BOE-A-1889-4763 (Código Civil)](https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763). En v5.8.0 las citas de la LOCM venían de un resumen automático de la página, y **una de ellas era errónea** (decía que el cálculo del precio anterior no excluía los descuentos contra el desperdicio alimentario; el BOE dice lo contrario).

| Afirmación en la web / docs | Resultado | Qué se hizo |
|---|---|---|
| Precio anterior = menor precio de los 30 días precedentes (LOCM 20.1) | Correcto (texto literal) | Se mantiene; se anota que «días» se lee como naturales y la excepción del desperdicio alimentario |
| No hace falta precio anterior en artículos nuevos | Correcto | Igual |
| Rebaja sin precio anterior es infracción leve, hasta 6.000 € (64.d, 68.3) | Correcto | Se añade que calificar indebidamente una oferta es **grave** (65.1.i), motivo por el que no se etiqueta como oferta lo que no cumple |
| 3x2 y regalos no son «reducción de precio» | **Interpretación mía, sin fuente**. Sí aplican arts. 18-19 (duración y reglas), 32-33 (obsequio o prima) y 34 (ofertas conjuntas) | Se muestran fechas y reglas; el 3x2 es del mismo producto y se puede comprar por separado (34.1.b y c). Que lo confirme la gestoría |
| Venta con pérdida | **No estaba contemplada.** LOCM 14 la declara desleal en ciertos casos, y 65.1.c la hace infracción grave | El panel avisa (sin bloquear) si una oferta queda por debajo del coste con IVA |
| «No se aplica el desistimiento» en todo | **Incorrecto por exceso**: art. 103 solo exceptúa lo perecedero (d) y lo personalizado (c); en el resto hay 14 días (art. 102), y si no se informa del derecho el plazo se alarga 12 meses (art. 105) | Texto reescrito, modelo de formulario añadido |
| Falta de correo electrónico del titular | Exigido por TRLGDCU 97.1.c (y por LSSI 10.1.a «correo y cualquier otro dato») | Campo nuevo en el panel |
| Botón «Enviar pedido» | TRLGDCU 98.2: debe decir «pedido con obligación de pago» o similar, o el cliente no queda obligado | Cambiado |
| «Los precios y el peso son orientativos» (tienda) | Contradice que el precio publicado es exigible (61.2, LSSI 27.3) | Ahora: precios finales con IVA, peso aproximado |
| «Podemos no aceptarlo» sin plazo | Riesgo de cláusula abusiva por plazo indeterminado de aceptación (TRLGDCU 85.1, 85.8) | Se compromete confirmar o rechazar antes del día y la franja elegidos, y si no, no hay pedido |
| Importe definitivo distinto del estimado | Art. 85.10: subir el precio sin razones objetivas y sin derecho a resolver es abusivo | Se promete avisar antes de cobrar si el importe es bastante superior |
| Aviso de errores de precio | Ver apartado «Errores de precio»: útil pero no blinda | Texto igual; documentación afinada |

**Sin verificar** (no he leído el texto ni sentencias): ley andaluza de comercio interior y quién sanciona en la práctica; ley andaluza de drogas (alcohol a menores) vigente; hojas de reclamaciones en Andalucía; si ciertos productos (curados, quesos, huevos) «caducan con rapidez»; RGPD en detalle (transferencias fuera de la UE, contratos de encargado); la directiva europea 2019/2161; sentencias del Tribunal Supremo sobre errores de precio; guía de la Comisión sobre el precio anterior.

## Verificación legal (v5.9.0)

Segunda pasada, el 7 de octubre de 2026, preguntándome qué **faltaba** (no qué estaba mal). Fuentes leídas en el original: [Real Decreto 126/2015 (BOE-A-2015-2293)](https://www.boe.es/buscar/act.php?id=BOE-A-2015-2293), [Reglamento (UE) 1169/2011 en EUR-Lex](https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:32011R1169) (arts. 9, 14, 21 y 44 y anexo II) y la [Orden de 24 de abril de 2026 de la Junta de Andalucía (BOJA nº 82, 30/04/2026)](https://juntadeandalucia.es/eboja/2026/82/BOJA26-082-00021-5609-01_00336846.pdf).

| Tema | Qué dice la norma | Estado en la web |
|---|---|---|
| **Alérgenos antes de comprar** | Reglamento 1169/2011 art. 14.1 y RD 126/2015 art. 9: en la venta a distancia las menciones obligatorias, entre ellas los alérgenos (art. 9.1.c del Reglamento y art. 4.1.b del RD), deben estar disponibles antes de la compra; el origen y las no enumeradas en el art. 9.1 pueden darse después; todas, en la entrega. El art. 4.1.b del RD no exige repetirlo si el nombre del alimento ya nombra la sustancia (p. ej. «huevos») | **Hecho**: se muestran en la tienda. **Pendiente del negocio**: rellenarlos producto a producto. Entrega: tener la información a mano al entregar |
| Lista de alérgenos | Anexo II del Reglamento: 14 (cereales con gluten, crustáceos, huevos, pescado, cacahuetes, soja, leche, frutos de cáscara, apio, mostaza, sésamo, sulfitos por encima de 10 mg/kg o 10 mg/l, altramuces y moluscos) | Botones en la ficha del producto. El vino casi siempre lleva sulfitos |
| Carne fresca sin elaborar, casquería, avíos | **Suposición mía**: sin alérgenos, por eso no sale nada. Si añaden adobo, marinado o relleno, hay que indicarlo | Vigilar en «elaborados» (está en la lista de revisión) |
| **Hojas de quejas y reclamaciones (Andalucía)** | Orden de 24/04/2026: sigue siendo obligatorio tener y entregar hojas **en papel** y, además, estar de alta en **Hoj@** (electrónicas). La orden entra en vigor a los 20 días de su publicación (por mi cuenta, el 20 de mayo de 2026). Disp. adic. 3.ª: las empresas pequeñas, como una carnicería, tienen **un año** desde entonces para darse de alta (por mi cuenta, hasta el 20 de mayo de 2027); los más de 250 trabajadores, 50 M€ de facturación o más de 20 establecimientos, seis meses. Disp. adic. 2.ª: el cartel del anexo III en el establecimiento, y la información del anexo II «en cada dispositivo utilizado para la… comercialización de bienes de modo automático o telemático» | **Hecho**: el texto del anexo II (menos el código QR) sale bajo el formulario de pedido y en el aviso legal, con los datos del negocio. **Pendiente del negocio**: alta en Hoj@ (genera el cartel con QR), cartel en la tienda, hojas en papel. **Pendiente de añadir a la web**: el QR, cuando exista. No he leído el Decreto 82/2022 |
| Plataforma europea de litigios en línea (ODR) | El Reglamento (UE) 2024/3228 (leído) deroga el 524/2013 y suprime la plataforma; según el Ministerio de Consumo (fuente secundaria), dejó de funcionar el 20 de julio de 2025. Pero la Ley 7/2017, art. 40.5, en la versión consolidada del BOE (última actualización 03/01/2025), sigue diciendo que quien vende en línea debe enlazarla | La web no enlaza a una plataforma que ya no existe. Es una contradicción de la ley que no puedo resolver yo: que la gestoría confirme si el art. 40.5 sigue siendo exigible |
| Entidad de resolución alternativa (Ley 7/2017, arts. 40-41) | Leído. Solo hay que informar en la web y en las condiciones si el negocio está adherido a una entidad o la ley lo obliga a aceptarla (art. 40.1-2). Si no, y una reclamación directa no se resuelve, hay que decirle al consumidor, por escrito y como mucho en un mes, si participas en alguna y, si no, indicar al menos una entidad competente (art. 40.3). Incumplirlo es infracción grave (art. 41) | Nada en la web, porque el negocio no está adherido. Cuando llegue una reclamación sin resolver, contestar con eso por escrito: pregunta a Consumo o a tu OMIC qué entidad corresponde |
| Precio por unidad de medida (RD 3423/2000) | Leído entero. Hay que dar el precio por kilo, litro o unidad en lo que lleva indicación de cantidad (art. 3.2.a) y en lo que se vende por unidades (3.2.b), a la vista y junto al precio de venta (art. 4.1) y también en la publicidad que mencione el precio (3.5). No hace falta cuando coincide con el precio de venta (3.3.a), ni en los vinos de mesa con indicación geográfica y los vinos con denominación de origen (anexo I.e). Para los huevos, la unidad es la docena (anexo II) | Hecho: lo que se vende al peso, por pieza o por docena ya cumple (el precio por unidad es el de venta). Para lo envasado hay un campo «Contenido» en la ficha (cantidad y medida) y la tienda y el escaparate de ofertas enseñan «75 cl · 8,00 €/l». Una casilla marca lo exento. El panel avisa de las especias, salsas y vinos sin mirar. Pendiente del negocio: rellenarlo. Queda sin leer si Andalucía fijó un periodo transitorio para el pequeño comercio (disposición transitoria única) |
| Accesibilidad de la tienda online (Ley 11/2023) | Leído. Los servicios de comercio electrónico entran en el ámbito (art. 2), pero las microempresas que presten servicios están exentas (art. 3.3). Microempresa: menos de 10 personas y un volumen de negocios anual o un balance que no pase de 2 millones de euros (anexo, definición 16) | Si el negocio es una microempresa, no le afecta. La web se prueba con axe y está hecha para WCAG 2.2 AA de todos modos. Que la gestoría confirme el tamaño de la plantilla |
| Etiquetado de carne (origen, lote, categoría…) y trazabilidad | **No leído.** Existen normas de origen para carne fresca y de vacuno | Fuera de lo que muestra la web hoy. Comprobar con la gestoría o el servicio de sanidad |
| Registro sanitario, licencia y datos registrales | No leído | Fuera de la web |

