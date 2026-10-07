import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { renderizarPagina, aplicarPlantilla, cspParaHtml, escapar, preguntasFrecuentes } from "../lib/render.mjs";
import { ajustesPorDefecto } from "../lib/datos.generado.mjs";
import { plantillas } from "../lib/plantillas.generado.mjs";

const ajustes = (cambios = (a) => a) => cambios(structuredClone(ajustesPorDefecto));
const AHORA = new Date("2026-10-07T10:00:00Z");

test("lo generado (plantillas y datos) está al día con las fuentes", () => {
  execFileSync(process.execPath, ["scripts/empaquetar.mjs", "--comprobar"], { cwd: new URL("..", import.meta.url), stdio: "pipe" });
});

test("todas las plantillas se renderizan sin dejar ni un token sin sustituir", () => {
  for (const nombre of Object.keys(plantillas)) {
    const html = renderizarPagina(nombre, ajustes(), { ahora: AHORA });
    assert.doesNotMatch(html, /\{\{/, nombre);
  }
});

test("la portada lleva el SEO, el horario y el mapa de los ajustes", () => {
  const a = ajustes((x) => { x.seo.titulo = "Mi carnicería | Sevilla"; x.negocio.telefono = "955 12 34 56"; x.negocio.lat = 37.5; x.negocio.lng = -5.9; x.horario = [{ dias: [1, 2, 3, 4, 5, 6], abre: "08:00", cierra: "14:00" }]; x.seo.dominio = "https://mitienda.es"; return x; });
  // el validador normaliza el teléfono; aquí se pasa ya normalizado
  a.negocio.telefono = "955123456"; a.negocio.whatsapp = "34955123456";
  const html = renderizarPagina("index.html", a, { ahora: AHORA });
  assert.match(html, /<title>Mi carnicería \| Sevilla<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/mitienda\.es\/">/);
  assert.match(html, /tel:\+34955123456/);
  assert.match(html, /955&nbsp;12&nbsp;34&nbsp;56/);
  assert.match(html, /maps\?q=37\.5,-5\.9/);
  assert.match(html, /<td>Lunes a sábado<\/td><td>8:00–14:00<\/td>/);
  assert.match(html, /<tr class="closed"><td>Domingo<\/td><td>Cerrado<\/td>/);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(ld[0]["@type"], "GroceryStore");
  assert.equal(ld[0].telephone, "+34955123456");
  assert.equal(ld[0].url, "https://mitienda.es/");
  assert.equal(ld[0].openingHoursSpecification[0].opens, "08:00");
  assert.equal(ld[1]["@type"], "FAQPage");
  assert.ok(ld[1].mainEntity.length >= 8);
});

test("el texto de los ajustes se escapa: no se puede inyectar HTML ni cerrar el script de datos", () => {
  const a = ajustes((x) => { x.negocio.nombre = '<img src=x onerror=alert(1)>"'; x.seo.titulo = "</title><script>alert(1)</script>"; x.negocio.citaGoogle = "<b>hola</b>"; return x; });
  const html = renderizarPagina("index.html", a, { ahora: AHORA });
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;&quot;/);
  // el nombre aparece también dentro del JSON-LD: no puede romper el <script>
  const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of bloques) assert.doesNotMatch(b[1], /<\/?[a-z]/i);
});

test("la tienda activa cambia los botones de pedir y añade la pregunta frecuente", () => {
  const off = renderizarPagina("index.html", ajustes(), { ahora: AHORA });
  assert.match(off, /Pedir por WhatsApp/);
  const on = renderizarPagina("index.html", ajustes((x) => { x.tienda.activa = true; return x; }), { ahora: AHORA });
  assert.match(on, /href="\/tienda"/);
  assert.match(on, /Hacer pedido online/);
  assert.match(on, /¿Puedo hacer el pedido por internet\?/);
  assert.equal(preguntasFrecuentes(ajustes()).length + 1, preguntasFrecuentes(ajustes((x) => { x.tienda.activa = true; return x; })).length);
});

test("CSP: autoriza por huella solo los scripts en línea que existen", () => {
  const html = renderizarPagina("index.html", ajustes(), { ahora: AHORA });
  const csp = cspParaHtml(html);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/src=/.test(m[1]) && !/ld\+json/.test(m[1]));
  assert.ok(scripts.length >= 1);
  for (const m of scripts) assert.ok(csp.includes(`'sha256-${createHash("sha256").update(m[2]).digest("base64")}'`));
  assert.doesNotMatch(csp, /unsafe-inline'[^;]*script/);
  assert.match(csp, /script-src 'self' 'sha256-/);
  assert.match(csp, /object-src 'none'/);
});

test("aplicarPlantilla: escapa, admite |url, y falla en alto si falta un dato", () => {
  assert.equal(aplicarPlantilla("{{a}}", { a: "<&>" }), "&lt;&amp;&gt;");
  assert.equal(aplicarPlantilla("{{a|url}}", { a: "x y/z" }), "x%20y%2Fz");
  assert.equal(aplicarPlantilla("{{{a}}}", { a: "<b>" }), "<b>");
  assert.throws(() => aplicarPlantilla("{{falta}}", {}), /Falta el dato/);
  assert.equal(aplicarPlantilla("{{falta}}", {}, { estricto: false }), "");
  assert.equal(escapar("'"), "&#39;");
});

test("páginas legales: el texto cambia según la tienda esté abierta o cerrada y usa los datos del negocio", () => {
  const cerrada = ajustes();
  const abierta = ajustes((x) => { x.tienda.activa = true; x.negocio.razonSocial = "Estrella Cárnicas S.L."; x.negocio.nif = "B12345678"; return x; });
  const pCerrada = renderizarPagina("privacidad.html", cerrada, { ahora: AHORA });
  const pAbierta = renderizarPagina("privacidad.html", abierta, { ahora: AHORA });
  assert.match(pCerrada, /no tiene formulario de contacto/);
  assert.doesNotMatch(pCerrada, /pedido en la web/);
  assert.match(pAbierta, /pedido en la web/);
  assert.match(pAbierta, /Estrella Cárnicas S\.L\./);
  assert.match(pAbierta, /B12345678/);
  assert.match(pCerrada, /\[razón social a completar\]/, "sin razón social se marca como pendiente");

  const lCerrada = renderizarPagina("aviso-legal.html", cerrada, { ahora: AHORA });
  const lAbierta = renderizarPagina("aviso-legal.html", abierta, { ahora: AHORA });
  assert.doesNotMatch(lCerrada, /Condiciones de los pedidos online/);
  assert.match(lCerrada, /7\. Legislación aplicable/);
  assert.match(lAbierta, /7\. Condiciones de los pedidos online/);
  assert.match(lAbierta, /8\. Legislación aplicable/);
  assert.match(lAbierta, /mayores? de edad|menores de 18/);
  for (const html of [pCerrada, pAbierta, lCerrada, lAbierta]) assert.match(html, /<link rel="canonical" href="https:\/\/carnicerialaestrella\.netlify\.app\/(privacidad|aviso-legal)\.html">/);
});

test("páginas legales: el nombre del negocio se escapa", () => {
  const html = renderizarPagina("aviso-legal.html", ajustes((x) => { x.negocio.nombre = 'Carne <img src=x onerror=alert(1)>'; x.tienda.activa = true; return x; }), { ahora: AHORA });
  assert.doesNotMatch(html, /<img src=x/);
});

test("la tienda (/tienda) se renderiza con SEO propio y sus piezas comunes", () => {
  const html = renderizarPagina("tienda.html", ajustes((x) => { x.tienda.activa = true; return x; }), { ahora: AHORA });
  assert.match(html, /<title>Tienda online \| Carnicería La Estrella<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/carnicerialaestrella\.netlify\.app\/tienda">/);
  assert.match(html, /id="formulario"/);
  assert.match(html, /<script type="module" src="\/assets\/tienda\.js">/);
  assert.match(html, /Mi pedido/);
  assert.doesNotMatch(html, /\{\{/);
  // el único script en línea es el que marca <html class="js">, y la CSP lo autoriza por huella
  assert.match(cspParaHtml(html), /script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
});

test("privacidad: solo menciona OpenStreetMap cuando el reparto usa radio en km", () => {
  const con = renderizarPagina("privacidad.html", ajustes((x) => { x.tienda.activa = true; x.tienda.reparto.radioKm = 3; return x; }), { ahora: AHORA });
  const sin = renderizarPagina("privacidad.html", ajustes((x) => { x.tienda.activa = true; return x; }), { ahora: AHORA });
  const cerrada = renderizarPagina("privacidad.html", ajustes((x) => { x.tienda.reparto.radioKm = 3; return x; }), { ahora: AHORA });
  assert.match(con, /OpenStreetMap \(Nominatim\)/);
  assert.doesNotMatch(sin, /OpenStreetMap/);
  assert.doesNotMatch(cerrada, /OpenStreetMap/);
  assert.doesNotMatch(con, /\{\{/);
});

test("pie: «Web actualizada el … · versión X» usa la fecha de publicación o la del último cambio del panel, la más reciente", async () => {
  const { versionWeb } = await import("../lib/datos.generado.mjs");
  const { infoWeb } = await import("../lib/render.mjs");
  const paquete = JSON.parse((await import("node:fs")).readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(versionWeb.version, paquete.version, "public/VERSION y package.json deben coincidir");
  assert.match(versionWeb.fecha, /^\d{4}-\d{2}-\d{2}$/);

  const sin = infoWeb(null);
  assert.equal(sin.actualizadaISO, versionWeb.fecha);
  // un cambio del panel posterior a la publicación manda
  const tarde = infoWeb({ contenido: "2099-03-04T23:30:00Z" }); // 05/03/2099 00:30 en Madrid
  assert.equal(tarde.actualizadaISO, "2099-03-05");
  assert.equal(tarde.actualizada, "5 de marzo de 2099");
  // uno anterior a la publicación no la rebaja
  assert.equal(infoWeb({ contenido: "2020-01-01T10:00:00Z" }).actualizadaISO, versionWeb.fecha);

  for (const pagina of ["index.html", "tienda.html"]) {
    const html = renderizarPagina(pagina, ajustes(), { ahora: AHORA, meta: { contenido: "2099-03-04T23:30:00Z" } });
    assert.match(html, /Web actualizada el <time datetime="2099-03-05">5 de marzo de 2099<\/time> · versión \d+\.\d+\.\d+/, pagina);
  }
});

test("accesibilidad: el nombre accesible del botón «Pedir» de la cabecera empieza por su texto visible (WCAG 2.5.3)", () => {
  const visible = (html) => html.match(/<a class="btn btn-green"[^>]*aria-label="([^"]+)"[^>]*>[\s\S]*?<span class="btn-label-full">([^<]+)<\/span>/).slice(1);
  for (const [pagina, activa] of [["index.html", true], ["index.html", false], ["tienda.html", true]]) {
    const html = renderizarPagina(pagina, ajustes((x) => { x.tienda.activa = activa; return x; }), { ahora: AHORA });
    const [nombre, texto] = visible(html);
    assert.ok(nombre.toLowerCase().startsWith(texto.toLowerCase()), `${pagina} activa=${activa}: «${nombre}» no empieza por «${texto}»`);
  }
});
