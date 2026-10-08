import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { historialActualizado, precioAnterior, rebajaValida, estaVigente, ofertaVigente, precioEfectivo, calcularLineas, regalosDelPedido, nombreOferta, hayRangosSolapados, destacadas, tituloDestacadas, textoRegalo, condicionRegalo, fechaCorta } from "../lib/ofertas.mjs";
import { validarProducto, catalogoPublico } from "../lib/productos.mjs";
import { validarAjustes } from "../lib/ajustes.mjs";
import { validarPedido, mensajeWhatsApp } from "../lib/pedido.mjs";
import { sumarDias } from "../lib/horario.mjs";

const leer = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const kg = (extra = {}) => ({ id: "x", unidad: "kg", precio: 29.95, ofertas: [], ...extra });
const precio = (desde, hasta, p = 19.95) => ({ tipo: "precio", desde, hasta, precio: p });
const tres = (desde, hasta) => ({ tipo: "cantidad", desde, hasta, lleva: 3, paga: 2 });

test("vigencia: días completos, inicio y fin incluidos; sin fecha = sin límite", () => {
  const o = { desde: "2026-10-05", hasta: "2026-10-11" };
  assert.equal(estaVigente(o, "2026-10-04"), false);
  assert.equal(estaVigente(o, "2026-10-05"), true, "el primer día ya cuenta");
  assert.equal(estaVigente(o, "2026-10-11"), true, "el último día todavía cuenta");
  assert.equal(estaVigente(o, "2026-10-12"), false);
  assert.equal(estaVigente({ desde: null, hasta: "2026-10-11" }, "2020-01-01"), true);
  assert.equal(estaVigente({ desde: "2026-10-05", hasta: null }, "2099-01-01"), true);
  assert.equal(ofertaVigente([precio("2026-10-05", "2026-10-11")], "2026-10-06").precio, 19.95);
  assert.equal(ofertaVigente([{ tipo: "precio", precio: 1 }], "2026-10-06"), null, "una oferta sin fechas no se aplica");
  assert.equal(ofertaVigente(undefined, "2026-10-06"), null);
});

test("precio rebajado: el efectivo es el de oferta y el habitual sale para tacharlo; fuera de fechas, el habitual", () => {
  const p = kg({ ofertas: [precio("2026-10-05", "2026-10-11")] });
  assert.deepEqual({ ...precioEfectivo(p, "2026-10-07"), oferta: undefined }, { precio: 19.95, habitual: 29.95, oferta: undefined });
  assert.deepEqual(precioEfectivo(p, "2026-10-12"), { precio: 29.95, habitual: null, oferta: null });
  assert.deepEqual(precioEfectivo(p, "2026-10-04"), { precio: 29.95, habitual: null, oferta: null });
});

test("una rebaja que ya no es más barata que el precio habitual no se aplica", () => {
  const p = kg({ precio: 18, ofertas: [precio("2026-10-05", "2026-10-11")] }); // el habitual bajó a 18 € después de programar 19,95 €
  assert.equal(precioEfectivo(p, "2026-10-07").precio, 18);
  assert.equal(precioEfectivo(p, "2026-10-07").habitual, null);
  assert.equal(precioEfectivo({ ...p, precio: null }, "2026-10-07").precio, null);
});

test("importe de una línea con precio rebajado, en céntimos", () => {
  const p = kg({ ofertas: [precio("2026-10-05", "2026-10-11")] });
  const [l] = calcularLineas([{ p, cantidad: 1500 }], "2026-10-07");
  assert.equal(l.subtotalCent, 2993); // 1,5 kg × 19,95 = 29,925 -> 29,93
  assert.equal(l.ahorroCent, 4493 - 2993, "ahorro frente al habitual: 44,925 -> 44,93");
  assert.equal(l.habitual, 29.95);
  assert.equal(nombreOferta(l.oferta), "Oferta");
});

test("3x2 en kilos: 3 kg pagan 2; 4,5 kg regalan 1 kg; menos de 3 kg no regala nada", () => {
  const p = kg({ id: "alb", precio: 9.9, ofertas: [tres("2026-10-05", "2026-10-11")] });
  const c = (g) => calcularLineas([{ p, cantidad: g }], "2026-10-07")[0];
  assert.equal(c(3000).subtotalCent, 1980, "3 kg × 9,90 = 29,70, paga 2 kg = 19,80");
  assert.equal(c(3000).gratis, 1000);
  assert.equal(c(3000).ahorroCent, 990);
  assert.equal(c(4500).subtotalCent, 3465, "paga 3,5 kg");
  assert.equal(c(4500).gratis, 1000);
  assert.equal(c(2750).gratis, 0);
  assert.equal(c(2750).subtotalCent, 2723, "sin oferta: 2,75 × 9,90 = 27,225 -> 27,23 (redondeo medio hacia arriba, como siempre)");
  assert.equal(c(6000).gratis, 2000, "dos tramos completos");
  assert.equal(c(6000).subtotalCent, 3960);
  assert.equal(nombreOferta(c(3000).oferta), "3x2");
});

