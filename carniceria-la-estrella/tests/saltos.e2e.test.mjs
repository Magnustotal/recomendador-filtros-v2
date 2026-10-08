// Pruebas de navegador: al pulsar el botón de una sección (categorías de la tienda, menú de la portada) se llega al comienzo a la primera,
// incluso si la página se mueve después del salto (imágenes, categorías que se pintan por primera vez, barra del navegador del móvil).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarEntorno } from "./ayuda/entorno.mjs";

let e;
before(async () => { e = await arrancarEntorno(); });
after(async () => { await e?.parar(); });

const errores = (page) => page.consola.filter((m) => !/Service Worker registration blocked/.test(m));
const desvio = (page, selector) => page.evaluate((s) => { const n = document.querySelector(s).closest(".cat-bloque") ?? document.querySelector(s); return Math.round(n.getBoundingClientRect().top - parseFloat(getComputedStyle(n).scrollMarginTop)); }, selector);
const aInicio = (page) => page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));

async function abrirTienda() {
  const page = await e.nuevaPagina({ ancho: 390, alto: 800 });
  await page.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await page.locator("#app").waitFor();
  return page;
}

test("tienda: el botón de una categoría lejana llega a su comienzo y se queda ahí aunque la página se mueva después", async () => {
  const page = await abrirTienda();
  await page.locator('#chips .chip[data-cat="vino"]').tap();
  // Algo sube el destino a media carga: una imagen que ocupa sitio, una categoría que se pinta...
  await page.waitForTimeout(150);
  await page.evaluate(() => { const d = document.createElement("div"); d.style.height = "420px"; d.id = "relleno"; document.querySelector("#cat-vino").closest(".cat-bloque").before(d); });
  await page.waitForTimeout(1200);
  assert.ok(Math.abs(await desvio(page, "#cat-vino")) <= 2, `desvío ${await desvio(page, "#cat-vino")}`);
  assert.equal(await page.evaluate(() => document.documentElement.style.overflowAnchor), "", "se devuelve el ajuste automático del navegador");
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".cat-bloque")].filter((b) => b.style.contentVisibility).length), 0, "y las categorías vuelven a su modo");
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("tienda: todas las categorías llegan a su comienzo con una pulsación", async () => {
  const page = await abrirTienda();
  const ids = await page.evaluate(() => [...document.querySelectorAll("#chips .chip[data-cat]")].map((c) => c.dataset.cat).filter(Boolean));
  assert.ok(ids.length >= 15);
  for (const id of [...ids, ids[3], ids[0]]) { // y volviendo hacia atrás
    await page.locator(`#chips .chip[data-cat="${id}"]`).tap();
    await page.waitForTimeout(450);
    assert.ok(Math.abs(await desvio(page, `#cat-${id}`)) <= 2, `${id}: desvío ${await desvio(page, `#cat-${id}`)}`);
  }
  await page.context().close();
});

test("tienda: si la persona mueve la pantalla mientras se ajusta, no se le lleva la contraria", async () => {
  const page = await abrirTienda();
  await page.locator('#chips .chip[data-cat="salsas"]').tap();
  await page.waitForTimeout(60);
  await page.mouse.wheel(0, 900); // la persona sigue por su cuenta
  await page.evaluate(() => { const d = document.createElement("div"); d.style.height = "420px"; document.querySelector("#cat-salsas").closest(".cat-bloque").before(d); });
  await page.waitForTimeout(900);
  assert.ok(Math.abs(await desvio(page, "#cat-salsas")) > 100, "no se vuelve a tirar de ella hacia la sección");
  await page.context().close();
});

test("portada: el menú lleva al comienzo de la sección aunque el contenido se mueva durante el desplazamiento suave", async () => {
  const page = await e.nuevaPagina({ ancho: 390, alto: 800 });
  await page.goto(e.url + "/", { waitUntil: "networkidle" });
  for (const href of ["#nosotros", "#faq", "#visitanos"]) {
    await aInicio(page);
    await page.waitForTimeout(400);
    await page.click("#nav-toggle");
    await page.locator(`#main-nav a[href$="${href}"]`).tap();
    await page.waitForTimeout(120);
    await page.evaluate((h) => { const d = document.createElement("div"); d.className = "relleno-prueba"; d.style.height = "300px"; document.querySelector(h).before(d); }, href);
    await page.waitForTimeout(2600);
    const d = await desvio(page, href);
    const alFinal = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1);
    assert.ok(Math.abs(d) <= 2 || alFinal, `${href}: desvío ${d}`);
    await page.evaluate(() => document.querySelectorAll(".relleno-prueba").forEach((n) => n.remove()));
  }
  assert.deepEqual(errores(page), []);
  await page.context().close();
});
