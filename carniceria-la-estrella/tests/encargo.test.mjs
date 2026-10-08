import { test } from "node:test";
import assert from "node:assert/strict";
import { esPorEncargo, sePuedePedir, TEXTO_ENCARGO } from "../lib/encargo.mjs";
import { validarProducto, catalogoPublico } from "../lib/productos.mjs";
import { destacadas } from "../lib/ofertas.mjs";
import { csvPedidos } from "../lib/api-admin.mjs";

test("esPorEncargo: la marca o el nombre «(por encargo)»", () => {
  assert.equal(esPorEncargo({ porEncargo: true, nombre: "Cochinillo" }), true);
  assert.equal(esPorEncargo({ nombre: "Cochinillo (por encargo)" }), true);
  assert.equal(esPorEncargo({ nombre: "Capón ( Por Encargo )" }), true);
  assert.equal(esPorEncargo({ nombre: "Pollo por encargo de la casa" }), false, "solo entre paréntesis");
  assert.equal(esPorEncargo({ nombre: "Pollo", porEncargo: false }), false);
  assert.equal(esPorEncargo(null), false);
  assert.match(TEXTO_ENCARGO, /precio es orientativo y te lo confirmamos antes de hacer el encargo/);
});

test("sePuedePedir: lo agotado no, salvo que sea por encargo", () => {
  assert.equal(sePuedePedir({ nombre: "A" }), true);
  assert.equal(sePuedePedir({ nombre: "A", agotado: true }), false);
  assert.equal(sePuedePedir({ nombre: "A", agotado: true, porEncargo: true }), true);
  assert.equal(sePuedePedir({ nombre: "A (por encargo)", agotado: true }), true);
  assert.equal(sePuedePedir(undefined), false);
});

test("porEncargo se valida, se guarda y llega al catálogo público; un por encargo agotado sale en el escaparate si tiene oferta", () => {
  const cats = ["cerdo"];
  const r = validarProducto({ nombre: "Cochinillo", categoria: "cerdo", unidad: "ud", precio: 70, porEncargo: true, agotado: true }, { categorias: cats });
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.valor.porEncargo, true);
  assert.equal(validarProducto({ nombre: "Cochinillo", categoria: "cerdo", unidad: "ud" }, { categorias: cats }).valor.porEncargo, false);
  const publico = catalogoPublico([{ ...r.valor, ofertas: [{ tipo: "precio", desde: "2026-10-05", hasta: "2026-10-11", precio: 60 }], historial: [{ desde: "2000-01-01", precio: 70 }] }], "2026-10-07");
  assert.equal(publico[0].porEncargo, true);
  assert.equal(destacadas(publico, [], "2026-10-07").length, 1, "agotado pero por encargo: se puede pedir, así que sale");
  const noEncargo = publico.map((p) => ({ ...p, porEncargo: false }));
  assert.equal(destacadas(noEncargo, [], "2026-10-07").length, 0, "agotado de verdad: no sale");
});

test("el CSV de pedidos marca las líneas por encargo", () => {
  const pedido = { numero: "LE-2610-0001", creado: "2026-10-05T07:00:00Z", estado: "nuevo", cliente: { nombre: "Ana", telefono: "655443322" }, entrega: { tipo: "recogida", dia: "2026-10-07", franja: "11:00-13:00", direccion: "" }, pago: "efectivo", subtotalCent: 7000, envioCent: 0, totalCent: 7000, consultar: 0, ahorroCent: 0, regalos: [], comentarios: "", notaInterna: "", lineas: [{ nombre: "Cochinillo (por encargo)", cantidad: 1, unidad: "ud", porEncargo: true }, { nombre: "Pollo entero", cantidad: 2, unidad: "ud" }] };
  const csv = csvPedidos([pedido]);
  assert.match(csv, /Cochinillo \(por encargo\) 1 ud <POR ENCARGO>/);
  assert.doesNotMatch(csv, /Pollo entero 2 ud <POR ENCARGO>/);
});