test("3x2 en unidades; 2x1; y no se aplica fuera de fechas", () => {
  const u = { id: "u", unidad: "ud", precio: 4, ofertas: [tres("2026-10-05", "2026-10-11")] };
  assert.equal(calcularLineas([{ p: u, cantidad: 3 }], "2026-10-07")[0].subtotalCent, 800);
  assert.equal(calcularLineas([{ p: u, cantidad: 5 }], "2026-10-07")[0].subtotalCent, 1600, "5 ud: un tramo de 3 (paga 2) + 2 sueltas = 4 pagadas");
  assert.equal(calcularLineas([{ p: u, cantidad: 3 }], "2026-10-12")[0].subtotalCent, 1200);
  const dos = { ...u, ofertas: [{ tipo: "cantidad", desde: "2026-10-05", hasta: "2026-10-11", lleva: 2, paga: 1 }] };
  assert.equal(calcularLineas([{ p: dos, cantidad: 4 }], "2026-10-07")[0].subtotalCent, 800);
});

test("3x2: los tramos cuentan sobre el total del producto aunque esté en varias líneas (con notas distintas) y lo gratis se reparte por orden", () => {
  const p = kg({ id: "alb", precio: 10, ofertas: [tres("2026-10-05", "2026-10-11")] });
  const r = calcularLineas([{ p, cantidad: 2000 }, { p, cantidad: 1000 }, { p: kg({ id: "otro", precio: 10 }), cantidad: 3000 }], "2026-10-07");
  assert.equal(r[0].gratis + r[1].gratis, 1000);
  assert.equal(r[0].gratis, 1000, "va a la primera línea");
  assert.equal(r[0].subtotalCent + r[1].subtotalCent, 2000, "3 kg pagan 2 kg");
  assert.equal(r[2].gratis, 0, "otro producto sin oferta");
  assert.equal(r[2].subtotalCent, 3000);
});

test("productos sin precio: ni importe ni ahorro, aunque tengan oferta de cantidad", () => {
  const p = kg({ precio: null, ofertas: [tres("2026-10-05", "2026-10-11")] });
  const [l] = calcularLineas([{ p, cantidad: 3000 }], "2026-10-07");
  assert.equal(l.subtotalCent, null);
  assert.equal(l.ahorroCent, 0);
  assert.equal(l.gratis, 0);
});

const regalo = (extra = {}) => ({ regalo: "250 g de chorizo", minimo: 30, repetir: true, maximo: null, desde: "2026-10-05", hasta: "2026-10-11", ...extra });

test("regalo «por cada 30 €»: 29,99 € no, 30 € uno, 59,99 € uno, 60 € dos; con máximo, tope", () => {
  const n = (cent, r = regalo()) => regalosDelPedido([r], cent, "2026-10-07")[0].cantidad;
  assert.equal(n(2999), 0);
  assert.equal(n(3000), 1);
  assert.equal(n(5999), 1);
  assert.equal(n(6000), 2);
  assert.equal(n(10000), 3);
  assert.equal(n(10000, regalo({ maximo: 2 })), 2);
  assert.equal(n(10000, regalo({ repetir: false })), 1, "«a partir de 30 €»: solo uno por muchos euros que se gasten");
  assert.equal(n(2999, regalo({ repetir: false })), 0);
});

test("regalo: cuánto falta para el siguiente, y fuera de fechas no aparece", () => {
  const f = (cent, r = regalo()) => regalosDelPedido([r], cent, "2026-10-07")[0].faltaCent;
  assert.equal(f(0), 3000);
  assert.equal(f(2000), 1000);
  assert.equal(f(3000), 3000, "ya tiene uno; para el siguiente faltan otros 30 €");
  assert.equal(f(4500), 1500);
  assert.equal(f(4500, regalo({ repetir: false })), null, "el regalo único ya lo tiene");
  assert.equal(f(7000, regalo({ maximo: 2 })), null, "ya tiene el máximo");
  assert.deepEqual(regalosDelPedido([regalo()], 9000, "2026-10-04"), []);
  assert.deepEqual(regalosDelPedido([regalo()], 9000, "2026-10-12"), []);
  assert.equal(regalosDelPedido([regalo({ desde: null, hasta: null })], 3000, "2030-01-01")[0].cantidad, 1, "sin fechas, siempre");
});

