// Pruebas de navegador: alérgenos visibles antes de comprar (tienda) y chips en la ficha del producto (panel).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarEntorno, PASSWORD } from "./ayuda/entorno.mjs";

let e;
before(async () => { e = await arrancarEntorno(); });
after(async () => { await e?.parar(); });

const errores = (page) => page.consola.filter((m) => !/Service Worker registration blocked|status of 401|status of 400/.test(m));
const producto = async (id) => (await e.api.llamar("/datos")).datos.productos.find((p) => p.id === id);
const fila = (page, nombre) => page.locator(".prod", { has: page.getByRole("heading", { name: nombre, exact: true }) });

test("tienda: los alérgenos indicados salen en la tarjeta; lo que suele llevarlos y no está revisado dice «consúltanos»; la carne fresca no dice nada", async () => {
  const alb = await producto("elaborados-albondigas");
  assert.equal((await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...alb, alergenos: ["Cereales con gluten", "Huevos"], alergenosRevisados: true } })).estado, 200);
  const sj = await producto("elaborados-san-jacobos");
  assert.equal((await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...sj, alergenos: [], alergenosRevisados: true } })).estado, 200);
  const page = await e.nuevaPagina();
  await page.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await page.locator("#app").waitFor();
  assert.equal((await fila(page, "Albóndigas").locator(".prod-alergenos").textContent()).trim(), "Alérgenos: Cereales con gluten, Huevos");
  assert.equal((await fila(page, "San Jacobos").locator(".prod-alergenos").textContent()).trim(), "Sin alérgenos declarados");
  assert.match(await fila(page, "Flamenquines").locator(".prod-alergenos").textContent(), /Alérgenos: consúltanos antes de pedir/);
  assert.equal(await fila(page, "Solomillo de ternera").locator(".prod-alergenos").count(), 0);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("panel: los botones de la lista oficial rellenan el campo, «revisado» se guarda y la lista de comprobación avisa de lo pendiente", async () => {
  const page = await e.nuevaPagina();
  await page.goto(e.url + "/admin/", { waitUntil: "networkidle" });
  await page.fill("#password", PASSWORD);
  await page.click("#acceso-enviar");
  await page.locator("#panel").waitFor();
  await page.waitForLoadState("networkidle");
  await page.click("#tab-estado");
  await page.locator("#lista-comprobacion li").first().waitFor();
  assert.match(await page.locator("#lista-comprobacion").innerText(), /productos \(elaborados, embutidos, quesos, salsas, vino…\) sin alérgenos revisados/);

  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Queso manchego");
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  const dlg = page.locator("#dlg-producto");
  const leche = dlg.getByRole("button", { name: "Leche", exact: true });
  assert.equal(await leche.getAttribute("aria-pressed"), "false");
  await leche.click();
  assert.equal(await leche.getAttribute("aria-pressed"), "true");
  assert.equal(await dlg.locator("#f-alergenos").inputValue(), "Leche");
  await dlg.getByRole("button", { name: "Sulfitos", exact: true }).click();
  assert.equal(await dlg.locator("#f-alergenos").inputValue(), "Leche, Sulfitos");
  await leche.click(); // pulsar otra vez lo quita
  assert.equal(await dlg.locator("#f-alergenos").inputValue(), "Sulfitos");
  await dlg.locator("#f-alergenos").fill("leche");
  assert.equal(await leche.getAttribute("aria-pressed"), "true", "lo escrito a mano también marca el botón");
  await dlg.locator("#f-alergenos-rev").check();
  await dlg.getByRole("button", { name: "Guardar", exact: true }).click();
  await dlg.waitFor({ state: "hidden" });
  const p = await producto("quesos-queso-manchego");
  assert.deepEqual(p.alergenos, ["leche"]);
  assert.equal(p.alergenosRevisados, true);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});
