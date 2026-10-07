import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarPedido, numeroPedido, mensajeWhatsApp, enlaceWhatsApp, consultaGeocodificacion } from "../lib/pedido.mjs";

const leer = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const productos = leer("productos.default.json");
const ajustes = leer("ajustes.default.json");
ajustes.tienda.activa = true;
const conPrecio = (id, precio) => { const p = productos.find((x) => x.id === id); p.precio = precio; return p; };
conPrecio("vacuno-solomillo-de-ternera", 24.9);
conPrecio("pollo-pollo-entero", 8.5);
conPrecio("vino-vino-tinto-crianza", 7.9);

// Lunes 2026-10-05, 09:00 en Madrid
const AHORA = { fecha: "2026-10-05", dia: 1, minutos: 9 * 60 };

const pedidoOk = () => ({
  lineas: [{ id: "vacuno-solomillo-de-ternera", cantidad: 500, opcion: "En medallones" }, { id: "pollo-pollo-entero", cantidad: 2 }],
  cliente: { nombre: "Ana Pérez", telefono: "655 44 33 22" },
  entrega: { tipo: "recogida", dia: "2026-10-07", franja: "11:00-13:00" },
  pago: "efectivo",
});
const validar = (e, a = ajustes, ahora = AHORA) => validarPedido(e, { productos, ajustes: a, ahora });
const clone = (o) => JSON.parse(JSON.stringify(o));

test("un pedido correcto se acepta y el servidor calcula los totales", () => {
  const r = validar(pedidoOk());
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  const p = r.valor;
  assert.equal(p.cliente.telefono, "655443322");
  assert.equal(p.lineas[0].subtotalCent, 1245); // 0,5 kg * 24,90
  assert.equal(p.lineas[1].subtotalCent, 1700);
  assert.equal(p.subtotalCent, 2945);
  assert.equal(p.totalCent, 2945);
  assert.equal(p.consultar, 0);
});

test("ignora cualquier precio o total que mande el navegador", () => {
  const e = pedidoOk(); e.lineas[0].precio = 0.01; e.total = 0; e.totalCent = 1;
  const r = validar(e);
  assert.equal(r.valor.lineas[0].precio, 24.9);
  assert.equal(r.valor.totalCent, 2945);
});

test("productos sin precio cuentan como 'por consultar'", () => {
  const e = pedidoOk(); e.lineas.push({ id: "cerdo-solomillo-de-cerdo", cantidad: 250 });
  const r = validar(e);
  assert.equal(r.valor.consultar, 1);
  assert.equal(r.valor.subtotalCent, 2945);
});

test("rechaza pedido vacío, productos inexistentes, agotados y cantidades incorrectas", () => {
  assert.equal(validar({ ...pedidoOk(), lineas: [] }).ok, false);
  assert.equal(validar({ ...pedidoOk(), lineas: [{ id: "no-existe", cantidad: 1 }] }).ok, false);
  const a = clone(productos); a.find((p) => p.id === "pollo-pollo-entero").agotado = true;
  assert.equal(validarPedido(pedidoOk(), { productos: a, ajustes, ahora: AHORA }).ok, false);
  const e = pedidoOk(); e.lineas[0].cantidad = 300;
  assert.equal(validar(e).ok, false);
  const f = pedidoOk(); f.lineas[0].cantidad = "500";
  assert.equal(validar(f).ok, false);
  const g = pedidoOk(); g.lineas[0].opcion = "Inventada";
  assert.equal(validar(g).ok, false);
});

test("fusiona líneas iguales antes de comprobar el máximo", () => {
  const e = pedidoOk(); e.lineas = [{ id: "pollo-pollo-entero", cantidad: 30 }, { id: "pollo-pollo-entero", cantidad: 30 }];
  assert.equal(validar(e).ok, false); // 60 > 50
  const f = pedidoOk(); f.lineas = [{ id: "pollo-pollo-entero", cantidad: 1 }, { id: "pollo-pollo-entero", cantidad: 1 }];
  assert.equal(validar(f).valor.lineas.length, 1);
  assert.equal(validar(f).valor.lineas[0].cantidad, 2);
});

test("la tienda desactivada no acepta pedidos", () => {
  const a = clone(ajustes); a.tienda.activa = false;
  const r = validar(pedidoOk(), a);
  assert.equal(r.ok, false);
  assert.equal(r.errores[0].campo, "tienda");
});

