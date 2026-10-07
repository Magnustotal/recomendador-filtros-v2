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

test("tienda: códigos postales de reparto y radio se editan, se validan y se guardan", async () => {
  const page = await entrar();
  await page.click("#tab-tienda");
  const entradaCp = page.locator("#nuevo-cp");
  await entradaCp.fill("41008, 4101");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.locator("#aviso.es-error").waitFor();
  assert.match(await page.locator("#aviso").innerText(), /4101/);
  await entradaCp.fill("41008, 41009 41010");
  await entradaCp.press("Enter");
  assert.equal(await page.locator('ul[aria-label="Códigos postales de reparto"] li').count(), 3);
  await page.getByRole("button", { name: "Quitar el código postal 41009" }).click();
  assert.equal(await page.locator('ul[aria-label="Códigos postales de reparto"] li').count(), 2);
  await page.fill("#a-tienda-reparto-radioKm", "2,5");
  await page.locator("#form-tienda button[type=submit]").click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  const r = (await e.api.llamar("/datos")).datos.ajustes.tienda.reparto;
  assert.deepEqual(r.codigosPostales, ["41008", "41010"]);
  assert.equal(r.radioKm, 2.5);
  // el radio exige las coordenadas
  await page.click("#tab-negocio");
  await page.fill("#a-negocio-lat", "");
  await page.fill("#a-negocio-lng", "");
  await page.click("#tab-tienda");
  await page.locator("#form-tienda button[type=submit]").click();
  await page.locator("#errores-tienda").waitFor({ state: "visible" });
  assert.match(await page.locator("#errores-tienda").innerText(), /latitud/);
  // limpiar para no afectar a otras pruebas
  const limpio = structuredClone((await e.api.llamar("/datos")).datos.ajustes);
  limpio.tienda.reparto.codigosPostales = []; limpio.tienda.reparto.radioKm = null;
  await e.api.llamar("/ajustes", { metodo: "PUT", cuerpo: limpio });
  await page.context().close();
});

test("pedidos: el reparto muestra el código postal y avisa si la dirección está por verificar", async () => {
  const { datos } = await e.api.llamar("/datos");
  const a = structuredClone(datos.ajustes);
  const nuevo = await hacerPedido(pedido({ entrega: { tipo: "reparto", direccion: "Calle Luna 9, 1º B", cp: "41010", dia: "2026-10-06", franja: "10:00-13:00" }, cliente: { nombre: "Zona Prueba", telefono: "633000999" }, lineas: [{ id: "vacuno-solomillo-de-ternera", opcion: "", nota: "", cantidad: 1000 }] }));
  const page = await entrar();
  const tarjeta = page.locator(".pedido", { hasText: nuevo });
  await tarjeta.waitFor();
  assert.match(await tarjeta.innerText(), /Calle Luna 9, 1º B · 41010/);
  assert.doesNotMatch(await tarjeta.innerText(), /por verificar/); // sin radio configurado, no hay nada que verificar
  void a;
  await page.context().close();
});

// Las herramientas de precios vienen plegadas en el móvil (abiertas en pantallas anchas)
async function abrirHerramientas(page) {
  if (!(await page.locator("#prod-herramientas").evaluate((d) => d.open))) await page.locator("#prod-herramientas > summary").click();
}

// ---------- precios orientativos, calculadora y semáforo ----------
const filaProd = (page, nombre) => page.locator(".prod-fila", { has: page.getByRole("strong").filter({ hasText: new RegExp(`^${nombre}$`) }) });