test("rangos de fechas solapados", () => {
  assert.equal(hayRangosSolapados([precio("2026-10-05", "2026-10-11"), tres("2026-10-12", "2026-10-18")]), null, "el día siguiente no se pisa");
  assert.ok(hayRangosSolapados([precio("2026-10-05", "2026-10-11"), tres("2026-10-11", "2026-10-18")]), "compartir el último día sí se pisa");
  assert.ok(hayRangosSolapados([tres("2026-10-01", "2026-10-30"), precio("2026-10-10", "2026-10-12")]));
});

// ---- validación de la ficha del producto ----
const base = { nombre: "Secreto ibérico", categoria: "cerdo-iberico", unidad: "kg", precio: 29.95 };
const cats = ["cerdo-iberico"];
const valida = (ofertas, extra = {}) => validarProducto({ ...base, ofertas, ...extra }, { categorias: cats });

test("producto: acepta ofertas correctas, las ordena por fecha y no toca el precio con el redondeo", () => {
  const v = validarProducto({ ...base, precio: 29.95, ofertas: [tres("2026-10-20", "2026-10-26"), precio("2026-10-05", "2026-10-11")] }, { categorias: cats, redondeo: 90 });
  assert.equal(v.ok, true, JSON.stringify(v.errores));
  assert.equal(v.valor.precio, 30.9, "el habitual sí se redondea, como siempre");
  assert.deepEqual(v.valor.ofertas.map((o) => o.tipo), ["precio", "cantidad"]);
  assert.equal(v.valor.ofertas[0].precio, 19.95, "el precio de oferta se queda exacto");
});

test("producto: rechaza ofertas imposibles con mensajes claros", () => {
  const malo = (ofertas, re, extra) => { const v = valida(ofertas, extra); assert.equal(v.ok, false, JSON.stringify(ofertas)); assert.match(v.errores.map((e) => e.mensaje).join(" | "), re); };
  malo([precio("2026-10-11", "2026-10-05")], /fin no puede ser anterior/);
  malo([precio("2026-10-05", "")], /fecha de inicio y la de fin/);
  malo([precio("2026-13-45", "2026-10-11")], /fecha de inicio y la de fin/);
  malo([precio("2026-10-05", "2026-10-11", 29.95)], /más barato que el habitual/);
  malo([precio("2026-10-05", "2026-10-11", 35)], /más barato que el habitual/);
  malo([precio("2026-10-05", "2026-10-11", 0)], /precio/i);
  malo([precio("2026-10-05", "2026-10-11")], /Pon primero el precio habitual/, { precio: null });
  malo([{ tipo: "cantidad", desde: "2026-10-05", hasta: "2026-10-11", lleva: 3, paga: 3 }], /pagar menos/);
  malo([{ tipo: "cantidad", desde: "2026-10-05", hasta: "2026-10-11", lleva: 1, paga: 1 }], /lleva|entre/i);
  malo([{ tipo: "cantidad", desde: "2026-10-05", hasta: "2026-10-11", lleva: 3.5, paga: 2 }], /entero/);
  malo([{ tipo: "regalo", desde: "2026-10-05", hasta: "2026-10-11" }], /Elige el tipo/);
  malo([precio("2026-10-05", "2026-10-11"), tres("2026-10-08", "2026-10-15")], /coinciden en fechas/);
  malo(Array.from({ length: 9 }, (_, i) => precio(`2026-0${(i % 9) + 1}-01`, `2026-0${(i % 9) + 1}-02`)), /Máximo 8/);
  malo("hola", /lista/);
  malo([null], /no válida/);
});

test("producto: una oferta de cantidad no necesita precio habitual", () => {
  assert.equal(valida([tres("2026-10-05", "2026-10-11")], { precio: null }).ok, true);
});

test("catálogo público: solo la oferta activa hoy; lo programado para más adelante no se adelanta", () => {
  const p = { id: "a", orden: 1, oculto: false, coste: 1, merma: 1, margen: 1, ofertas: [precio("2026-10-05", "2026-10-11"), tres("2026-10-20", "2026-10-26")] };
  const dia = (hoy) => catalogoPublico([p], hoy)[0].ofertas.map((o) => o.tipo);
  assert.deepEqual(dia("2026-10-07"), ["precio"]);
  assert.deepEqual(dia("2026-10-15"), []);
  assert.deepEqual(dia("2026-10-20"), ["cantidad"]);
  assert.equal(catalogoPublico([{ id: "b", orden: 1 }], "2026-10-07")[0].ofertas.length, 0, "productos antiguos sin ofertas");
  assert.equal("coste" in catalogoPublico([p], "2026-10-07")[0], false);
});

