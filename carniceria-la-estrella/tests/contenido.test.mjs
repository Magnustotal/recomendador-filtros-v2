import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MEDIDAS, precioPorMedida, textoContenido, lineaContenido, contenidoPendiente, contenidoValido } from "../lib/contenido.mjs";
import { validarProducto, catalogoPublico } from "../lib/productos.mjs";

const cats = JSON.parse(readFileSync(new URL("../data/categorias.json", import.meta.url), "utf8")).map((c) => c.id);
const prods = JSON.parse(readFileSync(new URL("../data/productos.default.json", import.meta.url), "utf8"));
const eur = (n) => `${n.toFixed(2).replace(".", ",")} €`;

test("precio por kilo o litro de lo envasado", () => {
  assert.deepEqual(precioPorMedida(6, { cantidad: 75, medida: "cl" }), { precio: 8, por: "l" });
  assert.deepEqual(precioPorMedida(6, { cantidad: 750, medida: "ml" }), { precio: 8, por: "l" });
  assert.deepEqual(precioPorMedida(3.5, { cantidad: 250, medida: "g" }), { precio: 14, por: "kg" });
  assert.deepEqual(precioPorMedida(3.5, { cantidad: 0.25, medida: "kg" }), { precio: 14, por: "kg" });
  assert.deepEqual(precioPorMedida(2.99, { cantidad: 1, medida: "l" }), { precio: 2.99, por: "l" });
  assert.equal(precioPorMedida(2.99, { cantidad: 330, medida: "ml" }).precio, 9.06, "se redondea a céntimos");
});

test("sin precio, sin contenido o vendido al peso no hay precio por unidad de medida", () => {
  assert.equal(precioPorMedida(null, { cantidad: 75, medida: "cl" }), null);
  assert.equal(precioPorMedida(6, null), null);
  assert.equal(precioPorMedida(6, { cantidad: 0, medida: "cl" }), null);
  assert.equal(precioPorMedida(6, { cantidad: 75, medida: "pulgadas" }), null);
  assert.equal(precioPorMedida(6, { cantidad: 75, medida: "cl" }, "kg"), null, "al peso ya es precio por kilo");
  assert.equal(precioPorMedida(6, { cantidad: 75, medida: "toString" }), null, "nada del prototipo");
});

test("textos del contenido", () => {
  assert.equal(textoContenido({ cantidad: 75, medida: "cl" }), "75 cl");
  assert.equal(textoContenido({ cantidad: 0.5, medida: "kg" }), "0,5 kg");
  assert.equal(textoContenido(null), "");
  assert.equal(lineaContenido(6, { cantidad: 75, medida: "cl" }, "ud", eur), "75 cl · 8,00 €/l");
  assert.equal(lineaContenido(6, null, "ud", eur), "");
  assert.equal(lineaContenido(null, { cantidad: 75, medida: "cl" }, "ud", eur), "");
  assert.ok(Object.keys(MEDIDAS).every((m) => contenidoValido({ cantidad: 1, medida: m })));
});

test("contenidoPendiente cuenta los envasados visibles que nadie ha mirado", () => {
  const lista = [
    { categoria: "vino", unidad: "ud" },
    { categoria: "vino", unidad: "ud", contenido: { cantidad: 75, medida: "cl" } },
    { categoria: "vino", unidad: "ud", precioUnidadExento: true },
    { categoria: "salsas", unidad: "ud", oculto: true },
    { categoria: "especias", unidad: "ud" },
    { categoria: "especias", unidad: "kg" },
    { categoria: "pollo", unidad: "ud" },
  ];
  assert.equal(contenidoPendiente(lista), 2);
  assert.equal(contenidoPendiente(prods), 8 + 7 + 11, "vino, salsas y especias del catálogo inicial");
});

test("validación del contenido: solo por unidades, medida de la lista y se llega al catálogo público", () => {
  const base = { nombre: "Vino blanco", categoria: "vino", unidad: "ud", precio: 6 };
  const ok = validarProducto({ ...base, contenido: { cantidad: "75", medida: "cl" } }, { categorias: cats });
  assert.equal(ok.ok, true, JSON.stringify(ok.errores));
  assert.deepEqual(ok.valor.contenido, { cantidad: 75, medida: "cl" });
  const coma = validarProducto({ ...base, contenido: { cantidad: "0,75", medida: "l" } }, { categorias: cats });
  assert.deepEqual(coma.valor.contenido, { cantidad: 0.75, medida: "l" });
  assert.equal(validarProducto({ ...base, contenido: { cantidad: "", medida: "cl" } }, { categorias: cats }).valor.contenido, null);
  assert.equal(validarProducto(base, { categorias: cats }).valor.contenido, null);
  assert.equal(validarProducto({ ...base, unidad: "kg", contenido: { cantidad: 75, medida: "cl" } }, { categorias: cats }).valor.contenido, null, "al peso no se guarda");
  const malo = validarProducto({ ...base, contenido: { cantidad: 75, medida: "pulgadas" } }, { categorias: cats });
  assert.equal(malo.ok, false);
  assert.ok(malo.errores.some((e) => e.campo === "contenido"));
  assert.equal(validarProducto({ ...base, contenido: { cantidad: -3, medida: "cl" } }, { categorias: cats }).ok, false);
  assert.equal(validarProducto({ ...base, precioUnidadExento: true }, { categorias: cats }).valor.precioUnidadExento, true);
  const publico = catalogoPublico([ok.valor], "2026-10-07")[0];
  assert.deepEqual(publico.contenido, { cantidad: 75, medida: "cl" });
});