test("fecha: pasada, demasiado lejana, domingo, día sin servicio y franja fuera de horario", () => {
  const f = (cambio) => { const e = pedidoOk(); Object.assign(e.entrega, cambio); return validar(e); };
  assert.equal(f({ dia: "2026-10-04" }).ok, false);
  assert.equal(f({ dia: "2026-12-01" }).ok, false);
  assert.equal(f({ dia: "2026-10-11" }).ok, false); // domingo
  const a = clone(ajustes); a.tienda.diasSinServicio = ["2026-10-07"];
  assert.equal(validar(pedidoOk(), a).ok, false);
  assert.equal(f({ dia: "2026-10-10", franja: "17:30-19:30" }).ok, false); // sábado por la tarde: cerrado
  assert.equal(f({ franja: "03:00-04:00" }).ok, false);
});

test("antelación mínima el mismo día", () => {
  const e = pedidoOk(); e.entrega = { tipo: "recogida", dia: "2026-10-05", franja: "09:00-11:00" };
  assert.equal(validar(e).ok, false); // son las 9:00 y la franja empieza ya
  e.entrega.franja = "11:00-13:00";
  assert.equal(validar(e).ok, true);
});

test("reparto exige dirección y respeta mínimo, coste y envío gratis", () => {
  const a = clone(ajustes); a.tienda.reparto = { ...a.tienda.reparto, activo: true, minimo: 30, coste: 3.5, gratisDesde: 60 };
  const e = pedidoOk(); e.entrega = { tipo: "reparto", dia: "2026-10-07", franja: "10:00-13:00" };
  assert.equal(validar(e, a).ok, false); // sin dirección
  e.entrega.direccion = "Calle Gálena 2, 2º B";
  assert.ok(validar(e, a).errores.some((x) => x.campo === "entrega.cp")); // sin código postal
  e.entrega.cp = "41008";
  const bajo = validar(e, a); assert.equal(bajo.ok, false); // 29,45 < 30
  e.lineas[1].cantidad = 3; // 25,5 + 12,45 = 37,95
  const ok = validar(e, a); assert.equal(ok.ok, true, JSON.stringify(ok.errores));
  assert.equal(ok.valor.envioCent, 350);
  assert.equal(ok.valor.totalCent, 3795 + 350);
  e.lineas[1].cantidad = 8; // 12,45 + 68 = 80,45 -> gratis
  assert.equal(validar(e, a).valor.envioCent, 0);
});

test("tarjeta solo con recogida; formas de pago desactivadas se rechazan", () => {
  const e = pedidoOk(); e.pago = "tarjeta";
  assert.equal(validar(e).ok, true);
  const r = pedidoOk(); r.entrega = { tipo: "reparto", dia: "2026-10-07", franja: "10:00-13:00", direccion: "Calle Gálena 2, 2º B", cp: "41008" }; r.pago = "tarjeta";
  assert.equal(validar(r).ok, false);
  const a = clone(ajustes); a.tienda.pagos.bizum = false; const b = pedidoOk(); b.pago = "bizum";
  assert.equal(validar(b, a).ok, false);
});

test("vino: exige confirmar mayoría de edad", () => {
  const e = pedidoOk(); e.lineas.push({ id: "vino-vino-tinto-crianza", cantidad: 2 });
  const sin = validar(e); assert.equal(sin.ok, false);
  assert.ok(sin.errores.some((x) => x.campo === "mayorEdad"));
  e.mayorEdad = true; assert.equal(validar(e).ok, true);
});

test("pedido mínimo global (solo si todo tiene precio) y honeypot", () => {
  const a = clone(ajustes); a.tienda.pedidoMinimo = 100;
  assert.equal(validar(pedidoOk(), a).ok, false);
  const e = pedidoOk(); e.web = "http://spam";
  assert.equal(validar(e).ok, false);
});

test("mensaje de WhatsApp: legible, con número, y se acorta si es larguísimo", () => {
  const r = validar(pedidoOk()).valor;
  const n = numeroPedido("2026-10-05", 7);
  assert.equal(n, "LE-2610-0007");
  const msg = mensajeWhatsApp(r, n);
  assert.match(msg, /Pedido LE-2610-0007/);
  assert.match(msg, /Solomillo de ternera: 500 g \(En medallones\)/);
  assert.match(msg, /Pollo entero: 2 ud/);
  assert.match(msg, /Recogida en tienda: miércoles, 7 de octubre|Recogida en tienda: miércoles 7 de octubre/);
  assert.match(msg, /Total estimado: 29,45/);
  const enlace = enlaceWhatsApp(r, n, "34601006290");
  assert.ok(enlace.url.startsWith("https://wa.me/34601006290?text="));
  assert.equal(enlace.resumido, false);
  const grande = clone(r); grande.lineas = Array.from({ length: 60 }, (_, i) => ({ ...grande.lineas[0], nombre: `Producto muy largo número ${i}`, nota: "nota bastante larga para ocupar espacio" }));
  const e2 = enlaceWhatsApp(grande, n, "34601006290");
  assert.equal(e2.resumido, true);
  assert.ok(e2.url.length <= 1800);
});