// ---- ajustes: regalos ----
const ajustesBase = () => { const a = leer("ajustes.default.json"); a.negocio.telefono = "955000000"; return a; };
test("ajustes: regalos válidos se guardan normalizados; con errores se explican", () => {
  const a = ajustesBase();
  a.tienda.regalos = [{ regalo: "  250 g de chorizo ", minimo: "30", repetir: true, maximo: "", desde: "2026-10-05", hasta: "2026-10-11" }, { regalo: "Una botella", minimo: 50, desde: "", hasta: null }];
  const v = validarAjustes(a);
  assert.equal(v.ok, true, JSON.stringify(v.errores));
  assert.deepEqual(v.valor.tienda.regalos[0], { regalo: "250 g de chorizo", minimo: 30, repetir: true, maximo: null, desde: "2026-10-05", hasta: "2026-10-11" });
  assert.deepEqual(v.valor.tienda.regalos[1], { regalo: "Una botella", minimo: 50, repetir: false, maximo: null, desde: null, hasta: null });
  const mal = (r, re) => { const b = ajustesBase(); b.tienda.regalos = [r]; const x = validarAjustes(b); assert.equal(x.ok, false); assert.match(x.errores.map((e) => e.mensaje).join(" | "), re); };
  mal({ regalo: "", minimo: 30 }, /obligatorio/);
  mal({ regalo: "x", minimo: 0 }, /entre 1 y|euros/);
  mal({ regalo: "x" }, /euros/);
  mal({ regalo: "x", minimo: 30, desde: "2026-10-11", hasta: "2026-10-05" }, /fin no puede ser anterior/);
  mal({ regalo: "x", minimo: 30, hasta: "ayer" }, /Fecha no válida/);
  mal({ regalo: "x", minimo: 30, maximo: 0 }, /entre 1 y 20/);
  const muchos = ajustesBase(); muchos.tienda.regalos = Array.from({ length: 6 }, () => ({ regalo: "x", minimo: 30 }));
  assert.equal(validarAjustes(muchos).ok, false);
  const sin = ajustesBase(); delete sin.tienda.regalos;
  assert.deepEqual(validarAjustes(sin).valor.tienda.regalos, [], "ajustes antiguos sin regalos");
});

// ---- pedido completo ----
const productos = leer("productos.default.json");
const aj = leer("ajustes.default.json"); aj.tienda.activa = true;
const AHORA = { fecha: "2026-10-07", dia: 3, minutos: 9 * 60 };
const prod = (id, extra) => { const p = productos.find((x) => x.id === id); Object.assign(p, extra); return p; };
prod("elaborados-albondigas", { precio: 9.9, ofertas: [tres("2026-10-05", "2026-10-11")] });
prod("cerdo-iberico-secreto-iberico", { precio: 29.95, ofertas: [precio("2026-10-05", "2026-10-11")] });
prod("pollo-pollo-entero", { precio: 8.5, ofertas: [] });
const pedido = (lineas, dia = "2026-10-08") => ({ lineas, cliente: { nombre: "Ana Pérez", telefono: "655443322" }, entrega: { tipo: "recogida", dia, franja: "11:00-13:00" }, pago: "efectivo" });
const manana = (fecha) => sumarDias(fecha, 1);
const hacer = (lineas, ajustes = aj, ahora = AHORA) => validarPedido(pedido(lineas, manana(ahora.fecha)), { productos, ajustes, ahora });

test("pedido: el servidor aplica las ofertas de hoy (3x2 y precio rebajado) y guarda el detalle de cada línea", () => {
  const r = hacer([{ id: "elaborados-albondigas", cantidad: 3000 }, { id: "cerdo-iberico-secreto-iberico", cantidad: 1000 }]);
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  const [alb, sec] = r.valor.lineas;
  assert.equal(alb.subtotalCent, 1980);
  assert.equal(alb.oferta, "3x2");
  assert.equal(alb.gratis, 1000);
  assert.equal(alb.ahorroCent, 990);
  assert.equal(sec.subtotalCent, 1995);
  assert.equal(sec.precio, 19.95);
  assert.equal(sec.precioHabitual, 29.95);
  assert.equal(sec.ahorroCent, 1000);
  assert.equal(r.valor.subtotalCent, 3975);
  assert.equal(r.valor.ahorroCent, 1990);
  assert.deepEqual(r.valor.regalos, []);
});

test("pedido: fuera de fechas, precio normal y sin ahorro; la fecha que cuenta es la de Madrid del pedido", () => {
  const r = hacer([{ id: "elaborados-albondigas", cantidad: 3000 }], aj, { fecha: "2026-10-12", dia: 1, minutos: 9 * 60 });
  assert.equal(r.valor.lineas[0].subtotalCent, 2970);
  assert.equal(r.valor.lineas[0].oferta, "");
  assert.equal(r.valor.ahorroCent, 0);
  const ultimo = hacer([{ id: "elaborados-albondigas", cantidad: 3000 }], aj, { fecha: "2026-10-11", dia: 7, minutos: 23 * 60 + 59 });
  assert.equal(ultimo.valor.lineas[0].subtotalCent, 1980, "el último día, hasta las 23:59, vale");
});