test("orientativos: se ven como sugerencia (sin precio en la tienda) y se aceptan uno a uno, con semáforo", async () => {
  const page = await entrar();
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Lomo bajo de ternera");
  const fila = page.locator(".prod-fila").first();
  assert.match(await fila.innerText(), /Orientativo: 19,90 €\/kg/);
  assert.equal(await fila.locator("input[type=text]").inputValue(), "", "el orientativo no es todavía el precio");
  assert.match(await fila.innerText(), /Sin precio/);
  // el cliente sigue viendo «Consultar»
  const pub = await (await fetch(e.url + "/api/catalogo")).json();
  assert.equal(pub.productos.find((p) => p.id === "vacuno-lomo-bajo-de-ternera").precio, null);
  await fila.getByRole("button", { name: /Aceptar el precio orientativo/ }).click();
  await fila.locator(".fila-estado", { hasText: "Guardado" }).waitFor();
  assert.equal(await fila.locator("input[type=text]").inputValue(), "19,90");
  assert.match(await fila.locator(".sem").innerText(), /En rango/);
  assert.equal(await fila.locator(".sugerido button").count(), 0);
  assert.equal((await e.api.llamar("/datos")).datos.productos.find((p) => p.id === "vacuno-lomo-bajo-de-ternera").precio, 19.9);
  await page.context().close();
});

test("calculadora desde el coste: merma, recargo, IVA y redondeo; el coste se guarda en privado", async () => {
  const page = await entrar();
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Cadera de ternera");
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  const dlg = page.locator("#dlg-producto");
  await dlg.getByText("Desde mi coste").click();
  assert.match(await dlg.locator(".calc-resultado").first().innerText(), /Escribe lo que te cuesta/);
  await dlg.locator("#f-coste").fill("10");
  await dlg.locator("#f-merma").fill("20");
  await dlg.locator("#f-margen").fill("30");
  // 10 / 0,8 = 12,50; +30 % = 16,25; +10 % IVA = 17,875 -> 17,88; con ,90 -> 17,90
  assert.match(await dlg.locator(".calc-resultado").first().innerText(), /17,88 € → 17,90 € con el redondeo ,90/);
  await dlg.getByRole("button", { name: "Usar este precio" }).click();
  assert.equal(await dlg.locator("#f-precio").inputValue(), "17,90");
  assert.match(await dlg.locator(".sem-grande").innerText(), /Margen correcto/);
  // un precio por debajo del coste = rojo
  await dlg.locator("#f-precio").fill("9");
  assert.match(await dlg.locator(".sem-grande").innerText(), /No cubre el coste/);
  assert.ok(await dlg.locator(".sem-grande .sem-rojo").count() === 1);
  await dlg.locator("#f-precio").fill("17,9");
  await dlg.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  const p = (await e.api.llamar("/datos")).datos.productos.find((x) => x.id === "vacuno-cadera-de-ternera");
  assert.equal(p.precio, 17.9); assert.equal(p.coste, 10); assert.equal(p.merma, 20); assert.equal(p.margen, 30);
  // y no se filtra al público
  const pub = JSON.stringify((await (await fetch(e.url + "/api/catalogo")).json()).productos.find((x) => x.id === "vacuno-cadera-de-ternera"));
  assert.ok(!/coste|merma|margen/.test(pub), pub);
  // la lista muestra el semáforo basado en el coste
  await page.fill("#prod-buscar", "Cadera de ternera");
  assert.match(await page.locator(".prod-fila").first().locator(".sem").innerText(), /Margen correcto/);
  await page.context().close();
});