// ---------- zona de reparto ----------
const reparto = (zona) => { const a = clone(ajustes); a.tienda.reparto = { ...a.tienda.reparto, activo: true, ...zona }; return a; };
const pedidoReparto = (cp = "41008") => { const e = pedidoOk(); e.entrega = { tipo: "reparto", dia: "2026-10-07", franja: "10:00-13:00", direccion: "Calle Gálena 2, 2º B", cp }; return e; };
const conGeo = (e, a, geo) => validarPedido(e, { productos, ajustes: a, ahora: AHORA, geo });

test("zona por códigos postales: solo se reparte en los de la lista", () => {
  const a = reparto({ codigosPostales: ["41008", "41009"] });
  assert.equal(validar(pedidoReparto("41008"), a).ok, true);
  assert.equal(validar(pedidoReparto("41 009"), a).ok, true, "admite espacios");
  const fuera = validar(pedidoReparto("41013"), a);
  assert.equal(fuera.ok, false);
  assert.match(fuera.errores.find((x) => x.campo === "entrega.cp").mensaje, /no repartimos en el código postal 41013/);
  assert.equal(validar(pedidoReparto("abc"), a).ok, false);
});

test("sin zona definida se reparte en cualquier código postal válido (pero el CP es obligatorio)", () => {
  assert.equal(validar(pedidoReparto("28001"), reparto({})).ok, true);
  assert.equal(validar(pedidoReparto("2800"), reparto({})).ok, false);
});

test("radio en km: dentro se acepta, fuera se rechaza con la distancia, y sin localizar entra «por verificar»", () => {
  const a = reparto({ radioKm: 3 });
  const dentro = conGeo(pedidoReparto("41010"), a, { distanciaKm: 1.4 });
  assert.equal(dentro.ok, true); assert.equal(dentro.valor.entrega.distanciaKm, 1.4); assert.equal(dentro.valor.entrega.zonaVerificada, true);
  const fuera = conGeo(pedidoReparto("41010"), a, { distanciaKm: 7.2 });
  assert.equal(fuera.ok, false);
  assert.match(fuera.errores.find((x) => x.campo === "entrega.direccion").mensaje, /7,2 km.*hasta 3 km/);
  const sinLocalizar = conGeo(pedidoReparto("41010"), a, null);
  assert.equal(sinLocalizar.ok, true); assert.equal(sinLocalizar.valor.entrega.zonaVerificada, false); assert.equal(sinLocalizar.valor.entrega.distanciaKm, null);
});

test("radio + lista: un CP de la lista entra sin comprobar distancia", () => {
  const a = reparto({ radioKm: 2, codigosPostales: ["41008"] });
  const r = conGeo(pedidoReparto("41008"), a, { distanciaKm: 9 }); // aunque la distancia sea mayor
  assert.equal(r.ok, true); assert.equal(r.valor.entrega.zonaVerificada, true);
  assert.equal(conGeo(pedidoReparto("41020"), a, { distanciaKm: 9 }).ok, false);
});

test("consultaGeocodificacion: solo cuando hace falta localizar la dirección", () => {
  const a = reparto({ radioKm: 3, codigosPostales: ["41008"] });
  assert.match(consultaGeocodificacion(pedidoReparto("41010"), a), /^Calle Gálena 2, 2º B, 41010 Sevilla, España$/);
  assert.equal(consultaGeocodificacion(pedidoReparto("41008"), a), null, "CP de la lista");
  assert.equal(consultaGeocodificacion(pedidoReparto("41010"), reparto({})), null, "sin radio");
  assert.equal(consultaGeocodificacion(pedidoOk(), a), null, "recogida");
  const corto = pedidoReparto("41010"); corto.entrega.direccion = "x";
  assert.equal(consultaGeocodificacion(corto, a), null);
});

test("el pedido de reparto guarda CP y el mensaje de WhatsApp lo incluye", () => {
  const r = validar(pedidoReparto("41008"), reparto({}));
  assert.equal(r.valor.entrega.cp, "41008");
  assert.match(mensajeWhatsApp(r.valor, "LE-2610-0001"), /Dirección: Calle Gálena 2, 2º B \(41008\)/);
});
