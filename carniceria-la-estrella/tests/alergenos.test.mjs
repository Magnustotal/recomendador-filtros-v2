import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALERGENOS_UE, CATEGORIAS_A_REVISAR, infoAlergenos, alergenosPendientes } from "../lib/alergenos.mjs";
import { validarProducto, catalogoPublico } from "../lib/productos.mjs";

const cats = JSON.parse(readFileSync(new URL("../data/categorias.json", import.meta.url), "utf8")).map((c) => c.id);
const prods = JSON.parse(readFileSync(new URL("../data/productos.default.json", import.meta.url), "utf8"));

test("la lista oficial tiene las 14 sustancias del anexo II del Reglamento (UE) 1169/2011", () => {
  assert.equal(ALERGENOS_UE.length, 14);
  assert.equal(new Set(ALERGENOS_UE).size, 14);
  for (const necesaria of ["Cereales con gluten", "Leche", "Huevos", "Sulfitos", "Frutos de cáscara", "Altramuces"]) assert.ok(ALERGENOS_UE.includes(necesaria), necesaria);
  for (const a of ALERGENOS_UE) assert.ok(a.length <= 30, "cabe en el campo de la ficha");
});

test("infoAlergenos: lo que se enseña según lo que se sepa del producto", () => {
  assert.deepEqual(infoAlergenos({ categoria: "elaborados", alergenos: ["Cereales con gluten", "Leche"] }), { nivel: "contiene", texto: "Alérgenos: Cereales con gluten, Leche" });
  assert.equal(infoAlergenos({ categoria: "vacuno", alergenos: ["Mostaza"] }).nivel, "contiene", "si hay alérgenos se dicen en cualquier categoría");
  assert.equal(infoAlergenos({ categoria: "elaborados", alergenos: [] }).nivel, "pendiente");
  assert.match(infoAlergenos({ categoria: "vino", alergenos: [] }).texto, /consúltanos antes de pedir/);
  assert.deepEqual(infoAlergenos({ categoria: "quesos", alergenos: [], alergenosRevisados: true }), { nivel: "ninguno", texto: "Sin alérgenos declarados" });
  for (const c of ["vacuno", "cerdo", "pollo", "casqueria", "avios", "huevos", "caza"]) assert.equal(infoAlergenos({ categoria: c, alergenos: [] }), null, `${c}: carne sin elaborar, no hace falta decir nada`);
  assert.equal(infoAlergenos({ categoria: "vacuno", alergenos: [], alergenosRevisados: true }), null);
  assert.equal(infoAlergenos({ categoria: "elaborados" }).nivel, "pendiente", "un producto antiguo sin el campo cuenta como sin revisar");
  for (const c of CATEGORIAS_A_REVISAR) assert.ok(cats.includes(c), `${c} existe como categoría`);
});

test("alergenosPendientes cuenta los visibles sin revisar", () => {
  const lista = [
    { categoria: "elaborados", alergenos: [] },
    { categoria: "elaborados", alergenos: [], oculto: true },
    { categoria: "elaborados", alergenos: [], alergenosRevisados: true },
    { categoria: "embutidos", alergenos: ["Soja"] },
    { categoria: "pollo", alergenos: [] },
  ];
  assert.equal(alergenosPendientes(lista), 1);
});

test("alergenosRevisados se valida (por defecto, no) y llega al catálogo público", () => {
  const base = { nombre: "Flamenquines", categoria: "elaborados", unidad: "kg", alergenos: ["Cereales con gluten"] };
  const sin = validarProducto(base, { categorias: cats });
  assert.equal(sin.ok, true);
  assert.equal(sin.valor.alergenosRevisados, false);
  const con = validarProducto({ ...base, alergenosRevisados: true }, { categorias: cats });
  assert.equal(con.valor.alergenosRevisados, true);
  const publico = catalogoPublico([{ ...con.valor, precio: 10 }], "2026-10-07")[0];
  assert.equal(publico.alergenosRevisados, true);
  assert.deepEqual(publico.alergenos, ["Cereales con gluten"]);
});

test("el catálogo inicial deja bien claro cuántos productos están sin revisar", () => {
  const pendientes = alergenosPendientes(prods.map((p) => ({ ...p, alergenosRevisados: false })));
  assert.equal(pendientes, 83, `hay muchos productos por revisar (${pendientes}): por eso la tienda dice «consúltanos» hasta que se revisen`);
});
