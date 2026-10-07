import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mediana, diasEntre, referenciaMercado, rangoDesdeMercado, validarMercado, fuentesAtrasadas, VIGENCIA_DIAS } from "../lib/mercado.mjs";
import { semaforo } from "../lib/precios.mjs";

const leer = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const F = [{ id: "a", nombre: "A", frecuencia: "semanal" }, { id: "b", nombre: "B", frecuencia: "semanal" }, { id: "c", nombre: "C", frecuencia: "diaria" }];
const HOY = "2026-10-07";

test("mediana: impar, par y vacía", () => {
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([1, 2, 3, 10]), 2.5);
  assert.equal(mediana([5]), 5);
  assert.equal(mediana([]), null);
});

test("días entre fechas: nunca negativos", () => {
  assert.equal(diasEntre("2026-10-01", "2026-10-07"), 6);
  assert.equal(diasEntre("2026-10-08", "2026-10-07"), 0);
});

test("referencia: mediana de las fuentes vigentes; las caducadas no cuentan", () => {
  const ref = referenciaMercado({ a: { precio: 10, fecha: "2026-10-01" }, b: { precio: 14, fecha: "2026-10-06" }, c: { precio: 30, fecha: "2026-09-01" } }, F, HOY);
  assert.equal(ref.n, 2, "c es diaria y lleva más de 14 días");
  assert.equal(ref.descartadas, 1);
  assert.equal(ref.mediana, 12);
  assert.equal(ref.masAntigua, 6);
  assert.deepEqual([ref.min, ref.max], [10, 14]);
});

test("referencia: una fuente semanal sigue vigente hasta los 45 días y no más", () => {
  assert.equal(VIGENCIA_DIAS.semanal, 45);
  assert.equal(referenciaMercado({ a: { precio: 8, fecha: "2026-08-23" } }, F, HOY).n, 1); // 45 días
  const vieja = referenciaMercado({ a: { precio: 8, fecha: "2026-08-22" } }, F, HOY); // 46 días
  assert.equal(vieja.n, 0);
  assert.equal(vieja.descartadas, 1);
  assert.equal(rangoDesdeMercado(vieja), null, "sin vigentes no hay rango");
});

test("referencia: sin datos o con datos basura = null", () => {
  assert.equal(referenciaMercado(undefined, F, HOY), null);
  assert.equal(referenciaMercado({ a: { precio: -1, fecha: "2026-10-01" }, b: { precio: 5, fecha: "ayer" }, zzz: { precio: 5, fecha: HOY } }, F, HOY), null);
});

test("rango de mercado: fiabilidad según el número de fuentes y texto de origen", () => {
  const r = (n) => rangoDesdeMercado({ n, mediana: 10, masAntigua: 3, descartadas: 0 });
  assert.equal(r(1).fiabilidad, "b");
  assert.equal(r(2).fiabilidad, "m");
  assert.equal(r(3).fiabilidad, "a");
  assert.deepEqual([r(3).min, r(3).max], [8.8, 11.2]);
  assert.match(r(3).origen, /mediana de 3 fuentes \(la más antigua es de hace 3 días\)/);
  assert.match(r(1).origen, /mediana de 1 fuente \(el dato es de hace 3 días\)\. Con una sola fuente es poco fiable\./);
  assert.ok(!/poco fiable/.test(r(2).origen));
  assert.match(rangoDesdeMercado({ n: 2, mediana: 10, masAntigua: 0 }).origen, /de hoy/);
});

test("el semáforo cita el origen del rango de mercado", () => {
  const o = rangoDesdeMercado({ n: 3, mediana: 10, masAntigua: 2 });
  const s = semaforo({ precio: 10, orientativo: o });
  assert.equal(s.nivel, "verde");
  assert.match(s.detalle, /Referencia de mercado: mediana de 3 fuentes/);
  assert.equal(semaforo({ precio: 14, orientativo: o }).nivel, "rojo");
});

const ids = ["p1", "p2"];
const fuentes = [{ id: "mercadona", nombre: "Mercadona", tipo: "supermercado", frecuencia: "semanal", url: "https://www.mercadona.es" }];

test("validar: acepta un conjunto correcto y normaliza precios", () => {
  const v = validarMercado({ fuentes, precios: { p1: { mercadona: { precio: "7,456", fecha: HOY } } } }, { idsProductos: ids, hoy: HOY });
  assert.equal(v.ok, true, JSON.stringify(v.errores));
  assert.equal(v.valor.precios.p1.mercadona.precio, 7.46);
  assert.equal(v.valor.fuentes[0].nota, "");
});

