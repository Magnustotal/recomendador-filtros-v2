import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarBlobs } from "./ayuda/blobs-local.mjs";
import { crearAlmacen } from "../lib/almacen.mjs";
import { ajustesPorDefecto } from "../lib/datos.generado.mjs";
import { manejarAdmin, csvPedidos } from "../lib/api-admin.mjs";
import { catalogo, foto, crearPedido } from "../lib/api-publica.mjs";
import { pagina } from "../lib/api-pagina.mjs";
import { ahoraEnMadrid } from "../lib/horario.mjs";
import { jpegCon, pngCon, webpLossy } from "./ayuda/imagenes.mjs";

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
  for (const [ruta, metodo] of [["/datos", "GET"], ["/yo", "GET"], ["/pedidos", "GET"], ["/ajustes", "PUT"], ["/producto", "PUT"], ["/foto", "POST"], ["/mercado", "PUT"], ["/diagnostico", "GET"], ["/pedidos.csv", "GET"]]) {
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

test("fotos: solo imágenes reales, de tamaño razonable y con medidas dentro de lo permitido", async () => {
  const subir = (bytes, tipo = "image/jpeg") => adm("/foto", { metodo: "POST", raw: bytes, cabeceras: { "content-type": tipo }, cookie });
  const ok = await subir(jpegCon(800, 600));
  assert.equal(ok.status, 201);
  const { id } = await ok.json();
  const pub = await foto(id, deps());
  assert.equal(pub.status, 200);
  assert.equal(pub.headers.get("content-type"), "image/jpeg");
  assert.match(pub.headers.get("cache-control"), /immutable/);
  assert.equal((await subir(pngCon(1000, 1000), "image/png")).status, 201);
  assert.equal((await subir(webpLossy(900, 700), "image/webp")).status, 201);
  assert.equal((await subir(jpegCon(400, 300))).status, 201, "justo el mínimo");
  assert.equal((await subir(jpegCon(1600, 1200))).status, 201, "justo el máximo");
  assert.equal((await subir(jpegCon(300, 400))).status, 201, "vertical: cuenta el lado largo");

  // medidas fuera de rango
  for (const [w, h] of [[399, 399], [200, 150], [10, 10], [1601, 1000], [4032, 3024], [100, 6000]]) {
    const r = await subir(jpegCon(w, h));
    assert.equal(r.status, 422, `${w}x${h}`);
    assert.match((await r.json()).errores[0].mensaje, /debe medir entre 400 y 1600/);
  }
  // tipos no admitidos y cabeceras ilegibles
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  assert.equal((await subir(html)).status, 415);
  const gif = new TextEncoder().encode("GIF89a" + "x".repeat(60));
  assert.equal((await subir(gif, "image/gif")).status, 415);
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'></svg>");
  assert.equal((await subir(svg, "image/svg+xml")).status, 415);
  const sinMedidas = new Uint8Array(40); sinMedidas.set([0xff, 0xd8, 0xff, 0xe0]);
  const ilegible = await subir(sinMedidas);
  assert.equal(ilegible.status, 415);
  assert.match((await ilegible.json()).errores[0].mensaje, /No se ha podido leer la foto/);
  // peso
  const grande = new Uint8Array(800 * 1024); grande.set(jpegCon(800, 600));
  assert.equal((await subir(grande)).status, 413);
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

test("reparto con radio: se localiza la dirección, se rechaza lo lejano y lo no localizable entra «por verificar»", async () => {
  const d = await (await adm("/datos", { cookie })).json();
  const a = structuredClone(d.ajustes);
  a.tienda.activa = true; a.tienda.reparto.activo = true; a.tienda.reparto.radioKm = 3; a.tienda.reparto.codigosPostales = ["41008"];
  assert.equal((await adm("/ajustes", { metodo: "PUT", cuerpo: a, cookie })).status, 200);
  const cuerpo = (cp) => ({ ...pedidoOk(), entrega: { tipo: "reparto", dia: "2026-10-07", franja: "10:00-13:00", direccion: "Calle Sol 4, 2º A", cp }, pago: "efectivo" });
  const consultas = [];
  const con = (geo) => ({ ...deps(), geocodificar: async (q) => { consultas.push(q); return geo; } });
  const TIENDA = { lat: a.negocio.lat, lng: a.negocio.lng };

  // CP de la lista: no se consulta a ningún servicio
  const enLista = await crearPedido(pedidoReq(cuerpo("41008")), con({ lat: 0, lng: 0 }));
  assert.equal(enLista.status, 201); assert.equal(consultas.length, 0);

  // fuera de la lista y lejos: rechazado
  const lejos = await crearPedido(pedidoReq(cuerpo("41013")), con({ lat: TIENDA.lat + 0.1, lng: TIENDA.lng })); // ~11 km
  assert.equal(lejos.status, 400);
  assert.match((await lejos.json()).errores.find((e) => e.campo === "entrega.direccion").mensaje, /km de la tienda/);
  assert.match(consultas.at(-1), /^Calle Sol 4, 2º A, 41013 Sevilla, España$/);

  // fuera de la lista pero cerca: aceptado con la distancia guardada
  const cerca = await crearPedido(pedidoReq(cuerpo("41013")), con({ lat: TIENDA.lat + 0.01, lng: TIENDA.lng })); // ~1,1 km
  assert.equal(cerca.status, 201);
  const g = await almacen.leerPedido((await cerca.json()).numero);
  assert.equal(g.entrega.distanciaKm, 1.1); assert.equal(g.entrega.zonaVerificada, true); assert.equal(g.entrega.cp, "41013");

  // el servicio no localiza la dirección: entra, marcado por verificar
  const sin = await crearPedido(pedidoReq(cuerpo("41013")), con(null));
  assert.equal(sin.status, 201);
  const g2 = await almacen.leerPedido((await sin.json()).numero);
  assert.equal(g2.entrega.zonaVerificada, false); assert.equal(g2.entrega.distanciaKm, null);

  // el CSV lo refleja
  const csv = await (await adm("/pedidos.csv", { cookie })).text();
  assert.match(csv, /"zona_verificada"/); assert.match(csv, /;"41013";"1,1";"sí";/); assert.match(csv, /;"41013";"";"NO";/);

  // ajustes antiguos sin los campos nuevos siguen funcionando
  const viejo = structuredClone(a); delete viejo.tienda.reparto.codigosPostales; delete viejo.tienda.reparto.radioKm;
  await almacen.guardarAjustes(viejo);
  assert.deepEqual((await almacen.leerAjustes()).tienda.reparto.codigosPostales, []);
  assert.equal((await catalogo(deps()).then((r) => r.json())).ajustes.tienda.reparto.radioKm, null);
});

test("orientativos: /datos los incluye y /orientativos rellena solo los productos sin precio, con redondeo", async () => {
  const d = await (await adm("/datos", { cookie })).json();
  assert.equal(Object.keys(d.orientativos.precios).length, d.productos.filter((p) => p.id in d.orientativos.precios).length);
  assert.ok(d.orientativos.precios["vacuno-solomillo-de-ternera"][0] > 0);
  // un precio puesto a mano no se toca
  await adm("/producto", { metodo: "PUT", cuerpo: { ...d.productos.find((p) => p.id === "vacuno-entrecot-de-ternera"), precio: 5.5, coste: 4, merma: 10 }, cookie });
  const sinPrecio = d.productos.filter((p) => p.precio == null && p.id in d.orientativos.precios && p.id !== "vacuno-entrecot-de-ternera").length;
  const r = await adm("/orientativos", { metodo: "POST", cuerpo: {}, cookie });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.aplicados >= sinPrecio - 1 && j.aplicados > 100, `aplicados ${j.aplicados}`);
  const lista = (await (await adm("/datos", { cookie })).json()).productos;
  const sol = lista.find((p) => p.id === "vacuno-solomillo-de-ternera");
  assert.equal(sol.precio, 36.9, "36,90 ya termina en ,90");
  assert.equal(lista.find((p) => p.id === "vacuno-entrecot-de-ternera").precio, 5.9, "no pisa lo que ya tenía precio (5,5 redondeado a ,90 al guardarlo)");
  const cadera = lista.find((p) => p.id === "vacuno-cadera-de-ternera");
  assert.equal(cadera.precio, 14.9);
  // por unidad no se redondea (redondeo ,90 activo en los ajustes de esta batería de pruebas)
  assert.equal(lista.find((p) => p.id === "pollo-pollo-entero").precio, 8.5, "este ya tenía 8,5 de otra prueba");
  assert.equal(lista.find((p) => p.id === "vino-vino-tinto-crianza").precio, 8.9);
  // segunda vez: no queda nada por aplicar
  assert.equal((await (await adm("/orientativos", { metodo: "POST", cuerpo: {}, cookie })).json()).aplicados, 0);
  // y el coste/merma/margen no salen al público
  const pub = await (await catalogo(deps())).json();
  const txt = JSON.stringify(pub.productos); // (el «coste» de los ajustes es el del envío, que sí es público)
  assert.ok(!txt.includes('"coste"') && !txt.includes('"merma"') && !txt.includes('"margen"'), "datos privados en el catálogo público");
  assert.ok(!JSON.stringify(pub).includes('"merma"') && !JSON.stringify(pub).includes('"margen"') && !JSON.stringify(pub).includes('"margenDefecto"'), "el recargo no sale en ningún sitio público");
  assert.equal(pub.productos.find((p) => p.id === "vacuno-entrecot-de-ternera").precio, 5.9);
  assert.equal((await adm("/orientativos", { metodo: "POST", cuerpo: {} })).status, 401);
});

test("fechas de actualización: el contenido, los precios y la confirmación «al día» se anotan por separado", async () => {
  const antes = await almacen.leerMeta();
  reloj += 3 * 24 * 3600 * 1000; // pasan tres días
  cookie = await entrar(); // la sesión dura 8 h: tras saltar días hay que volver a entrar
  const hoy = new Date(reloj).toISOString().slice(0, 10);
  const d = await (await adm("/datos", { cookie })).json();
  assert.ok("meta" in d);
  const p = d.productos.find((x) => x.id === "vacuno-tapa-de-ternera");

  // agotar un producto cambia el contenido, pero no la fecha de precios
  await adm("/producto", { metodo: "PUT", cuerpo: { ...p, agotado: true }, cookie });
  let m = await almacen.leerMeta();
  assert.equal(m.contenido.slice(0, 10), hoy);
  assert.equal(m.precios, antes.precios);

  // cambiar un precio sí actualiza la fecha de precios
  await adm("/producto", { metodo: "PUT", cuerpo: { ...p, agotado: false, precio: 15.5 }, cookie });
  m = await almacen.leerMeta();
  assert.equal(m.precios.slice(0, 10), hoy);
  const cat = await (await catalogo(deps())).json();
  assert.equal(cat.preciosActualizados, hoy);

  // aceptar de golpe los orientativos NO cuenta como «precios al día» (son estimaciones sin revisar)
  reloj += 24 * 3600 * 1000;
  cookie = await entrar(); // la sesión dura 8 h: tras saltar días hay que volver a entrar
  const manana = new Date(reloj).toISOString().slice(0, 10);
  await adm("/producto", { metodo: "PUT", cuerpo: { nombre: "Producto sin precio de prueba", categoria: "vacuno", unidad: "kg", paso: 250 }, cookie });
  await adm("/orientativos", { metodo: "POST", cuerpo: {}, cookie });
  m = await almacen.leerMeta();
  assert.equal(m.contenido.slice(0, 10), manana);
  assert.equal(m.precios.slice(0, 10), hoy, "la fecha de precios no cambia al aceptar orientativos en bloque");

  // confirmar que están al día la actualiza (y exige sesión)
  assert.equal((await adm("/precios-al-dia", { metodo: "POST", cuerpo: {} })).status, 401);
  const r = await adm("/precios-al-dia", { metodo: "POST", cuerpo: {}, cookie });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).meta.precios.slice(0, 10), manana);
  assert.equal((await (await catalogo(deps())).json()).preciosActualizados, manana);

  // el redondeo masivo cuenta como cambio de precios solo si toca algo
  reloj += 24 * 3600 * 1000;
  cookie = await entrar(); // la sesión dura 8 h: tras saltar días hay que volver a entrar
  const pasado = new Date(reloj).toISOString().slice(0, 10);
  await adm("/redondeo", { metodo: "POST", cuerpo: { final: 95 }, cookie });
  assert.equal((await almacen.leerMeta()).precios.slice(0, 10), pasado);
  await adm("/redondeo", { metodo: "POST", cuerpo: { final: 95 }, cookie }); // ya redondeado: no toca nada
  reloj += 24 * 3600 * 1000;
  cookie = await entrar(); // la sesión dura 8 h: tras saltar días hay que volver a entrar
  await adm("/redondeo", { metodo: "POST", cuerpo: { final: 95 }, cookie });
  assert.equal((await almacen.leerMeta()).precios.slice(0, 10), pasado, "sin cambios reales, la fecha no se mueve");

  // se purga también la caché de las páginas (el pie lleva la fecha)
  assert.ok(purgas.includes("paginas"));
  // y el mapa del sitio usa la fecha de actualización
  const sm = await (await pagina(new Request(`${ORIGEN}/sitemap.xml`), deps())).text();
  assert.match(sm, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test("mercado: /datos trae las fuentes de partida y los 30 productos de referencia; PUT valida y guarda; sin cambios públicos", async () => {
  cookie ??= await entrar();
  const { mercado, hoy } = await (await adm("/datos", { cookie })).json();
  assert.equal(hoy, ahoraEnMadrid(new Date(reloj)).fecha, "la fecha de hoy es la de Madrid");
  assert.equal(mercado.anclas.length, 30);
  assert.equal(mercado.version, 0);
  assert.ok(mercado.fuentes.length >= 8 && mercado.fuentes.every((f) => f.tipo === "supermercado"));
  assert.deepEqual(mercado.precios, {});

  const antes = purgas.length;
  const ok = await adm("/mercado", { metodo: "PUT", cookie, cuerpo: { version: 0, fuentes: mercado.fuentes, precios: { "pollo-pechuga-de-pollo": { mercadona: { precio: "7,95", fecha: "2026-10-04" } } } } });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).mercado.version, 1);
  assert.equal(purgas.length, antes, "es interno: no purga la web pública");
  const otra = await (await adm("/datos", { cookie })).json();
  assert.deepEqual(otra.mercado.precios, { "pollo-pechuga-de-pollo": { mercadona: { precio: 7.95, fecha: "2026-10-04" } } });
  assert.equal(otra.mercado.anclas.length, 30, "las anclas no se guardan ni se pisan");

  // el catálogo público no lo menciona
  const cat = await (await catalogo(deps())).text();
  assert.ok(!/mercadona|mediana/i.test(cat));

  // validación (nunca 500)
  const base = { version: 1, fuentes: mercado.fuentes };
  const p = (dato) => ({ ...base, precios: { "pollo-pechuga-de-pollo": { mercadona: dato } } });
  for (const cuerpo of [
    { ...base, precios: { "no-existe": {} } },
    p({ precio: 0, fecha: "2026-10-04" }),
    p({ precio: 5, fecha: "2025-13-45" }),
    p({ precio: 5 }),
    p(null),
    { ...base, fuentes: [{ ...mercado.fuentes[0], frecuencia: "constructor" }], precios: {} },
    { ...base, fuentes: [{ ...mercado.fuentes[0], tipo: "__proto__" }], precios: {} },
    { ...base, fuentes: "x", precios: {} },
  ]) {
    const r = await adm("/mercado", { metodo: "PUT", cookie, cuerpo });
    assert.equal(r.status, 400, JSON.stringify(cuerpo).slice(0, 120));
    assert.ok((await r.json()).errores.length);
  }
  assert.equal((await adm("/mercado", { metodo: "PUT", cookie, cuerpo: { fuentes: [], precios: {} }, origen: "https://evil.test" })).status, 403);
  assert.equal((await adm("/mercado", { metodo: "PUT", cookie, raw: "x".repeat(300 * 1024), cabeceras: { "content-type": "application/json" } })).status, 413);
});

test("mercado: editar con datos viejos (otro dispositivo) da 409 y no pisa lo guardado", async () => {
  cookie ??= await entrar();
  const { mercado } = await (await adm("/datos", { cookie })).json();
  assert.equal(mercado.version, 1);
  const precios = { ...mercado.precios, "pollo-muslo-de-pollo": { lidl: { precio: 4.5, fecha: "2026-10-04" } } };
  assert.equal((await adm("/mercado", { metodo: "PUT", cookie, cuerpo: { version: 1, fuentes: mercado.fuentes, precios } })).status, 200); // otro dispositivo: ahora es la versión 2
  const viejo = await adm("/mercado", { metodo: "PUT", cookie, cuerpo: { version: 1, fuentes: mercado.fuentes, precios: mercado.precios } });
  assert.equal(viejo.status, 409);
  assert.match((await viejo.json()).errores[0].mensaje, /ha cambiado desde otro dispositivo/);
  assert.equal((await adm("/mercado", { metodo: "PUT", cookie, cuerpo: { fuentes: mercado.fuentes, precios } })).status, 409, "sin versión tampoco");
  const ahora = (await (await adm("/datos", { cookie })).json()).mercado;
  assert.ok(ahora.precios["pollo-muslo-de-pollo"], "lo del otro dispositivo sigue ahí");
});

test("mercado: al borrar un producto se limpian sus precios y los guardados de uno ya borrado no bloquean el panel", async () => {
  cookie ??= await entrar();
  const lista = await almacen.leerProductos();
  const muslo = lista.find((x) => x.id === "pollo-muslo-de-pollo");
  assert.equal((await adm("/producto?id=pollo-muslo-de-pollo", { metodo: "DELETE", cookie })).status, 200);
  let { mercado } = await (await adm("/datos", { cookie })).json();
  assert.equal(mercado.precios["pollo-muslo-de-pollo"], undefined, "limpiado al borrar");
  assert.equal(mercado.version, 3);

  // un huérfano que ya estuviera guardado (versión anterior a la limpieza) tampoco impide guardar
  await almacen.actualizarMercado((m) => ({ ...m, precios: { ...m.precios, fantasma: { lidl: { precio: 3, fecha: "2026-10-04" } } } }));
  mercado = (await (await adm("/datos", { cookie })).json()).mercado;
  const r = await adm("/mercado", { metodo: "PUT", cookie, cuerpo: { version: mercado.version, fuentes: mercado.fuentes, precios: mercado.precios } });
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  assert.equal((await r.json()).mercado.precios.fantasma, undefined);
  await almacen.actualizarProductos((l) => [...l, muslo]); // se deja el catálogo como estaba
});
