import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarProducto, catalogoPublico, aplicarRedondeoATodos, slug } from "../lib/productos.mjs";

const cats = JSON.parse(readFileSync(new URL("../data/categorias.json", import.meta.url), "utf8")).map((c) => c.id);
const prods = JSON.parse(readFileSync(new URL("../data/productos.default.json", import.meta.url), "utf8"));

test("el catálogo inicial tiene 200+ productos, todos válidos y sin precios inventados", () => {
  assert.ok(prods.length >= 200);
  const ids = new Set();
  for (const p of prods) {
    const r = validarProducto(p, { categorias: cats });
    assert.equal(r.ok, true, `${p.id}: ${JSON.stringify(r.errores)}`);
    assert.equal(p.precio, null, `${p.id} no debe llevar precio`);
    assert.ok(!ids.has(p.id)); ids.add(p.id);
  }
  assert.ok(prods.filter((p) => p.alcohol).every((p) => p.categoria === "vino"));
  assert.ok(prods.some((p) => p.categoria === "cordero"));
});

test("validarProducto genera id desde el nombre y aplica el redondeo", () => {
  const r = validarProducto({ nombre: "Lomo de Cerdo Ibérico", categoria: "cerdo-iberico", unidad: "kg", precio: "14,31" }, { categorias: cats, redondeo: 90 });
  assert.equal(r.ok, true);
  assert.equal(r.valor.id, "lomo-de-cerdo-iberico");
  assert.equal(r.valor.precio, 14.9);
  assert.equal(r.valor.paso, 250);
});

test("validarProducto rechaza categoría, unidad, paso y foto incorrectos", () => {
  const r = validarProducto({ nombre: "X", categoria: "no-existe", unidad: "litros", foto: "../../etc/passwd" }, { categorias: cats });
  assert.equal(r.ok, false);
  const campos = r.errores.map((e) => e.campo);
  for (const c of ["categoria", "unidad", "foto"]) assert.ok(campos.includes(c), c);
  assert.equal(validarProducto({ nombre: "X", categoria: "vacuno", unidad: "kg", paso: 75 }, { categorias: cats }).ok, false);
  assert.equal(validarProducto({ nombre: "X", categoria: "vacuno", unidad: "kg", paso: 250, minimo: 300 }, { categorias: cats }).ok, false);
});

test("catalogoPublico oculta los ocultos y no filtra campos internos", () => {
  const pub = catalogoPublico([{ id: "a", orden: 2, oculto: false }, { id: "b", orden: 1, oculto: true }, { id: "c", orden: 0, oculto: false }]);
  assert.deepEqual(pub.map((p) => p.id), ["c", "a"]);
  assert.ok(pub.every((p) => !("oculto" in p)));
});

test("aplicarRedondeoATodos solo toca productos con precio", () => {
  const r = aplicarRedondeoATodos([{ id: "a", unidad: "kg", precio: 10.1 }, { id: "b", unidad: "kg", precio: null }, { id: "c", unidad: "ud", precio: 3.2 }], 95);
  assert.deepEqual(r, [{ id: "a", unidad: "kg", precio: 10.95 }, { id: "b", unidad: "kg", precio: null }, { id: "c", unidad: "ud", precio: 3.2 }]);
  assert.equal(slug("Rabo de toro"), "rabo-de-toro");
});