test("pedido: el navegador no puede forzar una oferta ni un precio", () => {
  const e = pedido([{ id: "cerdo-iberico-secreto-iberico", cantidad: 1000, precio: 1, oferta: "3x2", ahorroCent: 99999 }], "2026-10-13");
  e.regalos = [{ texto: "yate", cantidad: 9 }]; e.ahorroCent = 99999;
  const r = validarPedido(e, { productos, ajustes: aj, ahora: { fecha: "2026-10-12", dia: 1, minutos: 540 } });
  assert.equal(r.valor.lineas[0].subtotalCent, 2995);
  assert.equal(r.valor.lineas[0].ahorroCent, 0);
  assert.deepEqual(r.valor.regalos, []);
  assert.equal(r.valor.ahorroCent, 0);
});

test("pedido: regalo por compra sobre lo que se paga ya con ofertas y sin envío; mínimos también sobre eso", () => {
  const a = clone(aj);
  a.tienda.regalos = [regalo()];
  // 3 kg de albóndigas (19,80) + 1 kg de secreto en oferta (19,95) = 39,75 € -> 1 regalo
  const uno = hacer([{ id: "elaborados-albondigas", cantidad: 3000 }, { id: "cerdo-iberico-secreto-iberico", cantidad: 1000 }], a);
  assert.deepEqual(uno.valor.regalos, [{ texto: "250 g de chorizo", cantidad: 1 }]);
  // sin la oferta (fuera de fechas) el mismo pedido da 29,70 + 29,95 = 59,65 -> sigue siendo 1; y 2 pollos (17 €) no llegan a 30
  assert.deepEqual(hacer([{ id: "pollo-pollo-entero", cantidad: 2 }], a).valor.regalos, []);
  const dos = hacer([{ id: "pollo-pollo-entero", cantidad: 8 }], a); // 68 € -> 2 regalos
  assert.deepEqual(dos.valor.regalos, [{ texto: "250 g de chorizo", cantidad: 2 }]);
  // el envío no cuenta para el regalo
  a.tienda.reparto.activo = true; a.tienda.reparto.coste = 20; a.tienda.reparto.gratisDesde = null; a.tienda.reparto.dias = [1, 2, 3, 4, 5, 6, 7]; a.tienda.reparto.franjas = ["11:00-13:00"]; a.tienda.reparto.codigosPostales = []; a.tienda.reparto.radioKm = null;
  const reparto = validarPedido({ ...pedido([{ id: "pollo-pollo-entero", cantidad: 3 }]), entrega: { tipo: "reparto", direccion: "Calle Falsa 123, 2ºB", cp: "41008", dia: "2026-10-08", franja: "11:00-13:00" } }, { productos, ajustes: a, ahora: AHORA });
  assert.equal(reparto.ok, true, JSON.stringify(reparto.errores));
  assert.equal(reparto.valor.totalCent, 2550 + 2000);
  assert.deepEqual(reparto.valor.regalos, [], "25,50 € de productos + 20 € de envío no llegan a 30 € de compra");
  // regalo fuera de fechas
  a.tienda.regalos = [regalo({ hasta: "2026-10-06" })];
  assert.deepEqual(hacer([{ id: "pollo-pollo-entero", cantidad: 8 }], a).valor.regalos, []);
});

test("pedido: el pedido mínimo se mide sobre lo que se paga después de las ofertas", () => {
  const a = clone(aj); a.tienda.pedidoMinimo = 20;
  const r = hacer([{ id: "elaborados-albondigas", cantidad: 3000 }], a); // 19,80 con la oferta
  assert.equal(r.ok, false);
  assert.match(r.errores[0].mensaje, /pedido mínimo/i);
});

test("mensaje de WhatsApp: cita la oferta, el ahorro y el regalo", () => {
  const a = clone(aj); a.tienda.regalos = [regalo()];
  const r = hacer([{ id: "elaborados-albondigas", cantidad: 3000 }, { id: "cerdo-iberico-secreto-iberico", cantidad: 1000 }], a);
  const m = mensajeWhatsApp({ ...r.valor }, "LE-2610-0001");
  assert.match(m, /Albóndigas: 3 kg \[3x2: 1 kg gratis\]/i);
  assert.match(m, /Secreto ibérico: 1 kg \[Oferta: 19,95\s€\/kg en vez de 29,95\s€\]/);
  assert.match(m, /Ahorro por ofertas: 19,90\s€/);
  assert.match(m, /Regalo por tu compra: 250 g de chorizo/);
  const dos = mensajeWhatsApp({ ...hacer([{ id: "pollo-pollo-entero", cantidad: 8 }], a).valor }, "LE-2610-0002");
  assert.match(dos, /Regalo por tu compra: 2 × 250 g de chorizo/);
  const sin = mensajeWhatsApp({ ...hacer([{ id: "pollo-pollo-entero", cantidad: 2 }], aj).valor }, "LE-2610-0003");
  assert.ok(!/Ahorro|Regalo/.test(sin));
});