test("ajustar el orientativo con botones de porcentaje y volver al orientativo", async () => {
  const page = await entrar();
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Tapa de ternera"); // orientativo 14,50
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  const dlg = page.locator("#dlg-producto");
  await dlg.getByText("Ajustar el orientativo").click();
  assert.match(await dlg.locator(".calc-resultado").last().innerText(), /Orientativo: 14,50 € \(fiabilidad media\)/);
  await dlg.getByRole("button", { name: "Subir el precio un 10 por ciento" }).click(); // 14,50 +10 % = 15,95 -> siguiente ,90 = 16,90
  assert.equal(await dlg.locator("#f-precio").inputValue(), "16,90");
  await dlg.getByRole("button", { name: "Volver al orientativo" }).click(); // 14,50 -> 14,90
  assert.equal(await dlg.locator("#f-precio").inputValue(), "14,90");
  assert.match(await dlg.locator(".sem-grande").innerText(), /En rango/);
  // bajar poco a poco: el redondeo no se «come» los pasos porque se trabaja con el valor exacto
  for (let i = 0; i < 3; i++) await dlg.getByRole("button", { name: "Bajar el precio un 10 por ciento" }).click(); // 10,57 -> 10,90
  assert.equal(await dlg.locator("#f-precio").inputValue(), "10,90");
  assert.match(await dlg.locator(".sem-grande").innerText(), /Algo barato/);
  for (let i = 0; i < 2; i++) await dlg.getByRole("button", { name: "Bajar el precio un 10 por ciento" }).click(); // 8,56 -> 8,90
  assert.match(await dlg.locator(".sem-grande").innerText(), /Muy barato/);
  assert.equal(await dlg.locator(".sem-barra").getAttribute("role"), "img");
  assert.match(await dlg.locator(".sem-barra").getAttribute("aria-label"), /Rango habitual de 11,60 € a 17,40 €; tu precio, 8,90 €/);
  await page.context().close();
});

test("recargo e IVA por defecto se cambian en Tienda → Precios y márgenes y llegan a la calculadora", async () => {
  const page = await entrar();
  await page.click("#tab-tienda");
  await page.locator("#form-tienda summary", { hasText: "IVA por categoría" }).click();
  await page.fill("#a-tienda-precios-margenDefecto", "40");
  await page.fill("#a-tienda-precios-iva-vacuno", "21");
  await page.locator("#form-tienda button[type=submit]").click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  const cfg = (await e.api.llamar("/datos")).datos.ajustes.tienda.precios;
  assert.equal(cfg.margenDefecto, 40); assert.equal(cfg.iva.vacuno, 21); assert.equal(cfg.iva.huevos, 4);
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Redondo de ternera");
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  const dlg = page.locator("#dlg-producto");
  assert.equal(await dlg.locator("#f-margen").getAttribute("placeholder"), "40");
  await dlg.getByText("Desde mi coste").click();
  await dlg.locator("#f-coste").fill("10");
  // sin merma, 10 +40 % = 14 ; IVA 21 % = 16,94 -> ,90 = 16,90? (16,94 > 16,90 => 17,90)
  assert.match(await dlg.locator(".calc-resultado").first().innerText(), /16,94 € → 17,90 € con el redondeo ,90 \(con 21 % de IVA y un 40 % sobre el coste\)/);
  await page.keyboard.press("Escape");
  // restablecer (el formulario se repinta al guardar y el desplegable vuelve a cerrarse)
  await page.click("#tab-tienda");
  await page.locator("#form-tienda summary", { hasText: "IVA por categoría" }).click();
  await page.fill("#a-tienda-precios-margenDefecto", "30");
  await page.fill("#a-tienda-precios-iva-vacuno", "10");
  await page.locator("#form-tienda button[type=submit]").click();
  await page.locator("#aviso", { hasText: "Cambios guardados" }).waitFor();
  await page.context().close();
});

