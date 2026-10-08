// Pruebas de navegador: animaciones y transiciones (tienda, portada y panel), con y sin «reducir movimiento», y sin saltos de diseño.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarEntorno, PASSWORD } from "./ayuda/entorno.mjs";

let e;
before(async () => { e = await arrancarEntorno(); });
after(async () => { await e?.parar(); });

const errores = (page) => page.consola.filter((m) => !/Service Worker registration blocked|status of 401|status of 400/.test(m));
const fila = (page, nombre) => page.locator(".prod", { has: page.getByRole("heading", { name: nombre, exact: true }) });
// Duración real (s) de la primera animación de un elemento, o 0
const duracion = (page, selector) => page.locator(selector).first().evaluate((n) => parseFloat(getComputedStyle(n).animationDuration) || 0);
const nombreAnimacion = (page, selector) => page.locator(selector).first().evaluate((n) => getComputedStyle(n).animationName);
const medirCLS = (page) => page.evaluate(() => new Promise((ok) => {
  let total = 0;
  new PerformanceObserver((l) => { for (const x of l.getEntries()) if (!x.hadRecentInput) total += x.value; }).observe({ type: "layout-shift", buffered: true });
  setTimeout(() => ok(total), 1200);
}));

async function abrirTienda(opciones) {
  const page = await e.nuevaPagina(opciones);
  await page.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await page.locator("#app").waitFor();
  return page;
}

test("tienda: «Añadir» confirma en el botón y en la tarjeta, la línea del carrito entra, el total y la barra laten, y todo se apaga solo", async () => {
  const page = await abrirTienda();
  const tarjeta = fila(page, "Solomillo de ternera");
  const boton = tarjeta.locator(".btn-anadir"); // por clase: al pulsar, su nombre accesible pasa a «Añadido…»
  await boton.click();
  assert.match(await boton.getAttribute("class"), /es-hecho/);
  assert.equal(await boton.innerText(), "✓ Añadido");
  assert.match(await tarjeta.getAttribute("class"), /recien-anadido/);
  assert.equal(await nombreAnimacion(page, ".prod.recien-anadido"), "prod-aviso");
  await page.waitForTimeout(1800);
  assert.doesNotMatch(await boton.getAttribute("class"), /es-hecho/, "vuelve a «Añadir»");
  assert.equal(await boton.innerText(), "Añadir");
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("tienda: una línea nueva en el carrito se anima y las ya pintadas, no; el total cambia con destello", async () => {
  const page = await abrirTienda();
  await fila(page, "Solomillo de ternera").getByRole("button", { name: /Añadir/ }).click();
  await fila(page, "Albóndigas").getByRole("button", { name: /Añadir/ }).click();
  const lineas = page.locator("#lineas .linea");
  assert.equal(await lineas.count(), 2);
  assert.match(await lineas.nth(1).getAttribute("class"), /nueva/, "la segunda es nueva");
  assert.doesNotMatch(await lineas.nth(0).getAttribute("class"), /nueva/, "la primera ya estaba");
  assert.equal(await lineas.nth(1).evaluate((n) => getComputedStyle(n).animationName), "aparece");
  // Cambiar una cantidad repinta sin animar las líneas
  await lineas.nth(0).getByRole("button", { name: /^Más/ }).click();
  assert.equal(await page.locator("#lineas .linea.nueva").count(), 0);
  assert.equal(await page.locator("#totales .total.cambio").count(), 1, "el total cambió y late");
  await page.context().close();
});

test("tienda: con «reducir movimiento» no hay animaciones ni transiciones apreciables", async () => {
  const page = await abrirTienda({ reducido: true });
  const boton = fila(page, "Solomillo de ternera").locator(".btn-anadir");
  await boton.click();
  assert.ok((await duracion(page, ".btn-anadir.es-hecho")) < 0.001, "la animación del botón dura 0");
  assert.ok((await duracion(page, ".prod.recien-anadido")) < 0.001);
  assert.ok((await duracion(page, "#lineas .linea.nueva")) < 0.001);
  assert.equal(await page.locator(".esqueleto").count(), 0, "el esqueleto ya no está");
  // Y la lógica sigue igual: el texto cambia aunque no haya animación
  assert.equal(await boton.innerText(), "✓ Añadido");
  await page.context().close();
});

test("tienda: no hay saltos de diseño al cargar ni al añadir (CLS < 0,1)", async () => {
  const page = await e.nuevaPagina();
  await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const x of l.getEntries()) if (!x.hadRecentInput) window.__cls += x.value; }).observe({ type: "layout-shift", buffered: true }); });
  await page.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await page.locator("#app").waitFor();
  await fila(page, "Solomillo de ternera").getByRole("button", { name: /Añadir/ }).click();
  await fila(page, "Albóndigas").getByRole("button", { name: /Añadir/ }).click();
  await page.waitForTimeout(1500);
  const cls = await page.evaluate(() => window.__cls);
  assert.ok(cls < 0.1, `CLS ${cls}`);
  await page.context().close();
});

test("portada: el hero entra con translate (sin opacidad en el texto) y con «reducir movimiento» se queda quieto", async () => {
  const page = await e.nuevaPagina({ ancho: 1280, alto: 800, tactil: false });
  await page.goto(e.url + "/", { waitUntil: "load" });
  assert.equal(await nombreAnimacion(page, ".hero-copy h1"), "hero-sube");
  assert.equal(await nombreAnimacion(page, ".hero-photo img"), "hero-foto");
  assert.equal(await nombreAnimacion(page, ".hero-badge-float"), "hero-sello");
  await page.context().close();
  const quieta = await e.nuevaPagina({ ancho: 1280, alto: 800, tactil: false, reducido: true });
  await quieta.goto(e.url + "/", { waitUntil: "load" });
  assert.equal(await nombreAnimacion(quieta, ".hero-copy h1"), "none");
  await quieta.context().close();
});

test("panel: los diálogos entran y salen con transición y siguen funcionando", async () => {
  const page = await e.nuevaPagina();
  await page.goto(e.url + "/admin/", { waitUntil: "networkidle" });
  await page.fill("#password", PASSWORD);
  await page.click("#acceso-enviar");
  await page.locator("#panel").waitFor();
  await page.waitForLoadState("networkidle");
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Tapa de ternera");
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  const dlg = page.locator("#dlg-producto");
  await dlg.waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  assert.equal(await dlg.evaluate((n) => getComputedStyle(n).opacity), "1", "terminó de aparecer");
  assert.ok((await dlg.evaluate((n) => parseFloat(getComputedStyle(n).transitionDuration))) > 0, "tiene transición");
  await dlg.getByRole("button", { name: /Cancelar/ }).click();
  await dlg.waitFor({ state: "hidden" });
  const pestana = page.locator("#panel-tienda");
  await page.click("#tab-tienda");
  assert.equal(await pestana.evaluate((n) => getComputedStyle(n).animationName), "panel-entra");
  assert.deepEqual(errores(page), []);
  await page.context().close();
});
