import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarBlobs } from "./ayuda/blobs-local.mjs";
import { crearAlmacen } from "../lib/almacen.mjs";
import { ajustesPorDefecto } from "../lib/datos.generado.mjs";
import { manejarAdmin, csvPedidos } from "../lib/api-admin.mjs";
import { catalogo, foto, crearPedido } from "../lib/api-publica.mjs";
import { pagina } from "../lib/api-pagina.mjs";

const ORIGEN = "https://tienda.test";
const ENV = { ADMIN_PASSWORD: "clave-de-prueba-larga", SESSION_SECRET: "s".repeat(48) };
let blobs, almacen, reloj = Date.parse("2026-10-05T07:00:00Z"); // lunes 09:00 en Madrid
const purgas = [];
const deps = () => ({ almacen, env: ENV, ahora: () => reloj, ip: "1.2.3.4", ajustesPorDefecto, purgar: async (t) => { purgas.push(...t); } });

before(async () => { blobs = await arrancarBlobs(); almacen = crearAlmacen(); });
after(async () => { await blobs.parar(); });

const adm = (ruta, { metodo = "GET", cuerpo, cookie, cabeceras = {}, origen = ORIGEN, raw } = {}) => {
  const h = new Headers({ ...cabeceras });
  if (cookie) h.set("cookie", cookie);
  if (metodo !== "GET") { if (origen) h.set("origin", origen); h.set("x-requested-with", "ls-panel"); }
  if (cuerpo !== undefined && !raw) h.set("content-type", "application/json");
  return manejarAdmin(new Request(`${ORIGEN}/api/admin${ruta}`, { method: metodo, headers: h, body: raw ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined) }), deps());
};
let cookie;
async function entrar() {
  const r = await adm("/login", { metodo: "POST", cuerpo: { password: ENV.ADMIN_PASSWORD } });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}

test("sin sesión, todo el panel responde 401 (salvo el acceso)", async () => {
  for (const [ruta, metodo] of [["/datos", "GET"], ["/yo", "GET"], ["/pedidos", "GET"], ["/ajustes", "PUT"], ["/producto", "PUT"], ["/foto", "POST"], ["/diagnostico", "GET"], ["/pedidos.csv", "GET"]]) {
    const r = await adm(ruta, { metodo, cuerpo: metodo === "GET" ? undefined : {} });
    assert.equal(r.status, 401, `${metodo} ${ruta}`);
  }
});

test("el panel no funciona si faltan las variables de entorno", async () => {
  const r = await manejarAdmin(new Request(`${ORIGEN}/api/admin/yo`), { ...deps(), env: {} });
  assert.equal(r.status, 503);
});

test("acceso: contraseña incorrecta = 401; correcta = cookie HttpOnly Secure SameSite=Strict", async () => {
  assert.equal((await adm("/login", { metodo: "POST", cuerpo: { password: "mala" } })).status, 401);
  const r = await adm("/login", { metodo: "POST", cuerpo: { password: ENV.ADMIN_PASSWORD } });
  assert.equal(r.status, 200);
  const c = r.headers.get("set-cookie");
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/); assert.match(c, /Secure/);
  cookie = c.split(";")[0];
  assert.equal((await adm("/yo", { cookie })).status, 200);
});

test("acceso: desde otro origen se rechaza aunque la contraseña sea correcta", async () => {
  const r = await adm("/login", { metodo: "POST", cuerpo: { password: ENV.ADMIN_PASSWORD }, origen: "https://evil.test" });
  assert.equal(r.status, 403);
  const sinCabecera = await manejarAdmin(new Request(`${ORIGEN}/api/admin/login`, { method: "POST", headers: { origin: ORIGEN, "content-type": "application/json" }, body: JSON.stringify({ password: ENV.ADMIN_PASSWORD }) }), deps());
  assert.equal(sinCabecera.status, 403);
});

test("acceso: tras 5 fallos se bloquea (429) incluso con la contraseña buena", async () => {
  const d = { ...deps(), ip: "9.9.9.9" };
  const intento = (password) => manejarAdmin(new Request(`${ORIGEN}/api/admin/login`, { method: "POST", headers: { origin: ORIGEN, "x-requested-with": "ls-panel", "content-type": "application/json" }, body: JSON.stringify({ password }) }), d);
  for (let i = 0; i < 5; i++) assert.equal((await intento("mala")).status, 401);
  const r = await intento(ENV.ADMIN_PASSWORD);
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers.get("retry-after")) > 0);
});

