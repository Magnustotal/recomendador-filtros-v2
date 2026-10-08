// Pruebas de navegador: mejoras de rendimiento de la portada (botón «Volver arriba», imágenes WebP, CSS en línea, precarga de módulos).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarEntorno } from "./ayuda/entorno.mjs";

let e;
before(async () => { e = await arrancarEntorno(); });
after(async () => { await e?.parar(); });

test("portada: sin hoja de estilos externa de ofertas, fotos en WebP y módulos precargados", async () => {
  const page = await e.nuevaPagina();
  const peticiones = [];
  page.on("request", (r) => peticiones.push(new URL(r.url()).pathname));
  await page.goto(e.url + "/", { waitUntil: "networkidle" });
  assert.equal(await page.locator('link[rel="stylesheet"][href*="ofertas.css"]').count(), 0);
  assert.ok((await page.locator("style").allTextContents()).some((t) => t.includes(".of-")), "los estilos del escaparate van en la propia página");
  assert.ok(!peticiones.some((p) => p.endsWith("ofertas.css")), "no se pide ofertas.css");
  assert.ok(!peticiones.some((p) => p.startsWith("/assets/photos/") && p.endsWith(".jpg")), "ninguna foto se pide en JPG");
  assert.ok(peticiones.some((p) => p.startsWith("/assets/photos/") && p.endsWith(".webp")));
  assert.ok((await page.locator('link[rel="modulepreload"]').count()) >= 5);
  const hero = await page.locator(".hero-photo img").evaluate((i) => ({ ok: i.complete && i.naturalWidth > 0, actual: i.currentSrc }));
  assert.ok(hero.ok && hero.actual.endsWith(".webp"), hero.actual);
  assert.deepEqual(page.consola.filter((m) => !/Service Worker registration blocked/.test(m)), []);
});

test("portada: «Volver arriba» aparece al bajar, solo anima la opacidad y no se puede enfocar mientras está oculto", async () => {
  const page = await e.nuevaPagina();
  await page.goto(e.url + "/", { waitUntil: "networkidle" });
  const boton = page.locator(".back-to-top");
  assert.equal(await boton.getAttribute("aria-hidden"), "true");
  assert.equal(await boton.getAttribute("tabindex"), "-1");
  assert.equal(await boton.evaluate((n) => getComputedStyle(n).opacity), "0");
  assert.equal(await boton.evaluate((n) => getComputedStyle(n).animationName), "none", "sin animación de scroll (no compuesta)");
  await page.evaluate(() => window.scrollTo({ top: innerHeight * 2, behavior: "instant" }));
  await page.waitForFunction(() => document.querySelector(".back-to-top").classList.contains("visible"));
  assert.equal(await boton.getAttribute("aria-hidden"), null);
  assert.equal(await boton.getAttribute("tabindex"), null);
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".back-to-top")).opacity === "1");
  await boton.click();
  await page.waitForFunction(() => scrollY < 5);
  await page.waitForFunction(() => !document.querySelector(".back-to-top").classList.contains("visible"));
});

test("portada: con «reducir movimiento» el botón cambia sin transición", async () => {
  const page = await e.nuevaPagina({ reducido: true });
  await page.goto(e.url + "/", { waitUntil: "networkidle" });
  const dur = await page.locator(".back-to-top").evaluate((n) => parseFloat(getComputedStyle(n).transitionDuration.split(",")[0]));
  assert.ok(dur < 0.001, `transición de ${dur}s`);
});