test("«Aceptar todos»: pone el orientativo a lo que no tiene precio y la tienda lo enseña; el estado lo refleja", async () => {
  const page = await entrar();
  page.on("dialog", (d) => d.accept());
  await page.click("#tab-estado");
  assert.match(await page.locator("#lista-comprobacion").innerText(), /productos con precio orientativo sin aceptar/);
  await page.click("#tab-productos");
  await abrirHerramientas(page);
  const antes = await page.locator("#prod-aceptar-todos").innerText();
  assert.match(antes, /^Aceptar los \d+ precios orientativos pendientes$/);
  await page.click("#prod-aceptar-todos");
  await page.locator("#aviso", { hasText: "Precios orientativos aplicados" }).waitFor();
  assert.equal(await page.locator("#prod-aceptar-todos").isDisabled(), true);
  assert.match(await page.locator("#prod-aceptar-todos").innerText(), /No quedan/);
  const sin = (await e.api.llamar("/datos")).datos.productos.filter((p) => p.precio == null).length;
  assert.equal(sin, 0);
  const pub = await (await fetch(e.url + "/api/catalogo")).json();
  assert.equal(pub.productos.filter((p) => p.precio == null).length, 0);
  assert.equal(pub.productos.find((p) => p.id === "vacuno-babilla-de-ternera").precio, 14.9, "14,50 orientativo -> ,90 al redondear");
  assert.equal(pub.productos.find((p) => p.id === "vacuno-solomillo-de-ternera").precio, 29.9, "los que ya tenían precio no se tocan");
  await page.click("#tab-estado");
  assert.match(await page.locator("#lista-comprobacion").innerText(), /No quedan precios orientativos por revisar/);
  assert.deepEqual(errores(page), []);
  await page.context().close();
});

test("fecha de precios: el panel la muestra, se actualiza con «Los precios están al día» y la ve el cliente", async () => {
  const page = await entrar();
  page.on("dialog", (d) => d.accept());
  await page.click("#tab-productos");
  await abrirHerramientas(page);
  assert.match(await page.locator("#prod-fecha-precios").innerText(), /Precios actualizados por última vez: 5 de octubre de 2026\./);
  await page.click("#prod-precios-al-dia");
  await page.locator("#aviso", { hasText: "los precios se han actualizado hoy" }).waitFor();
  const meta = (await e.api.llamar("/datos")).datos.meta;
  assert.match(meta.precios, /^2026-10-05T/);
  await page.click("#tab-estado");
  assert.match(await page.locator("#lista-comprobacion").innerText(), /Los precios se actualizaron hace \d+ días?/);
  assert.match(await page.locator("#lista-comprobacion").innerText(), /rangos de mercado/);
  // el semáforo explica de dónde sale el rango de mercado
  await page.click("#tab-productos");
  await page.fill("#prod-buscar", "Entrecot de ternera");
  await page.locator(".prod-fila").first().getByRole("button", { name: /Editar/ }).click();
  assert.match(await page.locator("#dlg-producto .fuente-rango").innerText(), /Rango de mercado: estimación propia de octubre de 2026, con fiabilidad media\. No procede de una fuente oficial ni se actualiza sola/);
  await page.context().close();
});

// ---------- productos por categorías, plegables ----------
test("productos por categorías: plegadas al principio, con cuenta, y se abren y cierran", async () => {
  const page = await entrar();
  await page.click("#tab-productos");
  const grupos = page.locator("#prod-lista details.prod-cat");
  assert.equal(await grupos.count(), 18);
  assert.equal(await page.locator("#prod-lista details.prod-cat[open]").count(), 0, "todas cerradas al entrar");
  assert.equal(await page.locator("#prod-lista .prod-fila").count(), 0, "las filas no se pintan hasta abrir la categoría");
  const resumen = grupos.filter({ hasText: "Vacuno" }).locator("summary");
  assert.match(await resumen.innerText(), /Vacuno\s+22 productos/);
  await resumen.click();
  await page.locator("#pcat-vacuno .prod-fila").first().waitFor(); // las filas se pintan al abrir (evento «toggle»)
  assert.equal(await page.locator("#pcat-vacuno .prod-fila").count(), 22);
  assert.equal(await page.locator("#pcat-vacuno").getAttribute("open"), "");
  await resumen.click();
  assert.equal(await page.locator("#pcat-vacuno").getAttribute("open"), null);
  // abrir y cerrar todas
  await page.click("#prod-expandir");
  await page.locator("#pcat-vino .prod-fila").first().waitFor();
  assert.equal(await page.locator("#prod-lista details.prod-cat[open]").count(), 18);
  assert.equal(await page.locator("#prod-lista .prod-fila").count(), (await e.api.llamar("/datos")).datos.productos.length);
  await page.click("#prod-contraer");
  assert.equal(await page.locator("#prod-lista details.prod-cat[open]").count(), 0);
  await page.context().close();
});