test("las modificaciones exigen el origen y la cabecera del panel (CSRF)", async () => {
  const c = await entrar();
  const r = await adm("/redondeo", { metodo: "POST", cuerpo: { final: 90 }, cookie: c, origen: "https://evil.test" });
  assert.equal(r.status, 403);
  const sin = await manejarAdmin(new Request(`${ORIGEN}/api/admin/redondeo`, { method: "POST", headers: { cookie: c, origin: ORIGEN, "content-type": "application/json" }, body: "{\"final\":90}" }), deps());
  assert.equal(sin.status, 403);
});

test("datos: devuelve ajustes, productos y categorías", async () => {
  cookie = await entrar();
  const d = await (await adm("/datos", { cookie })).json();
  assert.equal(d.ok, true);
  assert.ok(d.productos.length >= 200);
  assert.ok(d.categorias.some((c) => c.id === "cordero"));
  assert.equal(d.ajustes.tienda.activa, false);
});

test("ajustes: guardar válidos purga la caché; inválidos devuelven 400 con el campo", async () => {
  const d = await (await adm("/datos", { cookie })).json();
  const nuevos = structuredClone(d.ajustes);
  nuevos.tienda.activa = true; nuevos.tienda.redondeo = 90; nuevos.negocio.telefono = "955 12 34 56";
  purgas.length = 0;
  const r = await adm("/ajustes", { metodo: "PUT", cuerpo: nuevos, cookie });
  assert.equal(r.status, 200);
  const g = await r.json();
  assert.equal(g.ajustes.negocio.whatsapp, "34955123456");
  assert.deepEqual(purgas.sort(), ["catalogo", "paginas"]);
  nuevos.horario[0].abre = "23:00";
  const mal = await adm("/ajustes", { metodo: "PUT", cuerpo: nuevos, cookie });
  assert.equal(mal.status, 400);
  assert.ok((await mal.json()).errores.some((e) => e.campo === "horario[0]"));
  // dejar el teléfono como estaba para el resto de pruebas
  nuevos.horario[0].abre = "09:00"; nuevos.negocio.telefono = "601006290";
  assert.equal((await adm("/ajustes", { metodo: "PUT", cuerpo: nuevos, cookie })).status, 200);
});

test("productos: crear, editar con redondeo ,90, agotar y borrar", async () => {
  const nuevo = { nombre: "Cabrito de prueba", categoria: "cordero", unidad: "kg", paso: 500, precio: "13,41", opciones: ["Entero"] };
  const c = await adm("/producto", { metodo: "PUT", cuerpo: nuevo, cookie });
  assert.equal(c.status, 200);
  const p = (await c.json()).producto;
  assert.equal(p.id, "cabrito-de-prueba");
  assert.equal(p.precio, 13.9); // redondeo 90 activo en los ajustes
  assert.equal((await adm("/producto", { metodo: "PUT", cuerpo: nuevo, cookie })).status, 409); // mismo nombre sin id
  const e = await adm("/producto", { metodo: "PUT", cuerpo: { ...p, agotado: true, precio: 14.5 }, cookie });
  assert.equal((await e.json()).producto.agotado, true);
  const lista = (await (await adm("/datos", { cookie })).json()).productos;
  assert.equal(lista.filter((x) => x.id === "cabrito-de-prueba").length, 1);
  assert.equal(lista.find((x) => x.id === "cabrito-de-prueba").precio, 14.9);
  assert.equal((await adm("/producto?id=cabrito-de-prueba", { metodo: "DELETE", cookie })).status, 200);
  assert.equal((await adm("/producto?id=cabrito-de-prueba", { metodo: "DELETE", cookie })).status, 404);
});

test("productos: datos inválidos devuelven 400", async () => {
  const r = await adm("/producto", { metodo: "PUT", cuerpo: { nombre: "X", categoria: "nada", unidad: "kg" }, cookie });
  assert.equal(r.status, 400);
});

