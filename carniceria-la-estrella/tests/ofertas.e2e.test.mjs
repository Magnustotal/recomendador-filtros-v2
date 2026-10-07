// Pruebas de navegador: pestaña «Ofertas» del panel y escaparate «Oferta(s) de la semana» en portada y tienda.
// Reloj fijo: lunes 5 de octubre de 2026, 09:00 en Madrid. Los tests van en orden y comparten datos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarEntorno, PASSWORD } from "./ayuda/entorno.mjs";

let e;
before(async () => { e = await arrancarEntorno(); });
after(async () => { await e?.parar(); });

// Los 400 de las validaciones que se provocan a propósito no son un fallo
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
const producto = async (id) => (await e.api.llamar("/datos")).datos.productos.find((p) => p.id === id);
const ponerPrecio = async (id, precio) => assert.equal((await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...(await producto(id)), precio } })).estado, 200);
const ALB = "elaborados-albondigas";
const SEC = "cerdo-iberico-secreto-iberico";

test("ofertas: se crean eligiendo el producto en la lista, con errores explicados, programadas y cambiadas", async () => {
  await ponerPrecio(ALB, 9.9);
  await ponerPrecio(SEC, 29.95);
  const page = await entrar();
  await page.click("#tab-ofertas");
  assert.match(await page.locator("#of-lista").innerText(), /Todavía no hay ofertas/);
  const dlg = page.locator("#dlg-oferta");
  const crear = async ({ buscar, id }) => { await page.click("#of-nueva"); await dlg.locator("#f-of-buscar").fill(buscar); await dlg.locator("#f-of-producto").selectOption(id); };
  const guardar = (nombre) => dlg.getByRole("button", { name: nombre, exact: true }).click();

  // 3x2 para las albóndigas, con las fechas de una semana ya puestas
  await crear({ buscar: "Albóndigas", id: ALB });
  assert.match(await dlg.locator("#f-of-producto").locator("option:checked").innerText(), /Albóndigas · 9,90\s€\/kg/);
  assert.match(await dlg.innerText(), /Precio habitual: 9,90\s€\/kg/);
  assert.equal(await dlg.locator("#f-of-desde").inputValue(), "2026-10-05");
  assert.equal(await dlg.locator("#f-of-hasta").inputValue(), "2026-10-11");
  await dlg.locator('input[value="cantidad"]').check();
  assert.equal(await dlg.locator("#f-of-lleva").inputValue(), "3");
  assert.equal(await dlg.locator("#f-of-paga").inputValue(), "2");
  assert.match(await dlg.innerText(), /Con 3 kg se pagan 2 kg/);
  await guardar("Crear oferta");
  await page.locator("#aviso", { hasText: "Oferta creada para Albóndigas" }).waitFor();
  await dlg.waitFor({ state: "hidden" });
  assert.deepEqual((await producto(ALB)).ofertas, [{ tipo: "cantidad", desde: "2026-10-05", hasta: "2026-10-11", lleva: 3, paga: 2 }]);
  const activas = page.locator("#of-lista .of-grupo", { hasText: "Activas hoy (1)" });
  assert.match(await activas.innerText(), /Albóndigas[\s\S]*Activa hoy[\s\S]*3x2: se llevan 3 kg y se pagan 2 kg[\s\S]*Del 5 de octubre al 11 de octubre/);

  // rebaja para el secreto: primero un error (más cara que el habitual), luego bien
  await crear({ buscar: "Secreto", id: SEC });
  await dlg.locator("#f-of-precio").fill("35");
  assert.match(await dlg.innerText(), /Tiene que ser más barato que el precio habitual \(29,95\s€\)/);
  await guardar("Crear oferta");
  await dlg.locator(".errores").waitFor({ state: "visible" });
  assert.match(await dlg.locator(".errores").innerText(), /tiene que ser más barato que el habitual \(29,95\s€\)/);
  await dlg.locator("#f-of-precio").fill("19,95");
  assert.match(await dlg.innerText(), /La tienda enseñará 29,95\s€ tachado y 19,95\s€ \(−33 %\)/);
  await guardar("Crear oferta");
  await page.locator("#aviso", { hasText: "Oferta creada para Secreto ibérico" }).waitFor();
  assert.deepEqual((await producto(SEC)).ofertas, [{ tipo: "precio", desde: "2026-10-05", hasta: "2026-10-11", precio: 19.95 }]);

  // solapadas: se avisa; programada para la semana siguiente: sale en «Programadas»
  await crear({ buscar: "Albóndigas", id: ALB });
  await dlg.locator('input[value="cantidad"]').check();
  await dlg.locator("#f-of-desde").fill("2026-10-09");
  await dlg.locator("#f-of-hasta").fill("2026-10-15");
  await guardar("Crear oferta");
  await dlg.locator(".errores").waitFor({ state: "visible" });
  assert.match(await dlg.locator(".errores").innerText(), /coinciden en fechas/);
  await dlg.locator("#f-of-desde").fill("2026-10-12");
  await dlg.locator("#f-of-hasta").fill("2026-10-18");
  await guardar("Crear oferta");
  await page.locator("#of-lista .of-grupo", { hasText: "Programadas (1)" }).waitFor();
  assert.match(await page.locator("#of-lista .of-grupo", { hasText: "Programadas (1)" }).innerText(), /Programada[\s\S]*Del 12 de octubre al 18 de octubre/);

  // cambiar la rebaja del secreto
  await page.getByRole("button", { name: "Cambiar la oferta de Secreto ibérico" }).click();
  assert.equal(await dlg.locator("#f-of-producto").count(), 0, "al cambiar, el producto no se elige otra vez");
  await dlg.locator("#f-of-precio").fill("21,95");
  await guardar("Guardar cambios");
  await page.locator("#aviso", { hasText: "Oferta cambiada" }).waitFor();
  assert.equal((await producto(SEC)).ofertas[0].precio, 21.95);

  // quitar la programada
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Quitar la oferta de Albóndigas" }).last().click();
  await page.locator("#aviso", { hasText: "Oferta quitada" }).waitFor();
  assert.equal((await producto(ALB)).ofertas.length, 1);

  // la ficha del producto solo resume y lleva a la pestaña
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Secreto ibérico");
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  const ficha = page.locator("#dlg-producto");
  assert.match(await ficha.locator(".ofertas").innerText(), /Activa hoy: rebaja a 21,95\s€ \(05\/10 al 11\/10\)/);
  assert.equal(await ficha.locator("#f-of-1-desde").count(), 0, "la ficha ya no edita ofertas");
  await ficha.getByRole("button", { name: "Crear o cambiar ofertas de este producto" }).click();
  assert.equal(await page.locator("#tab-ofertas").getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#of-buscar").inputValue(), "Secreto ibérico");
  assert.equal(await page.locator("#of-lista article").count(), 1, "filtrada por ese producto");
  // guardar la ficha no toca las ofertas
  await page.click("#tab-productos");
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  await ficha.locator("#f-descripcion").fill("Veteado de grasa, jugoso.");
  await ficha.getByRole("button", { name: "Guardar", exact: true }).click();
  await ficha.waitFor({ state: "hidden" });
  assert.equal((await producto(SEC)).ofertas.length, 1);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("regalo por compra: se configura en la pestaña Ofertas y la pestaña Tienda no lo pisa al guardar", async () => {
  const page = await entrar();
  await page.click("#tab-ofertas");
  assert.equal(await page.locator("#of-guardar-regalos").isDisabled(), true);
  await page.click("#of-anadir-regalo");
  await page.fill("#of-regalo-1-texto", "250 g de chorizo");
  await page.fill("#of-regalo-1-minimo", "30");
  await page.fill("#of-regalo-1-hasta", "2026-10-11");
  // un error se explica
  await page.fill("#of-regalo-1-minimo", "0");
  await page.click("#of-guardar-regalos");
  await page.locator("#of-regalos .errores").waitFor({ state: "visible" });
  assert.match(await page.locator("#of-regalos .errores").innerText(), /entre 1 y 10000/);
  await page.fill("#of-regalo-1-minimo", "30");
  await page.click("#of-guardar-regalos");
  await page.locator("#aviso", { hasText: "Regalos guardados" }).waitFor();
  const guardado = (await e.api.llamar("/datos")).datos.ajustes.tienda.regalos;
  assert.deepEqual(guardado, [{ regalo: "250 g de chorizo", minimo: 30, repetir: true, maximo: null, desde: null, hasta: "2026-10-11" }]);
  // la pestaña Tienda ya no tiene el bloque de regalos y, al guardarla, los regalos se quedan
  await page.click("#tab-tienda");
  assert.equal(await page.locator("#panel-tienda").getByText("Regalo por compra").count(), 0);
  await page.fill("#a-tienda-aviso", "Hoy hay oferta");
  await page.locator("#form-tienda button[type=submit]").click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  const despues = (await e.api.llamar("/datos")).datos.ajustes.tienda;
  assert.equal(despues.aviso, "Hoy hay oferta");
  assert.equal(despues.regalos.length, 1, "los regalos no se han perdido");
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("escaparate: «Ofertas de la semana» en la tienda y en la portada, con enlaces al producto", async () => {
  const tienda = await e.nuevaPagina({ ancho: 1280, alto: 900, tactil: false });
  await tienda.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await tienda.locator("#app").waitFor();
  const seccion = tienda.locator("#ofertas");
  await seccion.waitFor({ state: "visible" });
  assert.equal(await tienda.locator("#ofertas-titulo").innerText(), "Ofertas de la semana");
  assert.equal(await tienda.locator("#ofertas-lista .of-card").count(), 3, "3x2, rebaja y regalo");
  const textos = await tienda.locator("#ofertas-lista .of-card").allInnerTexts();
  const alb = textos.find((t) => /Albóndigas/.test(t));
  assert.match(alb, /3x2[\s\S]*Albóndigas[\s\S]*9,90\s€\/kg[\s\S]*Llévate 3 kg y paga 2 kg[\s\S]*Hasta el 11 de octubre/);
  const sec = tienda.locator("#ofertas-lista .of-card", { hasText: "Secreto ibérico" });
  assert.match(await sec.locator(".precio-tachado").textContent(), /29,95\s€\/kg/);
  assert.match(await sec.locator(".precio-oferta").textContent(), /21,95\s€\/kg/);
  assert.match(textos.find((t) => /Regalo/.test(t)), /Regalo[\s\S]*250 g de chorizo[\s\S]*Por cada 30,00\s€ de compra[\s\S]*Hasta el 11 de octubre/);
  assert.equal(await tienda.locator("#ofertas-visor, .ofertas-visor").first().getAttribute("tabindex"), null, "en escritorio es una rejilla: no hace falta desplazarla");
  // «Ir al producto» lleva a la tarjeta del producto y la destaca
  await sec.getByRole("link", { name: "Ir al producto: Secreto ibérico" }).click();
  const prod = tienda.locator('.prod[data-id="cerdo-iberico-secreto-iberico"]');
  await tienda.waitForFunction(() => document.querySelector('.prod[data-id="cerdo-iberico-secreto-iberico"]')?.classList.contains("resaltado"));
  const caja = await prod.boundingBox();
  assert.ok(caja.y >= 0 && caja.y + caja.height <= 900, "el producto queda a la vista");
  await tienda.context().close();

  // móvil: tarjetas que se deslizan, y la zona se alcanza con teclado
  const movil = await e.nuevaPagina({ ancho: 390, alto: 844 });
  await movil.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await movil.locator("#ofertas").waitFor({ state: "visible" });
  assert.equal(await movil.locator(".ofertas-visor").getAttribute("tabindex"), "0");
  assert.equal(await movil.locator(".ofertas-visor").evaluate((v) => v.scrollWidth > v.clientWidth), true);
  assert.ok(await movil.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin scroll horizontal de la página");
  await movil.context().close();

  // portada: mismo escaparate; «Pedir en la tienda» lleva al producto
  const portada = await e.nuevaPagina({ ancho: 1280, alto: 900, tactil: false });
  await portada.goto(e.url + "/", { waitUntil: "networkidle" });
  await portada.locator("#ofertas").waitFor({ state: "visible" });
  assert.equal(await portada.locator("#ofertas-titulo").innerText(), "Ofertas de la semana");
  assert.equal(await portada.locator("#ofertas-lista .of-card").count(), 3);
  const enlace = portada.locator("#ofertas-lista .of-card", { hasText: "Secreto ibérico" }).getByRole("link", { name: "Pedir en la tienda: Secreto ibérico" });
  assert.equal(await enlace.getAttribute("href"), "/tienda#p-cerdo-iberico-secreto-iberico");
  await enlace.click();
  await portada.waitForURL(/\/tienda#p-cerdo-iberico-secreto-iberico$/);
  await portada.waitForFunction(() => document.querySelector('.prod[data-id="cerdo-iberico-secreto-iberico"]')?.classList.contains("resaltado"));
  await portada.context().close();
});

test("escaparate: una sola cosa = «Oferta de la semana»; sin nada, no aparece; con la tienda cerrada, pide por WhatsApp", async () => {
  const poner = async (cambios) => {
    const a = structuredClone((await e.api.llamar("/datos")).datos.ajustes);
    cambios(a);
    assert.equal((await e.api.llamar("/ajustes", { metodo: "PUT", cuerpo: a })).estado, 200);
  };
  const ofertasDe = async (id, ofertas) => assert.equal((await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...(await producto(id)), ofertas } })).estado, 200);
  const abrir = async (ruta) => { const p = await e.nuevaPagina({ ancho: 1280, alto: 900, tactil: false }); await p.goto(e.url + ruta, { waitUntil: "networkidle" }); if (ruta === "/tienda") await p.waitForFunction(() => !document.getElementById("app").hidden || !document.getElementById("tienda-cerrada").hidden); return p; };

  // solo la rebaja del secreto
  await poner((a) => { a.tienda.regalos = []; });
  await ofertasDe(ALB, []);
  for (const ruta of ["/", "/tienda"]) {
    const p = await abrir(ruta);
    await p.locator("#ofertas").waitFor({ state: "visible" });
    assert.equal(await p.locator("#ofertas-titulo").innerText(), "Oferta de la semana", ruta);
    assert.equal(await p.locator("#ofertas-lista .of-card").count(), 1);
    await p.context().close();
  }

  // un producto agotado no se anuncia
  await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...(await producto(SEC)), agotado: true } });
  for (const ruta of ["/", "/tienda"]) {
    const p = await abrir(ruta);
    await p.waitForTimeout(500);
    assert.equal(await p.locator("#ofertas").isVisible(), false, `${ruta}: nada que enseñar`);
    await p.context().close();
  }
  await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...(await producto(SEC)), agotado: false } });

  // fuera de fechas (la oferta ya terminó): tampoco
  await ofertasDe(SEC, [{ tipo: "precio", desde: "2026-09-01", hasta: "2026-09-07", precio: 21.95 }]);
  const pasada = await abrir("/");
  await pasada.waitForTimeout(500);
  assert.equal(await pasada.locator("#ofertas").isVisible(), false);
  await pasada.context().close();

  // con la tienda cerrada, la portada manda a WhatsApp
  await ofertasDe(SEC, [{ tipo: "precio", desde: "2026-10-05", hasta: "2026-10-11", precio: 21.95 }]);
  await poner((a) => { a.tienda.activa = false; });
  const cerrada = await abrir("/");
  await cerrada.locator("#ofertas").waitFor({ state: "visible" });
  const href = await cerrada.locator("#ofertas-lista .of-card a").first().getAttribute("href");
  assert.match(href, /^https:\/\/wa\.me\/34\d{9}\?text=/);
  assert.match(decodeURIComponent(href), /oferta de Secreto ibérico/);
  await cerrada.context().close();
  await poner((a) => { a.tienda.activa = true; });
});