// ---- escaparate ----
const pd = (id, nombre, ofertas, extra = {}) => ({ id, nombre, unidad: "kg", precio: 10, categoria: "x", ofertas, ...extra });

test("escaparate: título en singular con una sola cosa y en plural con varias", () => {
  assert.equal(tituloDestacadas(1), "Oferta de la semana");
  assert.equal(tituloDestacadas(2), "Ofertas de la semana");
  assert.equal(tituloDestacadas(7), "Ofertas de la semana");
});

test("escaparate: solo lo activo hoy, con precio y sin agotar (un oculto con oferta vigente cuenta como activo); por orden de fin y los regalos al final", () => {
  const hoy = "2026-10-07";
  const productos = [
    pd("a", "Zanahorias de cerdo", [precio("2026-10-05", "2026-10-11", 7)]),
    pd("b", "Albóndigas", [tres("2026-10-05", "2026-10-09")]),
    pd("c", "Programada", [precio("2026-10-10", "2026-10-15", 7)]),
    pd("d", "Terminada", [precio("2026-09-01", "2026-09-07", 7)]),
    pd("e", "Sin precio", [tres("2026-10-05", "2026-10-11")], { precio: null }),
    pd("f", "Agotada", [precio("2026-10-05", "2026-10-11", 7)], { agotado: true }),
    pd("g", "Oculta", [precio("2026-10-05", "2026-10-11", 7)], { oculto: true }),
    pd("h", "Sin ofertas", []),
    pd("i", "Mal formada", [{ tipo: "precio", precio: 7 }]),
    pd("j", "Rebaja que ya no lo es", [precio("2026-10-05", "2026-10-11", 12)]),
  ];
  const r = destacadas(productos, [regalo(), regalo({ regalo: "pasado", hasta: "2026-10-06" })], hoy);
  assert.deepEqual(r.map((t) => (t.clase === "producto" ? t.p.nombre : `regalo: ${t.regalo.regalo}`)), ["Albóndigas", "Oculta", "Zanahorias de cerdo", "regalo: 250 g de chorizo"]);
  assert.equal(r[2].precio, 7);
  assert.equal(r[2].habitual, 10);
  assert.equal(destacadas([pd("o", "Oculta sin oferta hoy", [precio("2026-10-10", "2026-10-15", 7)], { oculto: true })], [], hoy).length, 0, "oculto y con la oferta programada: no sale");
  assert.equal(r[0].habitual, null, "el 3x2 no tacha nada");
  assert.equal(r[0].hasta, "2026-10-09");
  assert.deepEqual(destacadas([], [], hoy), []);
  assert.deepEqual(destacadas(undefined, undefined, hoy), []);
  assert.equal(tituloDestacadas(destacadas(productos.slice(0, 1), [], hoy).length), "Oferta de la semana");
});

test("textos del regalo: «por cada», «a partir de», máximo y fecha de fin", () => {
  const s = (x) => textoRegalo(regalo(x)).replace(/\s/g, " ");
  assert.equal(s({}), "Por cada 30,00 € de compra, de regalo 250 g de chorizo (hasta el 11 de octubre).");
  assert.equal(s({ repetir: false, hasta: null }), "En compras de 30,00 € o más, de regalo 250 g de chorizo.");
  assert.match(condicionRegalo(regalo({ maximo: 2 })).replace(/\s/g, " "), /Por cada 30,00 € de compra \(máximo 2 por pedido\)/);
  assert.equal(fechaCorta("2026-10-11"), "11 de octubre");
});