test("redondeo masivo a ,95 solo toca precios existentes", async () => {
  await adm("/producto", { metodo: "PUT", cuerpo: { id: "pollo-pollo-entero", nombre: "Pollo entero", categoria: "pollo", unidad: "ud", paso: 1, precio: 8.5, opciones: ["Entero"] }, cookie });
  await adm("/producto", { metodo: "PUT", cuerpo: { nombre: "Pechuga de prueba", categoria: "pollo", unidad: "kg", paso: 250, precio: 8.5 }, cookie });
  await adm("/producto", { metodo: "PUT", cuerpo: { nombre: "Docena de huevos", categoria: "huevos", unidad: "ud", paso: 1, precio: 3.2 }, cookie });
  const r = await (await adm("/redondeo", { metodo: "POST", cuerpo: { final: 95 }, cookie })).json();
  assert.ok(r.tocados >= 1);
  const lista = (await (await adm("/datos", { cookie })).json()).productos;
  assert.equal(lista.find((x) => x.id === "pechuga-de-prueba").precio, 8.95);
  assert.equal(lista.find((x) => x.id === "pollo-pollo-entero").precio, 8.5, "lo que se vende por unidad no se redondea");
  assert.equal(lista.find((x) => x.id === "docena-de-huevos").precio, 3.2);
  assert.equal(lista.find((x) => x.id === "vacuno-solomillo-de-ternera").precio, null);
  assert.equal((await adm("/redondeo", { metodo: "POST", cuerpo: { final: 80 }, cookie })).status, 400);
});

