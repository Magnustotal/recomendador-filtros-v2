// Pruebas de navegador del panel de administración.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarEntorno, PASSWORD } from "./ayuda/entorno.mjs";
import { pngRuido } from "./ayuda/png.mjs";

let e;
before(async () => { e = await arrancarEntorno({ modificar: (a) => { a.tienda.redondeo = 90; } }); });
after(async () => { await e?.parar(); });

// El 401 de la comprobación de sesión (y de una contraseña mala) es esperado: el navegador lo anota como error de red.
const errores = (page) => page.consola.filter((m) => !/Service Worker registration blocked|status of 401/.test(m));
async function entrar(opciones) {
  const page = await e.nuevaPagina(opciones);
  await page.goto(e.url + "/admin/", { waitUntil: "networkidle" });
  await page.fill("#password", PASSWORD);
  await page.click("#acceso-enviar");
  await page.locator("#panel").waitFor();
  await page.waitForLoadState("networkidle");
  return page;
}
const pedido = (extra = {}) => ({
  lineas: [{ id: "vacuno-solomillo-de-ternera", opcion: "Fileteado", nota: "fino", cantidad: 500 }],
  cliente: { nombre: "Marta Ruiz", telefono: "655443322" },
  entrega: { tipo: "recogida", dia: "2026-10-06", franja: "11:00-13:00" }, pago: "efectivo", comentarios: "Gracias", mayorEdad: false, web: "", ...extra,
});
async function hacerPedido(cuerpo = pedido()) {
  const r = await fetch(e.url + "/api/pedido", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  assert.equal(r.status, 201, JSON.stringify(await r.clone().json()));
  return (await r.json()).numero;
}

test("sin sesión se ve el acceso; contraseña mala = error; buena = panel", async () => {
  const page = await e.nuevaPagina();
  await page.goto(e.url + "/admin/", { waitUntil: "networkidle" });
  assert.equal(await page.locator("#acceso").isVisible(), true);
  assert.equal(await page.locator("#panel").isVisible(), false);
  assert.equal(await page.locator("#acceso-error").isVisible(), false, "sin aviso de sesión caducada en la primera visita");
  await page.fill("#password", "mala");
  await page.click("#acceso-enviar");
  await page.locator("#acceso-error").waitFor({ state: "visible" });
  assert.match(await page.locator("#acceso-error").innerText(), /incorrecta/);
  await page.fill("#password", PASSWORD);
  await page.click("#acceso-enviar");
  await page.locator("#panel").waitFor();
  assert.equal(await page.locator("#tab-pedidos").getAttribute("aria-selected"), "true");
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("el panel no se indexa ni se cachea", async () => {
  const r = await fetch(e.url + "/admin/");
  assert.match(r.headers.get("x-robots-tag"), /noindex/);
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.match(await r.text(), /<meta name="robots" content="noindex, nofollow">/);
});

test("pedidos: aparece el nuevo, cambia de estado, guarda la nota interna y muestra el contador", async () => {
  const numero = await hacerPedido();
  const page = await entrar();
  const tarjeta = page.locator(".pedido", { hasText: numero });
  await tarjeta.waitFor();
  assert.match(await tarjeta.innerText(), /Marta Ruiz/);
  assert.match(await tarjeta.innerText(), /Solomillo de ternera · 500 g · Fileteado/);
  assert.match(await tarjeta.innerText(), /fino/);
  assert.match(await page.locator("#contador-nuevos").innerText(), /^1$/);
  assert.match(await page.title(), /^\(1\)/);
  assert.equal(await tarjeta.locator("a", { hasText: "WhatsApp" }).getAttribute("href"), "https://wa.me/34655443322");

  await tarjeta.locator("select").selectOption("confirmado");
  await page.locator("#aviso:not([hidden])").waitFor();
  await tarjeta.locator("textarea").fill("Llamar antes de preparar");
  await tarjeta.locator("textarea").blur();
  await page.waitForTimeout(300);
  const { datos } = await e.api.llamar("/pedidos");
  const guardado = datos.pedidos.find((p) => p.numero === numero);
  assert.equal(guardado.estado, "confirmado");
  assert.equal(guardado.notaInterna, "Llamar antes de preparar");
  assert.equal(await page.locator("#contador-nuevos").isVisible(), false);
  await page.context().close();
});

test("seguridad: el texto malicioso de un pedido se muestra como texto en el panel (sin XSS)", async () => {
  const veneno = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
  await hacerPedido(pedido({ cliente: { nombre: "Eve <img src=x onerror=window.__xss=1>", telefono: "677000111" }, comentarios: veneno, lineas: [{ id: "vacuno-solomillo-de-ternera", opcion: "", nota: veneno, cantidad: 250 }] }));
  const page = await entrar();
  const tarjeta = page.locator(".pedido", { hasText: "Eve" });
  await tarjeta.waitFor();
  assert.match(await tarjeta.innerText(), /<img src=x/);
  assert.equal(await tarjeta.locator("img").count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  // y en el CSV las fórmulas quedan neutralizadas
  const csv = await page.evaluate(async () => (await fetch("/api/admin/pedidos.csv")).text());
  assert.ok(!/;"=/.test(csv));
  await page.context().close();
});

test("pedidos: el filtro por estado y la búsqueda funcionan; el CSV se descarga con sesión", async () => {
  await hacerPedido(pedido({ cliente: { nombre: "Pedro Gil", telefono: "611000111" } }));
  const page = await entrar();
  await page.locator(".pedido").first().waitFor();
  assert.equal(await page.locator(".pedido").count(), 3);
  await page.getByRole("button", { name: /^Nuevos/ }).click();
  assert.equal(await page.locator(".pedido").count(), 2); // Marta ya está confirmada; quedan Eve y Pedro
  await page.getByRole("button", { name: /^Todos/ }).click();
  await page.fill("#pedidos-buscar", "marta");
  assert.equal(await page.locator(".pedido").count(), 1);
  const r = await page.evaluate(async () => { const x = await fetch("/api/admin/pedidos.csv"); return { estado: x.status, tipo: x.headers.get("content-type") }; });
  assert.equal(r.estado, 200);
  assert.match(r.tipo, /text\/csv/);
  await page.context().close();
});

test("productos: precio por kilo con redondeo ,90 y agotado se guardan al momento", async () => {
  const page = await entrar();
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "morcillo de ternera");
  const fila = page.locator(".prod-fila").first();
  const precio = fila.locator("input[type=text]");
  await precio.fill("11,31");
  await precio.blur();
  await fila.locator(".fila-estado", { hasText: "Guardado" }).waitFor();
  assert.equal(await precio.inputValue(), "11,90");
  await fila.getByLabel("Agotado").check();
  await page.waitForTimeout(300);
  const { datos } = await e.api.llamar("/datos");
  const p = datos.productos.find((x) => x.id === "vacuno-morcillo-de-ternera");
  assert.equal(p.precio, 11.9);
  assert.equal(p.agotado, true);
  // un precio inválido no se guarda y se avisa
  await precio.fill("abc");
  await precio.blur();
  await page.locator("#aviso.es-error").waitFor();
  assert.equal(await precio.inputValue(), "11,90");
  await page.context().close();
});

test("productos: crear con foto pesada (se reduce), ver la foto en la tienda y borrar", async () => {
  const page = await entrar();
  await page.click("#tab-productos");
  await page.click("#prod-nuevo");
  const dlg = page.locator("#dlg-producto");
  await dlg.locator("#f-nombre").fill("Hamburguesa de la casa");
  await dlg.locator("#f-categoria").selectOption("elaborados");
  await dlg.locator("#f-precio").fill("9,5");
  await dlg.locator("#f-opciones").fill("Normal\nGrande");
  const png = pngRuido(1600, 1200);
  assert.ok(png.length > 4_000_000, "la foto de prueba debe ser pesada");
  await dlg.locator("#f-foto").setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: png });
  await dlg.getByText("Foto subida").waitFor();
  await dlg.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("#aviso", { hasText: "añadido" }).waitFor();
  const { datos } = await e.api.llamar("/datos");
  const p = datos.productos.find((x) => x.nombre === "Hamburguesa de la casa");
  assert.ok(p, "creado");
  assert.equal(p.precio, 9.9, "redondeo ,90");
  assert.deepEqual(p.opciones, ["Normal", "Grande"]);
  assert.ok(p.foto);
  const f = await fetch(`${e.url}/api/foto/${p.foto}`);
  assert.equal(f.headers.get("content-type"), "image/jpeg");
  const bytes = (await f.arrayBuffer()).byteLength;
  assert.ok(bytes < 700 * 1024 && bytes > 5_000, `foto de ${bytes} bytes`);

  // se ve en la tienda con su foto
  const tienda = await e.nuevaPagina();
  await tienda.goto(e.url + "/tienda", { waitUntil: "networkidle" });
  await tienda.fill("#buscar", "Hamburguesa de la casa");
  const img = tienda.locator(".prod:not([hidden])", { has: tienda.getByRole("heading", { name: "Hamburguesa de la casa" }) }).locator("img");
  await img.scrollIntoViewIfNeeded(); // las fotos se cargan al acercarse (loading=lazy)
  await img.evaluate((i) => new Promise((ok) => (i.complete ? ok() : i.addEventListener("load", ok))));
  assert.ok(await img.evaluate((i) => i.naturalWidth > 0));
  await tienda.context().close();

  // sustituir la foto borra la anterior; quitar el producto, también
  await page.fill("#prod-buscar", "hamburguesa de la casa");
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  await dlg.getByRole("button", { name: "Quitar foto" }).click();
  await dlg.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  assert.equal((await fetch(`${e.url}/api/foto/${p.foto}`)).status, 404, "la foto quitada se borra");
  page.on("dialog", (d) => d.accept()); // «¿Eliminar este producto?»
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  await dlg.getByRole("button", { name: "Eliminar producto" }).click();
  await page.locator("#aviso", { hasText: "eliminado" }).waitFor();
  assert.ok(!(await e.api.llamar("/datos")).datos.productos.some((x) => x.nombre === "Hamburguesa de la casa"));
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("productos: un error de validación se explica con el nombre del campo", async () => {
  const page = await entrar();
  await page.click("#tab-productos");
  await page.click("#prod-nuevo");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("#dlg-producto .errores").waitFor({ state: "visible" });
  assert.match(await page.locator("#dlg-producto .errores").innerText(), /Nombre: Es obligatorio/);
  await page.keyboard.press("Escape");
  await page.context().close();
});

test("tienda: guardar ajustes, añadir franja, y errores claros", async () => {
  const page = await entrar();
  await page.click("#tab-tienda");
  await page.fill("#a-tienda-aviso", "Esta semana no hay reparto el viernes");
  await page.fill("#a-tienda-reparto-coste", "2,5");
  await page.fill('[id="tienda.reparto.franjas-d"]', "16:00");
  await page.fill('[id="tienda.reparto.franjas-h"]', "18:00");
  await page.locator("#form-tienda .campo-grupo", { hasText: "Reparto a domicilio" }).getByRole("button", { name: "Añadir franja" }).click();
  assert.equal(await page.locator("#sin-guardar").isVisible(), true);
  await page.fill("#a-tienda-pedidoMinimo", "abc");
  await page.locator("#form-tienda button[type=submit]").click();
  await page.locator("#errores-tienda").waitFor({ state: "visible" });
  assert.match(await page.locator("#errores-tienda").innerText(), /Pedido mínimo \(€, opcional\): Debe ser un número/);
  assert.equal(await page.locator("#a-tienda-pedidoMinimo").getAttribute("aria-invalid"), "true");
  await page.fill("#a-tienda-pedidoMinimo", "10");
  await page.locator("#form-tienda button[type=submit]").click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  assert.equal(await page.locator("#sin-guardar").isVisible(), false);
  const a = (await e.api.llamar("/datos")).datos.ajustes.tienda;
  assert.equal(a.aviso, "Esta semana no hay reparto el viernes");
  assert.equal(a.reparto.coste, 2.5);
  assert.equal(a.pedidoMinimo, 10);
  assert.ok(a.reparto.franjas.includes("16:00-18:00"));
  // y la tienda pública lo refleja
  const c = await (await fetch(e.url + "/api/catalogo")).json();
  assert.equal(c.ajustes.tienda.aviso, "Esta semana no hay reparto el viernes");
  await page.context().close();
});

test("negocio: al guardar, la portada, el JSON-LD y el mapa se regeneran con los datos nuevos", async () => {
  const page = await entrar();
  await page.click("#tab-negocio");
  await page.fill("#a-negocio-nombre", "Carnicería Nueva Estrella");
  await page.fill("#a-negocio-telefono", "955 12 34 56");
  await page.fill("#a-negocio-lat", "37.5");
  await page.fill("#a-negocio-lng", "-5.9");
  await page.fill("#a-seo-dominio", "https://nuevaestrella.es");
  await page.fill("#a-seo-titulo", "Nueva Estrella | Carnicería en Sevilla");
  await page.locator("#form-negocio button[type=submit]").click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  const html = await (await fetch(e.url + "/")).text();
  assert.match(html, /<title>Nueva Estrella \| Carnicería en Sevilla<\/title>/);
  assert.match(html, /"telephone":\s*"\+34955123456"/);
  assert.match(html, /maps\?q=37\.5,-5\.9/);
  assert.match(html, /<link rel="canonical" href="https:\/\/nuevaestrella\.es\/">/);
  assert.match(await (await fetch(e.url + "/sitemap.xml")).text(), /https:\/\/nuevaestrella\.es\/tienda/);
  await page.context().close();
});

test("negocio: el horario se edita por tramos y días", async () => {
  const page = await entrar();
  await page.click("#tab-negocio");
  const antes = await page.locator("#form-negocio .tramo").count();
  await page.getByRole("button", { name: "Añadir tramo" }).click();
  const nuevo = page.locator("#form-negocio .tramo").nth(antes);
  await nuevo.getByRole("button", { name: "domingo" }).click();
  await nuevo.locator("input[type=time]").nth(0).fill("10:00");
  await nuevo.locator("input[type=time]").nth(1).fill("13:00");
  await page.locator("#form-negocio button[type=submit]").click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  const h = (await e.api.llamar("/datos")).datos.ajustes.horario;
  assert.deepEqual(h.at(-1), { dias: [1, 2, 3, 4, 5, 7], abre: "10:00", cierra: "13:00" });
  await page.context().close();
});

test("estado: lista de comprobación y comprobación del servidor", async () => {
  const page = await entrar();
  await page.click("#tab-estado");
  assert.ok((await page.locator("#lista-comprobacion li").count()) >= 5);
  assert.match(await page.locator("#lista-comprobacion").innerText(), /Razón social y NIF/);
  await page.click("#diagnostico");
  await page.locator("#diagnostico-resultado").waitFor({ state: "visible" });
  assert.match(await page.locator("#diagnostico-resultado").innerText(), /correcta/);
  await page.context().close();
});

test("teclado: las pestañas se manejan con flechas y llevan roles correctos", async () => {
  const page = await entrar();
  await page.locator("#tab-pedidos").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement.id), "tab-productos");
  assert.equal(await page.locator("#panel-productos").isVisible(), true);
  assert.equal(await page.locator("#panel-pedidos").isVisible(), false);
  await page.keyboard.press("End");
  assert.equal(await page.evaluate(() => document.activeElement.id), "tab-estado");
  await page.context().close();
});

test("si la sesión caduca, se vuelve al acceso con un aviso", async () => {
  const page = await entrar();
  await page.context().clearCookies();
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "solomillo");
  await page.locator(".prod-fila").first().locator("input[type=text]").fill("30");
  await page.locator(".prod-fila").first().locator("input[type=text]").blur();
  await page.locator("#acceso").waitFor({ state: "visible" });
  assert.match(await page.locator("#acceso-error").innerText(), /caducado/);
  await page.context().close();
});

for (const ancho of [320, 390, 1280]) {
  test(`el panel no tiene scroll horizontal a ${ancho}px en ninguna pestaña`, async () => {
    const page = await entrar({ ancho, alto: 800, tactil: ancho < 900 });
    for (const t of ["pedidos", "productos", "tienda", "negocio", "estado"]) {
      await page.click(`#tab-${t}`);
      const { total, visible } = await page.evaluate(() => ({ total: document.documentElement.scrollWidth, visible: document.documentElement.clientWidth }));
      assert.ok(total <= visible, `${t}: scrollWidth ${total} > ${visible}`);
    }
    await page.context().close();
  });
}

test("objetivos táctiles de 44 px o más en los controles del panel (móvil)", async () => {
  const page = await entrar({ ancho: 390 });
  const malos = [];
  for (const t of ["pedidos", "productos", "tienda", "negocio", "estado"]) {
    await page.click(`#tab-${t}`);
    malos.push(...await page.evaluate((pestana) => [...document.querySelectorAll(`#panel-${pestana} button, #panel-${pestana} select, #panel-${pestana} input:not([type=checkbox]):not([type=file]), #panel-${pestana} textarea, #panel-${pestana} a.btn-sec`)]
      .filter((n) => { const r = n.getBoundingClientRect(); return r.width && r.height && (r.height < 44 || r.width < 44); })
      .map((n) => `${pestana}: ${n.tagName}.${n.className} ${Math.round(n.getBoundingClientRect().width)}x${Math.round(n.getBoundingClientRect().height)} ${(n.getAttribute("aria-label") || n.textContent).trim().slice(0, 25)}`), t));
  }
  assert.deepEqual(malos, []);
  await page.context().close();
});
