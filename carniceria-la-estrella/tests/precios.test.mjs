import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rangoOrientativo, costeEfectivo, precioDesdeCoste, recargoReal, ajustarPorcentaje, semaforo, MARGEN_POR_DEFECTO } from "../lib/precios.mjs";

const leer = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));

test("rango orientativo: ±12 % / ±20 % / ±30 % según la fiabilidad", () => {
  assert.deepEqual(rangoOrientativo(10, "a"), { min: 8.8, max: 11.2 });
  assert.deepEqual(rangoOrientativo(10, "m"), { min: 8, max: 12 });
  assert.deepEqual(rangoOrientativo(10, "b"), { min: 7, max: 13 });
  assert.deepEqual(rangoOrientativo(10, "?"), { min: 8, max: 12 }, "fiabilidad desconocida = media");
});

test("coste efectivo: la merma encarece lo que se puede vender", () => {
  assert.equal(costeEfectivo(10, 0), 10);
  assert.equal(costeEfectivo(10, 20), 12.5);
  assert.throws(() => costeEfectivo(10, 100));
  assert.throws(() => costeEfectivo(10, -1));
});

test("precio desde el coste: merma, recargo, IVA y redondeo ,90", () => {
  // 10 €/kg, 20 % de merma -> 12,50; +30 % -> 16,25; +10 % de IVA -> 17,875 -> 17,88
  const r = precioDesdeCoste({ coste: 10, merma: 20, margen: 30, iva: 10 });
  assert.equal(r.exacto, 17.88);
  assert.equal(r.precio, 17.88, "sin redondeo configurado");
  assert.equal(precioDesdeCoste({ coste: 10, merma: 20, margen: 30, iva: 10, redondeo: 90 }).precio, 17.9);
  assert.equal(precioDesdeCoste({ coste: 10, merma: 20, margen: 30, iva: 10, redondeo: 95 }).precio, 17.95);
  // por unidad no se redondea
  assert.equal(precioDesdeCoste({ coste: 10, merma: 20, margen: 30, iva: 10, redondeo: 90, unidad: "ud" }).precio, 17.88);
  // valores por defecto
  assert.equal(precioDesdeCoste({ coste: 10 }).exacto, 13);
  assert.equal(MARGEN_POR_DEFECTO, 30);
});

test("recargo real: es la inversa de la calculadora", () => {
  const { exacto } = precioDesdeCoste({ coste: 8, merma: 10, margen: 35, iva: 10 });
  assert.ok(Math.abs(recargoReal({ precio: exacto, coste: 8, merma: 10, iva: 10 }) - 35) < 0.2);
  assert.equal(recargoReal({ precio: 11, coste: 10, iva: 10 }), 0);
  assert.ok(recargoReal({ precio: 5, coste: 10 }) < 0);
});

test("ajustar porcentaje", () => {
  assert.equal(ajustarPorcentaje(10, 5), 10.5);
  assert.equal(ajustarPorcentaje(10, -10), 9);
  assert.equal(ajustarPorcentaje(14.9, 1), 15.05);
});

test("semáforo con rango de mercado (sin coste)", () => {
  const o = { min: 8, max: 12, fiabilidad: "m" };
  const s = (precio) => semaforo({ precio, orientativo: o });
  assert.equal(s(6.5).nivel, "rojo"); assert.equal(s(6.5).etiqueta, "Muy barato");
  assert.equal(s(7.5).nivel, "ambar"); assert.equal(s(7.5).etiqueta, "Algo barato");
  assert.equal(s(8).nivel, "verde"); assert.equal(s(10).etiqueta, "En rango"); assert.equal(s(12).nivel, "verde");
  assert.equal(s(13).nivel, "ambar"); assert.equal(s(13).etiqueta, "Algo caro");
  assert.equal(s(14).nivel, "rojo"); assert.equal(s(14).etiqueta, "Muy caro");
  assert.equal(s(10).base, "mercado");
  assert.match(s(14).detalle, /8,00 €–12,00 €/);
  assert.match(semaforo({ precio: 10, orientativo: { ...o, fiabilidad: "b" } }).detalle, /poco fiable/);
});

test("semáforo con coste: mide el recargo real frente al objetivo", () => {
  const base = { coste: 10, merma: 0, iva: 0, margenObjetivo: 30 };
  const s = (precio) => semaforo({ ...base, precio });
  assert.equal(s(9).etiqueta, "No cubre el coste"); assert.equal(s(9).nivel, "rojo");
  assert.equal(s(10.5).etiqueta, "Margen muy bajo"); // 5 %
  assert.equal(s(11.5).etiqueta, "Margen algo bajo"); // 15 % (entre 15 y 24)
  assert.equal(s(13).etiqueta, "Margen correcto"); assert.equal(s(13).nivel, "verde"); // 30 %
  assert.equal(s(14.5).etiqueta, "Margen correcto"); // 45 %
  assert.equal(s(15.5).etiqueta, "Margen alto"); assert.equal(s(15.5).nivel, "ambar"); // 55 %
  assert.equal(s(17).etiqueta, "Margen muy alto"); assert.equal(s(17).nivel, "rojo"); // 70 %
  assert.equal(s(13).base, "coste");
  // el coste manda sobre el mercado y lo menciona
  const m = semaforo({ ...base, precio: 13, orientativo: { min: 8, max: 12, fiabilidad: "m" } });
  assert.equal(m.nivel, "verde"); assert.match(m.detalle, /es caro/);
});

test("semáforo: sin precio y sin referencia", () => {
  assert.equal(semaforo({ precio: null }).nivel, "gris");
  assert.equal(semaforo({ precio: 0 }).etiqueta, "Sin precio");
  assert.equal(semaforo({ precio: 10 }).etiqueta, "Sin referencia");
  assert.equal(semaforo({ precio: 10, coste: 0 }).nivel, "gris", "un coste de 0 no cuenta");
});

test("el IVA se descuenta al medir el recargo (precio con IVA frente a coste sin IVA)", () => {
  // coste 10; precio 14,3 con IVA 10 % => neto 13 => recargo 30 %
  assert.equal(semaforo({ precio: 14.3, coste: 10, iva: 10 }).recargo, 30);
});

test("la tabla de precios orientativos cubre los 225 productos, con precios positivos y fiabilidad válida", () => {
  const productos = leer("productos.default.json");
  const t = leer("precios-orientativos.json");
  assert.equal(Object.keys(t.precios).length, productos.length);
  for (const p of productos) {
    const e = t.precios[p.id];
    assert.ok(e, `falta ${p.id}`);
    assert.ok(e[0] > 0 && e[0] < 400, `${p.id}: ${e[0]}`);
    assert.ok(["a", "m", "b"].includes(e[1]), `${p.id}: fiabilidad`);
  }
  for (const id of Object.keys(t.precios)) assert.ok(productos.some((p) => p.id === id), `sobra ${id}`);
  assert.match(t._nota, /NO verificada/);
});