test("fotos: solo imágenes reales y de tamaño razonable", async () => {
  const jpg = new Uint8Array(40); jpg.set([0xff, 0xd8, 0xff, 0xe0]);
  const ok = await adm("/foto", { metodo: "POST", raw: jpg, cabeceras: { "content-type": "image/jpeg" }, cookie });
  assert.equal(ok.status, 201);
  const { id } = await ok.json();
  const pub = await foto(id, deps());
  assert.equal(pub.status, 200);
  assert.equal(pub.headers.get("content-type"), "image/jpeg");
  assert.match(pub.headers.get("cache-control"), /immutable/);
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  assert.equal((await adm("/foto", { metodo: "POST", raw: html, cabeceras: { "content-type": "image/jpeg" }, cookie })).status, 415);
  const grande = new Uint8Array(800 * 1024); grande.set([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal((await adm("/foto", { metodo: "POST", raw: grande, cabeceras: { "content-type": "image/jpeg" }, cookie })).status, 413);
  assert.equal((await foto("../../etc/passwd", deps())).status, 404);
  assert.equal((await foto("00000000-0000-0000-0000-000000000000", deps())).status, 404);
});

// ---------- parte pública ----------
const pedidoReq = (cuerpo, ct = "application/json") => new Request(`${ORIGEN}/api/pedido`, { method: "POST", headers: { "content-type": ct }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });
const pedidoOk = () => ({
  lineas: [{ id: "pollo-pollo-entero", cantidad: 2, opcion: "Entero" }, { id: "vacuno-solomillo-de-ternera", cantidad: 500, opcion: "En medallones" }],
  cliente: { nombre: "Ana Pérez", telefono: "655443322" },
  entrega: { tipo: "recogida", dia: "2026-10-07", franja: "11:00-13:00" },
  pago: "efectivo",
});

test("catálogo público: sin productos ocultos ni datos internos del negocio", async () => {
  await adm("/producto", { metodo: "PUT", cuerpo: { id: "pavo-alas-de-pavo", nombre: "Alas de pavo", categoria: "pavo", unidad: "kg", paso: 250, oculto: true }, cookie });
  const c = await (await catalogo(deps())).json();
  assert.equal(c.ok, true);
  assert.ok(!c.productos.some((p) => p.id === "pavo-alas-de-pavo"));
  assert.ok(!JSON.stringify(c).includes("razonSocial") && !JSON.stringify(c).includes("bizumNumero") && !JSON.stringify(c).includes("transferenciaDatos"));
  assert.equal(c.hoy, "2026-10-05");
  assert.ok(c.categorias.every((x) => c.productos.some((p) => p.categoria === x.id)));
});

test("pedido: se guarda con número, devuelve el enlace de WhatsApp y el servidor pone los precios", async () => {
  const antes = (await almacen.listarPedidos()).length;
  const r = await crearPedido(pedidoReq({ ...pedidoOk(), total: 0.01 }), deps());
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.match(j.numero, /^LE-2610-\d{4}$/);
  assert.ok(j.whatsappUrl.startsWith("https://wa.me/34601006290?text="));
  assert.equal((await almacen.listarPedidos()).length, antes + 1);
  const guardado = await almacen.leerPedido(j.numero);
  assert.equal(guardado.estado, "nuevo");
  assert.equal(guardado.cliente.telefono, "655443322");
  assert.equal(guardado.lineas[0].precio, 8.5);
  assert.equal(j.resumen.consultar, 1); // el solomillo no tiene precio
});

test("pedido: errores de validación = 400 y no se guarda nada", async () => {
  const antes = (await almacen.listarPedidos()).length;
  const mal = pedidoOk(); mal.cliente.telefono = "123";
  const r = await crearPedido(pedidoReq(mal), deps());
  assert.equal(r.status, 400);
  assert.ok((await r.json()).errores.some((e) => e.campo === "cliente.telefono"));
  assert.equal((await almacen.listarPedidos()).length, antes);
});

test("pedido: rechaza GET, otros formatos, JSON roto y cuerpos enormes", async () => {
  assert.equal((await crearPedido(new Request(`${ORIGEN}/api/pedido`), deps())).status, 405);
  assert.equal((await crearPedido(pedidoReq("x=1", "text/plain"), deps())).status, 415);
  assert.equal((await crearPedido(pedidoReq("{roto"), deps())).status, 400);
  const enorme = JSON.stringify({ lineas: [], relleno: "x".repeat(70 * 1024) });
  assert.equal((await crearPedido(pedidoReq(enorme), deps())).status, 413);
});

test("pedido: con la tienda desactivada no se acepta", async () => {
  const d = await (await adm("/datos", { cookie })).json();
  const a = structuredClone(d.ajustes); a.tienda.activa = false;
  await adm("/ajustes", { metodo: "PUT", cuerpo: a, cookie });
  const r = await crearPedido(pedidoReq(pedidoOk()), deps());
  assert.equal(r.status, 400);
  a.tienda.activa = true; await adm("/ajustes", { metodo: "PUT", cuerpo: a, cookie });
});

test("panel de pedidos: listar, cambiar estado, nota interna, exportar CSV seguro y borrar", async () => {
  const lista = (await (await adm("/pedidos", { cookie })).json()).pedidos;
  assert.ok(lista.length >= 1);
  const num = lista[0].numero;
  const e = await adm("/pedido", { metodo: "PATCH", cuerpo: { numero: num, estado: "confirmado", notaInterna: "=HYPERLINK(\"http://x\")" }, cookie });
  assert.equal((await e.json()).pedido.estado, "confirmado");
  assert.equal((await adm("/pedido", { metodo: "PATCH", cuerpo: { numero: num, estado: "inventado" }, cookie })).status, 400);
  assert.equal((await adm("/pedido", { metodo: "PATCH", cuerpo: { numero: "LE-9999-0001", estado: "nuevo" }, cookie })).status, 404);
  const csv = await (await adm("/pedidos.csv", { cookie })).text();
  assert.match(csv, /"numero";"creado";"estado"/);
  assert.match(csv, /"17,00"/);
  assert.match(csv, /'=HYPERLINK/); // la fórmula queda neutralizada
  assert.equal((await adm(`/pedido?numero=${num}`, { metodo: "DELETE", cookie })).status, 200);
  assert.equal(await almacen.leerPedido(num), null);
});

test("csvPedidos escapa comillas y neutraliza fórmulas", () => {
  const p = { numero: "LE-2610-0001", creado: "x", estado: "nuevo", cliente: { nombre: '+cmd "x"', telefono: "1" }, entrega: { tipo: "recogida", dia: "d", franja: "f", direccion: "" }, pago: "efectivo", subtotalCent: 100, envioCent: 0, totalCent: 100, consultar: 0, lineas: [{ nombre: "A", cantidad: 250, unidad: "kg", opcion: "", nota: "" }], comentarios: "", notaInterna: "" };
  const csv = csvPedidos([p]);
  assert.match(csv, /"'\+cmd ""x"""/);
});

test("diagnóstico: comprueba que lo escrito se lee", async () => {
  const d = await (await adm("/diagnostico", { cookie })).json();
  assert.equal(d.configuracion, "correcta");
  assert.match(d.escrituraLectura, /correcta/);
});

test("páginas: la portada, sitemap y robots salen con los datos guardados", async () => {
  // plantilla de la tienda aún no existe en esta fase de pruebas: solo se piden las demás
  const preq = (ruta) => new Request(`${ORIGEN}${ruta}`);
  const home = await pagina(preq("/"), deps());
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-security-policy"), /script-src 'self' 'sha256-/);
  assert.match(home.headers.get("netlify-cache-tag"), /paginas/);
  assert.match(await home.text(), /href="\/tienda"/); // tienda activa
  const sm = await (await pagina(preq("/sitemap.xml"), deps())).text();
  assert.match(sm, /<loc>https:\/\/carnicerialaestrella\.netlify\.app\/<\/loc>/);
  assert.match(sm, /<loc>https:\/\/carnicerialaestrella\.netlify\.app\/tienda<\/loc>/);
  const rb = await (await pagina(preq("/robots.txt"), deps())).text();
  assert.match(rb, /Disallow: \/admin\//);
  assert.equal((await pagina(preq("/nada"), deps())).status, 404);
});
