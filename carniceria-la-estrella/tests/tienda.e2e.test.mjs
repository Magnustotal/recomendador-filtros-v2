// Pruebas de navegador de la tienda (Chromium real + servidor local con funciones y blobs).
// Reloj fijo: lunes 5 de octubre de 2026, 09:00 en Madrid.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarEntorno } from "./ayuda/entorno.mjs";

let e;
before(async () => { e = await arrancarEntorno(); });
after(async () => { await e?.parar(); });

const errores = (page) => page.consola.filter((m) => !/Service Worker registration blocked/.test(m));
async function abrir(opciones) {
  const page = await e.nuevaPagina(opciones);
  await page.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await page.locator("#app").waitFor();
  return page;
}
const fila = (page, nombre) => page.locator(".prod", { has: page.getByRole("heading", { name: nombre, exact: true }) });

test("la tienda carga el catálogo, con categorías y sin errores en consola", async () => {
  const page = await abrir();
  assert.ok((await page.locator(".prod").count()) > 200);
  assert.ok((await page.locator("#chips .chip").count()) >= 10);
  assert.equal(await page.locator("#chips .chip[aria-pressed=true]").innerText(), "Todo");
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("los chips de categoría llevan a la sección aunque esté lejos (content-visibility)", async () => {
  const page = await abrir({ ancho: 390 });
  for (const nombre of ["Vino", "Pollo", "Cordero y cabrito"]) {
    await page.locator("#chips .chip", { hasText: new RegExp(`^${nombre}$`) }).click();
    await page.waitForTimeout(1200); // fin del desplazamiento suave
    const id = await page.locator("#chips .chip[aria-pressed=true]").getAttribute("data-cat");
    const caja = await page.locator(`#cat-${id}`).boundingBox();
    assert.ok(caja.y >= 0 && caja.y < 400, `${nombre}: el título quedó en y=${Math.round(caja.y)}`);
  }
  await page.context().close();
});

test("el buscador ignora acentos y mayúsculas", async () => {
  const page = await abrir();
  await page.fill("#buscar", "CASQUERIA higado");
  const visibles = await page.locator(".prod:not([hidden])").count();
  assert.ok(visibles >= 1 && visibles < 10, `visibles: ${visibles}`);
  await page.fill("#buscar", "zzzzzz");
  assert.equal(await page.locator("#sin-resultados").isVisible(), true);
  await page.context().close();
});

test("añadir con opción y cantidad, calcular el total y conservar el pedido al recargar", async () => {
  const page = await abrir();
  const f = fila(page, "Solomillo de ternera");
  await f.locator("select").selectOption("Fileteado");
  await f.getByRole("button", { name: "Más Solomillo de ternera" }).click(); // 250 -> 500 g
  assert.equal(await f.locator("output").innerText(), "500 g");
  await f.getByRole("button", { name: "Añadir Solomillo de ternera al pedido" }).click();
  assert.equal(await page.locator("#formulario").isVisible(), true);
  const linea = page.locator(".linea").first();
  assert.match(await linea.innerText(), /Solomillo de ternera/);
  assert.match(await linea.innerText(), /Fileteado/);
  assert.match(await linea.innerText(), /14,95/); // 29,90 €/kg x 0,5 kg
  assert.match(await page.locator("#totales").innerText(), /Total estimado/);
  assert.match(await page.locator(".mobile-action-bar a:last-child").innerText(), /Mi pedido \(1\)/);

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#app").waitFor();
  assert.equal(await page.locator(".linea").count(), 1);
  await page.context().close();
});

test("un producto sin precio se añade como 'Consultar' y el pedido lo avisa", async () => {
  const page = await abrir();
  await fila(page, "Morcillo de ternera").getByRole("button", { name: /Añadir/ }).click();
  assert.match(await page.locator(".linea").first().innerText(), /Consultar/);
  assert.match(await page.locator("#totales").innerText(), /sin precio/);
  await page.context().close();
});

test("días y franjas: hoy solo con antelación, sin domingos, y la tarjeta solo en recogida", async () => {
  const page = await abrir();
  await fila(page, "Solomillo de ternera").getByRole("button", { name: /Añadir/ }).click();
  await page.check("input[name=entrega][value=recogida]");
  const dias = await page.locator("#dia option").allInnerTexts();
  assert.match(dias[1], /Hoy, lunes/);
  assert.ok(!dias.some((d) => /domingo/.test(d)), "no debe ofrecer domingos");
  await page.selectOption("#dia", { index: 1 });
  const franjas = await page.locator("#franja option").allInnerTexts();
  assert.ok(!franjas.some((f) => f.startsWith("09:00")), "la de las 09:00 ya no admite pedidos (antelación)");
  assert.ok(franjas.some((f) => f.startsWith("11:00")));
  assert.equal(await page.locator("input[name=pago][value=tarjeta]").count(), 1);
  await page.check("input[name=entrega][value=reparto]");
  assert.equal(await page.locator("input[name=pago][value=tarjeta]").count(), 0);
  assert.equal(await page.locator("#campo-direccion").isVisible(), true);
  await page.context().close();
});

test("enviar con datos vacíos muestra errores accesibles y no envía nada", async () => {
  const page = await abrir();
  await fila(page, "Solomillo de ternera").getByRole("button", { name: /Añadir/ }).click();
  await page.click("#enviar");
  assert.equal(await page.locator("#errores").isVisible(), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), "errores");
  assert.equal(await page.locator("#nombre").getAttribute("aria-invalid"), "true");
  assert.match(await page.locator("#error-nombre").innerText(), /nombre/i);
  const { datos } = await e.api.llamar("/pedidos");
  assert.equal(datos.pedidos.length, 0);
  await page.context().close();
});

test("pedido completo de recogida: se guarda con número y el botón abre WhatsApp con el resumen", async () => {
  const page = await abrir();
  await fila(page, "Solomillo de ternera").getByRole("button", { name: /Añadir/ }).click();
  await page.fill("#nombre", "Lola Pérez");
  await page.fill("#telefono", "600 11 22 33");
  await page.check("input[name=entrega][value=recogida]");
  await page.selectOption("#dia", { index: 2 }); // mañana
  await page.selectOption("#franja", { index: 1 });
  await page.check("input[name=pago][value=efectivo]");
  await page.fill("#comentarios", "Sin grasa, por favor");
  await page.click("#enviar");
  await page.locator("#confirmacion").waitFor({ state: "visible" });
  assert.match(await page.locator("#confirmacion .numero").innerText(), /^LE-2610-0001$/);
  const href = await page.locator("#confirmacion a.btn").getAttribute("href");
  assert.match(href, /^https:\/\/wa\.me\/34601006290\?text=/);
  const texto = decodeURIComponent(href.split("?text=")[1]);
  assert.match(texto, /Lola Pérez/);
  assert.match(texto, /Solomillo de ternera: 250 g/);
  assert.match(texto, /LE-2610-0001/);
  assert.equal(await page.locator("#formulario").isVisible(), false);
  // el carrito se vacía tras confirmar
  assert.equal(await page.evaluate(() => localStorage.getItem("ls_pedido_v1")), "[]");
  // y el pedido está guardado en el servidor, con el precio calculado por el servidor
  const { datos } = await e.api.llamar("/pedidos");
  assert.equal(datos.pedidos.length, 1);
  assert.equal(datos.pedidos[0].totalCent, 748); // 29,90 x 0,25 = 7,475 -> 7,48
  assert.equal(datos.pedidos[0].cliente.telefono, "600112233");
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("el reparto suma el envío y pide dirección; sin vino no se pide la mayoría de edad", async () => {
  const page = await abrir();
  assert.equal(await page.locator("#campo-edad").isVisible(), false, "con el pedido vacío no debe verse");
  await fila(page, "Pechuga de pollo").getByRole("button", { name: /Añadir/ }).click();
  assert.equal(await page.locator("#campo-edad").isVisible(), false);
  await page.check("input[name=entrega][value=reparto]");
  assert.equal(await page.locator("#campo-direccion").isVisible(), true);
  assert.match(await page.locator("#totales").innerText(), /Envío\s*3,00/);
  assert.match(await page.locator("#totales").innerText(), /Pedido mínimo: 15,00/); // 1 pechuga (250 g) = 1,63 €
  await page.context().close();
});

test("el vino exige la casilla de mayor de 18 años, también en el servidor", async () => {
  const page = await abrir();
  await fila(page, "Vino tinto crianza").getByRole("button", { name: /Añadir/ }).click();
  assert.equal(await page.locator("#campo-edad").isVisible(), true);
  await page.fill("#nombre", "Ana");
  await page.fill("#telefono", "611223344");
  await page.check("input[name=entrega][value=recogida]");
  await page.selectOption("#dia", { index: 2 });
  await page.selectOption("#franja", { index: 1 });
  await page.check("input[name=pago][value=bizum]");
  await page.click("#enviar");
  assert.match(await page.locator("#error-mayorEdad").innerText(), /18/);
  assert.equal(await page.locator("#confirmacion").isVisible(), false);
  // Si alguien se salta el navegador, el servidor también lo rechaza
  const r = await fetch(e.url + "/api/pedido", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    lineas: [{ id: "vino-vino-tinto-crianza", opcion: "", nota: "", cantidad: 1 }], cliente: { nombre: "Ana", telefono: "611223344" },
    entrega: { tipo: "recogida", dia: "2026-10-06", franja: "11:00-13:00" }, pago: "bizum", comentarios: "", mayorEdad: false, web: "" }) });
  assert.equal(r.status, 400);
  assert.ok((await r.json()).errores.some((x) => x.campo === "mayorEdad"));
  // con la casilla marcada, el pedido se guarda
  await page.check("#mayor-edad");
  await page.click("#enviar");
  await page.locator("#confirmacion").waitFor({ state: "visible" });
  assert.match(await page.locator("#confirmacion .numero").innerText(), /^LE-2610-0002$/);
  await page.context().close();
});

