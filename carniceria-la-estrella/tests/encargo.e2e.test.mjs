// Pruebas de navegador: productos «por encargo» (tienda, carrito, pedido y panel) y mensaje de WhatsApp visual.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarEntorno, PASSWORD } from "./ayuda/entorno.mjs";

let e;
before(async () => { e = await arrancarEntorno(); });
after(async () => { await e?.parar(); });

const errores = (page) => page.consola.filter((m) => !/Service Worker registration blocked|status of 401|status of 400/.test(m));
const producto = async (id) => (await e.api.llamar("/datos")).datos.productos.find((p) => p.id === id);
const fila = (page, nombre) => page.locator(".prod", { has: page.getByRole("heading", { name: nombre, exact: true }) });
const COCHI = "cerdo-cochinillo-por-encargo";
const SOL = "vacuno-solomillo-de-ternera";

test("por encargo: se marca en la ficha, la tienda lo enseña con su aviso y se puede pedir aunque esté agotado", async () => {
  // El cochinillo ya se llama «(por encargo)»: cuenta sin tocar nada; se le pone precio y se marca agotado (sin stock)
  const c = await producto(COCHI);
  assert.equal((await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...c, precio: 70, agotado: true } })).estado, 200);
  // Un producto normal agotado sigue siendo agotado
  const s = await producto(SOL);
  assert.equal((await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...s, agotado: true } })).estado, 200);

  const page = await e.nuevaPagina();
  await page.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await page.locator("#app").waitFor();
  const cochi = fila(page, "Cochinillo (por encargo)");
  assert.match(await cochi.locator(".prod-encargo").textContent(), /^Por encargo El precio es orientativo y te lo confirmamos antes de hacer el encargo\.$/);
  assert.equal(await cochi.locator(".prod-agotado").count(), 0, "no pone «Agotado»");
  const boton = cochi.locator(".btn-anadir");
  assert.equal((await boton.textContent()).trim(), "Encargar");
  assert.match(await boton.getAttribute("aria-label"), /^Encargar Cochinillo \(por encargo\), por encargo$/);
  const solomillo = fila(page, "Solomillo de ternera");
  assert.match(await solomillo.locator(".prod-agotado").textContent(), /Agotado por ahora/);
  assert.equal(await solomillo.locator(".btn-anadir").count(), 0, "lo agotado de verdad no se puede pedir");

  await boton.click();
  assert.match(await page.locator("#lineas .linea-encargo").textContent(), /Por encargo: el precio es orientativo y te lo confirmamos antes de hacer el encargo\./);
  assert.match(await page.locator("#totales").textContent(), /1 producto por encargo: su precio es orientativo/);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("por encargo: el pedido lo guarda marcado y el mensaje de WhatsApp sale visual, con «PEDIDO WEB» y el aviso del encargo", async () => {
  const page = await e.nuevaPagina();
  await page.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await page.locator("#app").waitFor();
  await fila(page, "Cochinillo (por encargo)").locator(".btn-anadir").click();
  await page.fill("#nombre", "Lola Pérez");
  await page.fill("#telefono", "600 11 22 33");
  await page.check("input[name=entrega][value=recogida]");
  await page.selectOption("#dia", { index: 2 });
  await page.selectOption("#franja", { index: 1 });
  await page.check("input[name=pago][value=efectivo]");
  assert.equal((await page.locator("#enviar").innerText()).trim(), "Enviar pedido con obligación de pago");
  await page.click("#enviar");
  await page.locator("#confirmacion").waitFor({ state: "visible" });
  const href = await page.locator("#confirmacion a.btn").getAttribute("href");
  const texto = decodeURIComponent(href.split("?text=")[1]);
  assert.match(texto, /^👋 Hola, soy Lola Pérez\. Este es mi pedido hecho desde la web:/);
  assert.match(texto, /🛒 \*PEDIDO WEB · LE-\d{4}-\d{4}\*/);
  assert.match(texto, /📞 \*Teléfono:\* 600 11 22 33/);
  assert.match(texto, /🏪 \*Recogida en tienda\*/);
  assert.match(texto, /▪️ 1 ud · \*Cochinillo \(por encargo\)\*( \([^)]*\))? · 70,00\s€/);
  assert.match(texto, /📦 \*POR ENCARGO\* · precio orientativo, a confirmar antes de encargarlo/);
  assert.match(texto, /📦 El producto por encargo: me confirmáis el precio antes de hacer el encargo\./);
  assert.match(texto, /✅ Enviado desde la web de Carnicería La Estrella$/);
  // En el servidor el pedido queda marcado
  const { datos } = await e.api.llamar("/pedidos");
  const pedido = datos.pedidos.find((p) => p.cliente.nombre === "Lola Pérez");
  assert.equal(pedido.porEncargo, 1);
  assert.equal(pedido.lineas[0].porEncargo, true);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("por encargo: en el panel hay una casilla en la ficha, una etiqueta en la lista y se ve en el pedido", async () => {
  const page = await e.nuevaPagina();
  await page.goto(e.url + "/admin/", { waitUntil: "networkidle" });
  await page.fill("#password", PASSWORD);
  await page.click("#acceso-enviar");
  await page.locator("#panel").waitFor();
  await page.waitForLoadState("networkidle");
  // La tarjeta del pedido avisa
  await page.locator("#panel-pedidos .pedido").first().waitFor();
  assert.match(await page.locator("#panel-pedidos").textContent(), /POR ENCARGO \(confirmar precio\)/);
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Cochinillo");
  const filaProd = page.locator(".prod-fila").first();
  await filaProd.waitFor();
  assert.match(await filaProd.textContent(), /Por encargo/);
  assert.doesNotMatch(await filaProd.locator(".mini").allTextContents().then((t) => t.join("|")), /Agotado/, "por encargo sustituye a «Agotado» en la etiqueta");
  await filaProd.getByRole("button", { name: /Editar/ }).click();
  const dlg = page.locator("#dlg-producto");
  assert.equal(await dlg.locator("#f-encargo").isChecked(), true, "se marca solo porque su nombre ya lo dice");
  await dlg.locator("#f-encargo").uncheck();
  await dlg.locator("#f-nombre").fill("Cochinillo entero");
  await dlg.getByRole("button", { name: "Guardar", exact: true }).click();
  await dlg.waitFor({ state: "hidden" });
  assert.equal((await producto(COCHI)).porEncargo, false);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});
