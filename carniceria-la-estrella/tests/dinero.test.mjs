import { test } from "node:test";
import assert from "node:assert/strict";
import { redondear, importeLinea, formatoCantidad, cantidadValida, aCentimos } from "../lib/dinero.mjs";

test("redondear sube al siguiente final ,90 o ,95 sin bajar nunca del precio", () => {
  assert.equal(redondear(12.34, 90), 12.9);
  assert.equal(redondear(12.34, 95), 12.95);
  assert.equal(redondear(12.9, 90), 12.9);
  assert.equal(redondear(12.91, 90), 13.9);
  assert.equal(redondear(12.96, 95), 13.95);
  assert.equal(redondear(0, 95), 0.95);
  assert.equal(redondear(7, 90), 7.9);
});

test("redondear rechaza finales y precios no válidos", () => {
  assert.throws(() => redondear(5, 80), RangeError);
  assert.throws(() => redondear(-1, 90), RangeError);
  assert.throws(() => redondear(NaN, 90), RangeError);
});

test("importeLinea: por kilo con gramos y por unidad, en céntimos enteros", () => {
  assert.equal(importeLinea(12.9, "kg", 250), 323); // 3,225 € -> 323 c
  assert.equal(importeLinea(9.9, "kg", 1500), 1485);
  assert.equal(importeLinea(2.5, "ud", 3), 750);
  assert.equal(importeLinea(null, "kg", 500), null);
  assert.equal(aCentimos(19.99), 1999);
});

test("formatoCantidad: gramos por debajo de 1 kg, kg con coma, unidades", () => {
  assert.equal(formatoCantidad(250, "kg"), "250 g");
  assert.equal(formatoCantidad(1000, "kg"), "1 kg");
  assert.equal(formatoCantidad(1500, "kg"), "1,5 kg");
  assert.equal(formatoCantidad(3, "ud"), "3 ud");
});

test("cantidadValida: múltiplos del paso, mínimo y máximo", () => {
  const kg = { unidad: "kg", paso: 250 };
  assert.equal(cantidadValida(kg, 250), true);
  assert.equal(cantidadValida(kg, 750), true);
  assert.equal(cantidadValida(kg, 300), false);
  assert.equal(cantidadValida(kg, 0), false);
  assert.equal(cantidadValida(kg, 25250), false);
  assert.equal(cantidadValida({ unidad: "kg", paso: 500, minimo: 1000 }, 500), false);
  assert.equal(cantidadValida({ unidad: "ud" }, 2), true);
  assert.equal(cantidadValida({ unidad: "ud" }, 1.5), false);
  assert.equal(cantidadValida(kg, "250"), false);
});