// ---- precio anterior de 30 días (Ley 7/1996, art. 20) e historial de precios ----
test("historial: el producto de siempre arranca con su precio actual; cada cambio suma una entrada; el mismo día se queda el último", () => {
  const antiguo = { precio: 25 };
  assert.deepEqual(historialActualizado(antiguo, 25, "2026-10-05"), [{ desde: "2000-01-01", precio: 25 }], "sin cambio, solo la base");
  const h1 = historialActualizado(antiguo, 29.95, "2026-10-05");
  assert.deepEqual(h1, [{ desde: "2000-01-01", precio: 25 }, { desde: "2026-10-05", precio: 29.95 }]);
  assert.deepEqual(historialActualizado({ precio: 29.95, historial: h1 }, 29.95, "2026-10-06"), h1, "el mismo precio no añade nada");
  assert.deepEqual(historialActualizado({ precio: 29.95, historial: h1 }, 28, "2026-10-05").at(-1), { desde: "2026-10-05", precio: 28 }, "errata corregida el mismo día: solo cuenta la última");
  assert.equal(historialActualizado({ precio: 29.95, historial: h1 }, 28, "2026-10-09").length, 3);
  assert.deepEqual(historialActualizado({ precio: 29.95, historial: h1 }, 31, "2026-09-01").at(-1), { desde: "2026-10-05", precio: 31 }, "una fecha anterior a la última entrada no desordena el historial");
  assert.deepEqual(historialActualizado(null, 9.5, "2026-10-05"), [{ desde: "2026-10-05", precio: 9.5 }], "producto nuevo");
  assert.deepEqual(historialActualizado(null, null, "2026-10-05"), [], "nuevo y sin precio");
  assert.deepEqual(historialActualizado({ precio: null }, 9.5, "2026-10-05"), [{ desde: "2000-01-01", precio: null }, { desde: "2026-10-05", precio: 9.5 }]);
  let h = [];
  for (let i = 0; i < 80; i++) h = historialActualizado({ precio: i + 1, historial: h.length ? h : undefined }, i + 2, `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`);
  assert.ok(h.length <= 60);
});

test("precio anterior: sin historial ni otras ofertas es el habitual; si se subió hace poco, vale el más bajo de los 30 días", () => {
  const of = precio("2026-10-07", "2026-10-13", 19.95);
  assert.equal(precioAnterior(kg({ ofertas: [of] }), of), 29.95);
  const subido = kg({ historial: [{ desde: "2000-01-01", precio: 25 }, { desde: "2026-10-06", precio: 29.95 }], ofertas: [of] });
  assert.equal(precioAnterior(subido, of), 25, "ayer valía 25 €: ese es el anterior, no 29,95");
  const antiguo = kg({ historial: [{ desde: "2000-01-01", precio: 25 }, { desde: "2026-08-01", precio: 29.95 }], ofertas: [of] });
  assert.equal(precioAnterior(antiguo, of), 29.95, "la subida es de hace más de 30 días");
  assert.equal(precioAnterior(kg({ historial: [{ desde: "2000-01-01", precio: 40 }, { desde: "2026-09-08", precio: 30 }, { desde: "2026-09-20", precio: 35 }], ofertas: [of] }), of), 30, "el más bajo de la ventana (7 sep a 6 oct)");
});

test("precio anterior: la ventana son los 30 días justos antes del inicio", () => {
  const of = precio("2026-10-31", "2026-11-06", 19.95); // ventana: del 1 al 30 de octubre
  const h = (subida) => kg({ historial: [{ desde: "2000-01-01", precio: 20 }, { desde: subida, precio: 29.95 }], ofertas: [of] });
  assert.equal(precioAnterior(h("2026-10-02"), of), 20, "el 1 de octubre aún valía 20 € y entra en la ventana");
  assert.equal(precioAnterior(h("2026-10-01"), of), 29.95, "si la subida fue el 1 de octubre, el 30 de septiembre ya queda fuera");
});

test("rebajas seguidas: la segunda, a menos de 30 días de la primera, tiene como anterior el precio de la primera", () => {
  const a = precio("2026-10-05", "2026-10-11", 19.95);
  const b = precio("2026-10-26", "2026-11-01", 24.95);
  const c = precio("2026-12-05", "2026-12-11", 24.95);
  const p = kg({ ofertas: [a, b, c] });
  assert.equal(precioAnterior(p, a), 29.95);
  assert.equal(precioAnterior(p, b), 19.95);
  assert.deepEqual(rebajaValida(p, b), { valida: false, anterior: 19.95, motivo: "no-baja" });
  assert.deepEqual(rebajaValida(p, c), { valida: true, anterior: 29.95, motivo: null }, "la segunda acabó el 1 de noviembre: más de 30 días antes del 5 de diciembre");
  // lo que se cobra y lo que se enseña
  assert.deepEqual({ ...precioEfectivo(p, "2026-10-07"), oferta: undefined }, { precio: 19.95, habitual: 29.95, oferta: undefined });
  const dentroB = precioEfectivo(p, "2026-10-28");
  assert.equal(dentroB.precio, 24.95, "se cobra lo programado");
  assert.equal(dentroB.habitual, null, "pero sin tachar nada");
  assert.equal(dentroB.oferta, null, "ni anunciarla como oferta");
  assert.deepEqual(destacadas([{ ...p, id: "x", nombre: "X", categoria: "c" }], [], "2026-10-28"), [], "no sale en el escaparate");
  assert.equal(destacadas([{ ...p, id: "x", nombre: "X", categoria: "c" }], [], "2026-12-07").length, 1);
  const [l] = calcularLineas([{ p, cantidad: 1000 }], "2026-10-28");
  assert.equal(l.subtotalCent, 2495);
  assert.equal(l.ahorroCent, 0, "sin ahorro que anunciar");
});

