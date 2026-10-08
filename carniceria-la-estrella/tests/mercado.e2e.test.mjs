// Pruebas de navegador: pestaña «Mercado» con los precios de la carne que se descargan solos (copias de la UE en tests/fixtures; nunca se sale a internet).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { arrancarEntorno, PASSWORD } from "./ayuda/entorno.mjs";

let e;
before(async () => {
  process.env.LS_MERCADO_FIXTURE = fileURLToPath(new URL("./fixtures/mercado-ue", import.meta.url));
  e = await arrancarEntorno();
});
after(async () => { await e?.parar(); delete process.env.LS_MERCADO_FIXTURE; });

const errores = (page) => page.consola.filter((m) => !/Service Worker registration blocked|status of 401|status of 400/.test(m));
async function entrar(opciones) {
  const page = await e.nuevaPagina(opciones);
  await page.goto(e.url + "/admin/", { waitUntil: "networkidle" });
  await page.fill("#password", PASSWORD);
  await page.click("#acceso-enviar");
  await page.locator("#panel").waitFor();
  await page.waitForLoadState("networkidle");
  return page;
}

test("mercado: al abrir el panel los precios de la UE se descargan solos, se ven por serie y no hay nada que anotar a mano", async () => {
  const page = await entrar();
  await page.click("#tab-mercado");
  const series = page.locator("#merc-series .merc-serie");
  await series.first().waitFor({ timeout: 15000 });
  assert.equal(await series.count(), 6);
  const ternera = series.filter({ has: page.getByRole("heading", { name: "Ternera (canal)" }) });
  assert.match(await ternera.innerText(), /6,41 €\/kg|6,42 €\/kg/);
  assert.match(await ternera.innerText(), /641,5\d? €\/100 kg|641,50 €\/100 kg/);
  assert.match(await ternera.innerText(), /semana del 21 de septiembre al 27 de septiembre/);
  assert.match(await ternera.innerText(), /Semana anterior[\s\S]*%[\s\S]*Hace 4 semanas[\s\S]*%/);
  assert.match(await ternera.innerText(), /Sirve de termómetro para \d+ productos tuyos/);
  assert.equal(await ternera.locator("svg.merc-grafico").count(), 1);
  assert.equal(await ternera.locator("svg.merc-grafico").getAttribute("aria-hidden"), "true", "el dibujo es un añadido: el texto lo cuenta todo");
  assert.match(await page.locator("#merc-pie").innerText(), /Cubre \d+ de tus \d+ productos \(ternera, cerdo, pollo y cordero\)/);
  assert.equal(await page.locator("#merc-pie a").getAttribute("href"), "https://agridata.ec.europa.eu/extensions/DataPortal/agricultural_markets.html");
  assert.match(await page.locator("#merc-estado").innerText(), /Última semana publicada: del 21 de septiembre al 27 de septiembre de 2026\. Descargado el/);
  // Nada de anotar precios ni de añadir fuentes
  assert.equal(await page.locator("#panel-mercado input, #panel-mercado select, #panel-mercado textarea").count(), 0);
  assert.equal(await page.getByText("Añadir fuente").count(), 0);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("mercado: «Actualizar ahora» responde, y la pestaña Estado cuenta el estado de los precios del mercado", async () => {
  const page = await entrar();
  await page.click("#tab-mercado");
  await page.locator("#merc-series .merc-serie").first().waitFor({ timeout: 15000 });
  await page.click("#merc-actualizar");
  await page.locator("#aviso", { hasText: "Precios de la UE al día." }).waitFor();
  await page.click("#tab-estado");
  await page.locator("#lista-comprobacion li").first().waitFor();
  assert.match(await page.locator("#lista-comprobacion").innerText(), /Los precios del mercado de la carne están al día \(se descargan solos\)/);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("mercado: el panel de Mercado es accesible con teclado y con lector (títulos, lista y botón con nombre)", async () => {
  const page = await entrar({ ancho: 390 });
  await page.click("#tab-mercado");
  await page.locator("#merc-series .merc-serie").first().waitFor({ timeout: 15000 });
  assert.equal(await page.getByRole("button", { name: "Actualizar ahora" }).count(), 1);
  assert.equal(await page.getByRole("list", { name: /Cómo ha cambiado Ternera \(canal\)/ }).count(), 1);
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(ancho <= 0, "sin scroll horizontal en móvil");
  await page.context().close();
});