test("mientras carga, la tienda no enseña la lista ni el pedido vacío", async () => {
  const page = await e.nuevaPagina();
  await page.route("**/api/catalogo", async (ruta) => { await new Promise((r) => setTimeout(r, 800)); await ruta.continue(); });
  await page.goto(e.url + "/tienda", { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("#app").isVisible(), false);
  assert.match(await page.locator("#estado").innerText(), /Cargando/);
  await page.locator("#app").waitFor();
  assert.equal(await page.locator("#estado").isVisible(), false);
  await page.context().close();
});

test("si el catálogo falla, se explica y se ofrece otra vía", async () => {
  const page = await e.nuevaPagina();
  await page.route("**/api/catalogo", (ruta) => ruta.fulfill({ status: 500, body: "{}" }));
  await page.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  assert.match(await page.locator("#estado").innerText(), /No hemos podido cargar/);
  assert.equal(await page.locator("#app").isVisible(), false);
  await page.context().close();
});

for (const ancho of [320, 390, 768, 1280]) {
  test(`sin scroll horizontal a ${ancho}px (lista, carrito y formulario)`, async () => {
    const page = await abrir({ ancho, alto: 800, tactil: ancho < 900 });
    await fila(page, "Solomillo de ternera").getByRole("button", { name: /Añadir/ }).click();
    await page.check("input[name=entrega][value=reparto]");
    const { ancho: total, visible } = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, visible: document.documentElement.clientWidth }));
    assert.ok(total <= visible, `scrollWidth ${total} > ${visible}`);
    await page.context().close();
  });
}

test("objetivos táctiles de al menos 44 px en botones de cantidad, chips y botones principales", async () => {
  const page = await abrir({ ancho: 390 });
  await fila(page, "Solomillo de ternera").getByRole("button", { name: /Añadir/ }).click();
  const pequenos = await page.evaluate(() => {
    const malos = [];
    for (const n of document.querySelectorAll("#main button, #main .chip, #main input[type=search], #main select, #main .opcion")) {
      const r = n.getBoundingClientRect();
      if (r.width && r.height && (r.height < 44 || r.width < 44)) malos.push(`${n.tagName}.${n.className} ${Math.round(r.width)}x${Math.round(r.height)} ${n.textContent.trim().slice(0, 20)}`);
    }
    return malos;
  });
  assert.deepEqual(pequenos, []);
  await page.context().close();
});