test("primera vez a la venta: sin precio en los 30 días anteriores no hay rebaja que anunciar", () => {
  const of = precio("2026-09-20", "2026-09-26", 19.95);
  const nuevo = kg({ historial: [{ desde: "2026-10-01", precio: 29.95 }], ofertas: [of] });
  assert.deepEqual(rebajaValida(nuevo, of), { valida: false, anterior: null, motivo: "primera" });
  const conVentana = precio("2026-10-03", "2026-10-09", 19.95);
  assert.equal(precioAnterior({ ...nuevo, ofertas: [conVentana] }, conVentana), 29.95, "con dos días de precio en la ventana ya hay anterior");
});

test("el ahorro se mide contra el precio anterior legal, no contra el habitual actual", () => {
  const of = precio("2026-10-07", "2026-10-13", 19.95);
  const p = kg({ historial: [{ desde: "2000-01-01", precio: 25 }, { desde: "2026-10-06", precio: 29.95 }], ofertas: [of] });
  const [l] = calcularLineas([{ p, cantidad: 1000 }], "2026-10-08");
  assert.equal(l.habitual, 25);
  assert.equal(l.ahorroCent, 505, "25,00 - 19,95");
});

test("catálogo público: trae el precio anterior ya calculado y no filtra el historial", () => {
  const of = precio("2026-10-07", "2026-10-13", 19.95);
  const p = { ...kg({ historial: [{ desde: "2000-01-01", precio: 25 }, { desde: "2026-10-06", precio: 29.95 }], ofertas: [of, tres("2026-12-01", "2026-12-07")] }), orden: 1, categoria: "c", coste: 1 };
  const [pub] = catalogoPublico([p], "2026-10-08");
  assert.equal("historial" in pub, false);
  assert.deepEqual(pub.ofertas, [{ ...of, anterior: 25 }]);
  // el navegador, sin historial, llega al mismo resultado con ese dato
  assert.equal(precioEfectivo(pub, "2026-10-08").habitual, 25);
  const sinNada = catalogoPublico([{ ...p, historial: undefined, ofertas: [of] }], "2026-10-08")[0];
  assert.equal(sinNada.ofertas[0].anterior, 29.95, "producto antiguo sin historial: se supone que siempre valió lo de ahora");
});

function clone(o) { return JSON.parse(JSON.stringify(o)); }

test("activoHoy: un producto oculto cuenta como activo solo mientras tiene una oferta vigente", async () => {
  const { activoHoy, destacadas } = await import("../lib/ofertas.mjs");
  const { catalogoPublico } = await import("../lib/productos.mjs");
  const base = { id: "x", nombre: "Secreto", categoria: "cerdo-iberico", unidad: "kg", precio: 20, orden: 1, historial: [{ desde: "2000-01-01", precio: 20 }] };
  const of = (desde, hasta) => [{ tipo: "precio", desde, hasta, precio: 15 }];
  assert.equal(activoHoy({ ...base }, "2026-10-05"), true, "visible de siempre");
  assert.equal(activoHoy({ ...base, oculto: true }, "2026-10-05"), false);
  assert.equal(activoHoy({ ...base, oculto: true, ofertas: of("2026-10-05", "2026-10-11") }, "2026-10-05"), true, "primer día");
  assert.equal(activoHoy({ ...base, oculto: true, ofertas: of("2026-10-05", "2026-10-11") }, "2026-10-11"), true, "último día");
  assert.equal(activoHoy({ ...base, oculto: true, ofertas: of("2026-10-05", "2026-10-11") }, "2026-10-12"), false, "al terminar vuelve a ocultarse");
  assert.equal(activoHoy({ ...base, oculto: true, ofertas: of("2026-10-12", "2026-10-18") }, "2026-10-05"), false, "programada: aún no");
  const ocultoConOferta = { ...base, oculto: true, ofertas: of("2026-10-05", "2026-10-11") };
  assert.equal(catalogoPublico([ocultoConOferta], "2026-10-07").length, 1);
  assert.equal(catalogoPublico([ocultoConOferta], "2026-10-12").length, 0);
  assert.equal("oculto" in catalogoPublico([ocultoConOferta], "2026-10-07")[0], false, "el público no ve la marca interna");
  const publico = catalogoPublico([ocultoConOferta], "2026-10-07");
  assert.equal(destacadas(publico, [], "2026-10-07").filter((t) => t.clase === "producto").length, 1, "y sale en el escaparate");
});