test("validar: rechaza lo que no cuadra", () => {
  const caso = (ent) => validarMercado(ent, { idsProductos: ids, hoy: HOY });
  const malo = (ent, re) => { const v = caso(ent); assert.equal(v.ok, false); assert.match(v.errores.map((e) => e.mensaje).join(" | "), re); };
  malo(null, /lista/);
  malo({ fuentes, precios: { zz: {} } }, /Producto desconocido/);
  malo({ fuentes, precios: { p1: { otra: { precio: 5, fecha: HOY } } } }, /Fuente desconocida/);
  malo({ fuentes, precios: { p1: { mercadona: { precio: 0, fecha: HOY } } } }, /Precio no válido/);
  malo({ fuentes, precios: { p1: { mercadona: { precio: 99999, fecha: HOY } } } }, /Precio no válido/);
  malo({ fuentes, precios: { p1: { mercadona: { precio: "abc", fecha: HOY } } } }, /Precio no válido/);
  malo({ fuentes, precios: { p1: { mercadona: { precio: 5, fecha: "2026-02-30" } } } }, /Fecha no válida/);
  malo({ fuentes, precios: { p1: { mercadona: { precio: 5, fecha: "2026-11-01" } } } }, /futuro/);
  malo({ fuentes, precios: { p1: { mercadona: { precio: 5, fecha: "2025-13-45" } } } }, /Fecha no válida/); // no debe lanzar
  malo({ fuentes, precios: { p1: { mercadona: { precio: 5 } } } }, /Fecha no válida/);
  malo({ fuentes, precios: { p1: { mercadona: null } } }, /Precio no válido/);
  malo({ fuentes: [{ ...fuentes[0], frecuencia: "constructor" }], precios: {} }, /Frecuencia/);
  malo({ fuentes: [{ ...fuentes[0], tipo: "toString" }], precios: {} }, /Tipo/);
  malo({ fuentes: [{ ...fuentes[0], url: "javascript:alert(1)" }], precios: {} }, /http/);
  malo({ fuentes: [{ ...fuentes[0], tipo: "otro" }], precios: {} }, /Tipo/);
  malo({ fuentes: [{ ...fuentes[0], frecuencia: "cada hora" }], precios: {} }, /Frecuencia/);
  malo({ fuentes: [{ ...fuentes[0], id: "../x" }], precios: {} }, /Identificador/);
  malo({ fuentes: [fuentes[0], { ...fuentes[0], id: "otro" }], precios: {} }, /repetida/);
  malo({ fuentes: [{ ...fuentes[0], nombre: "  " }], precios: {} }, /obligatorio/);
  malo({ fuentes: Array.from({ length: 31 }, (_, i) => ({ ...fuentes[0], id: `f${i}`, nombre: `F${i}` })), precios: {} }, /Máximo 30/);
  malo({ fuentes }, /objeto/);
});

test("validar: un precio de mañana se admite (desfase horario)", () => {
  assert.equal(validarMercado({ fuentes, precios: { p1: { mercadona: { precio: 5, fecha: "2026-10-08" } } } }, { idsProductos: ids, hoy: HOY }).ok, true);
});

test("fuentes atrasadas: semanal tras 7 días; manual nunca avisa; sin precios, avisa", () => {
  const m = {
    fuentes: [{ id: "a", nombre: "A", frecuencia: "semanal" }, { id: "b", nombre: "B", frecuencia: "semanal" }, { id: "c", nombre: "C", frecuencia: "manual" }, { id: "d", nombre: "D", frecuencia: "semanal" }],
    precios: { p1: { a: { precio: 5, fecha: "2026-10-01" }, b: { precio: 5, fecha: "2026-09-29" } } },
  };
  assert.deepEqual(fuentesAtrasadas(m, HOY).map((f) => [f.id, f.dias]), [["b", 8], ["d", null]]);
});

test("datos por defecto: 30 productos de referencia que existen, al peso, con precio orientativo; fuentes válidas", () => {
  const d = leer("mercado.default.json");
  const productos = leer("productos.default.json");
  const orient = leer("precios-orientativos.json").precios;
  assert.equal(d.anclas.length, 30);
  assert.equal(new Set(d.anclas).size, 30);
  for (const id of d.anclas) {
    const p = productos.find((x) => x.id === id);
    assert.ok(p, `no existe ${id}`);
    assert.equal(p.unidad, "kg", id);
    assert.ok(orient[id], `sin orientativo ${id}`);
  }
  const v = validarMercado({ fuentes: d.fuentes, precios: {} }, { idsProductos: [], hoy: HOY });
  assert.equal(v.ok, true, JSON.stringify(v.errores));
  for (const nombre of ["Mercadona", "Carrefour", "Dia", "Alcampo", "Lidl", "Aldi", "El Corte Inglés", "Supersol"]) assert.ok(d.fuentes.some((f) => f.nombre.includes(nombre)), nombre);
});