test("productos por categorías: los botones de categoría llevan a la sección, como en la tienda", async () => {
  const page = await entrar({ alto: 800 });
  await page.click("#tab-productos");
  assert.equal(await page.locator("#prod-chips .chip").count(), 18);
  await page.locator("#prod-chips .chip", { hasText: "Vino" }).click();
  await page.waitForTimeout(300);
  const caja = await page.locator("#pcat-vino").boundingBox();
  assert.ok(caja.y >= 0 && caja.y < 300, `Vino quedó en y=${Math.round(caja.y)}`);
  assert.equal(await page.locator("#pcat-vino").getAttribute("open"), "");
  await page.locator("#pcat-vino .prod-fila").first().waitFor();
  assert.equal(await page.locator("#pcat-vino .prod-fila").count(), 8);
  assert.equal(await page.locator("#prod-chips .chip[aria-current]").innerText(), "Vino");
  // un producto nuevo nace en la categoría en la que se está trabajando
  await page.click("#prod-nuevo");
  assert.equal(await page.locator("#f-categoria").inputValue(), "vino");
  await page.keyboard.press("Escape");
  await page.context().close();
});

test("productos por categorías: al buscar se abren solo las que tienen coincidencias; al borrar, vuelve lo que estaba", async () => {
  const page = await entrar();
  await page.click("#tab-productos");
  await page.locator("#pcat-cordero summary").click(); // una abierta a mano
  await page.fill("#prod-buscar", "solomillo");
  const abiertas = await page.locator("#prod-lista details.prod-cat[open] .cat-nombre").allInnerTexts();
  assert.deepEqual(abiertas.sort(), ["Caza", "Cerdo", "Cerdo ibérico", "Pavo", "Pollo", "Vacuno"].sort());
  assert.equal(await page.locator("#pcat-vino").count(), 0, "las categorías sin coincidencias desaparecen");
  assert.equal(await page.locator("#prod-chips .chip").count(), 6);
  await page.fill("#prod-buscar", "xyzxyz");
  assert.match(await page.locator("#prod-lista").innerText(), /Ningún producto coincide/);
  await page.fill("#prod-buscar", "");
  assert.equal(await page.locator("#prod-lista details.prod-cat[open]").count(), 1, "solo la que se abrió a mano");
  assert.equal(await page.locator("#pcat-cordero").getAttribute("open"), "");
  await page.context().close();
});

test("productos por categorías: al aceptar un precio, la cuenta de la categoría se actualiza sin cerrar nada", async () => {
  // (otras pruebas ya aceptaron todos los orientativos: se vacía el precio de uno por la API para que vuelva a haber sugerencia)
  const datos = (await e.api.llamar("/datos")).datos;
  const uno = datos.productos.find((p) => p.categoria === "cordero" && p.precio != null);
  await e.api.llamar("/producto", { metodo: "PUT", cuerpo: { ...uno, precio: null } });
  const page = await entrar();
  await page.click("#tab-productos");
  await page.locator("#pcat-cordero summary").click();
  const antes = await page.locator("#pcat-cordero .cat-cuenta").innerText();
  const sin = Number(antes.match(/(\d+) sin precio/)?.[1] ?? 0);
  assert.ok(sin > 0, antes);
  await page.locator("#pcat-cordero .prod-fila").first().getByRole("button", { name: /Aceptar el precio orientativo/ }).click();
  await page.locator("#pcat-cordero .cat-cuenta", { hasText: sin - 1 === 0 ? "todos con precio" : `${sin - 1} sin precio` }).waitFor();
  assert.equal(await page.locator("#pcat-cordero").getAttribute("open"), "");
  await page.context().close();
});
