import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { precioDe, fechaDe, normalizar, resumirSerie, resumenPanel, serieDeProducto, descargar, refrescarMercadoAuto, ENDPOINTS, SERIES } from "../lib/mercado-auto.mjs";

const fixture = (e) => JSON.parse(readFileSync(new URL(`./fixtures/mercado-ue/${e}.json`, import.meta.url), "utf8"));
const respuestas = () => Object.fromEntries(ENDPOINTS.map((e) => [e, fixture(e)]));
const productos = JSON.parse(readFileSync(new URL("../data/productos.default.json", import.meta.url), "utf8"));
const AHORA = Date.parse("2026-10-08T08:00:00Z");

test("precio y fecha de la UE: formatos y valores raros", () => {
  assert.equal(precioDe("€578.94"), 578.94);
  assert.equal(precioDe("€1130.50"), 1130.5);
  for (const raro of [null, "", "abc", "€0", "-5", "€999999"]) assert.equal(precioDe(raro), null, String(raro));
  assert.equal(fechaDe("21/09/2026"), "2026-09-21");
  for (const raro of [null, "2026-09-21", "31/02/2026x", "aa/bb/cccc"]) assert.equal(fechaDe(raro), null, String(raro));
});

test("normalizar: solo España y solo las series elegidas, ordenadas por semana, con los códigos de cada una", () => {
  const s = normalizar(respuestas());
  assert.deepEqual(Object.keys(s).sort(), Object.keys(SERIES).sort());
  const ult = s.vacuno.semanas.at(-1);
  assert.equal(ult.ini, "2026-09-21");
  assert.deepEqual(Object.keys(ult.codigos).sort(), ["ZO2", "ZO3", "ZR2", "ZR3", "ZU2", "ZU3"], "solo ternera joven (Z), no vacas ni toros");
  assert.deepEqual(Object.keys(s.cerdo.semanas.at(-1).codigos).sort(), ["E", "R", "S"], "sin lechones");
  assert.equal(s.pollo_pechuga.semanas.at(-1).codigos["Breast Fillet"], 499.97);
  const fechas = s.cerdo.semanas.map((x) => x.ini);
  assert.deepEqual(fechas, [...fechas].sort());
  assert.ok(s.cerdo.semanas.length <= 70);
  // Una fila de otro país o rota no entra
  const sucia = respuestas();
  sucia.poultry = [...sucia.poultry, { memberStateCode: "FR", beginDate: "28/09/2026", endDate: "04/10/2026", price: "€999.00", productName: "Breast Fillet", priceType: "Selling price" }, { memberStateCode: "ES", beginDate: "mal", endDate: "04/10/2026", price: "€1.00", productName: "Breast Fillet", priceType: "Selling price" }];
  assert.equal(normalizar(sucia).pollo_pechuga.semanas.at(-1).ini, "2026-09-21");
});

test("resumirSerie: variaciones frente a la semana anterior, 4 semanas, un año y la fecha de tus precios", () => {
  const s = normalizar(respuestas());
  const r = resumirSerie("cerdo", s.cerdo, { desde: "2026-08-24" });
  assert.equal(r.ultima.ini, "2026-09-21");
  assert.equal(r.unidad, "€/100 kg");
  for (const k of ["vsSemanaAnterior", "vsCuatroSemanas"]) assert.equal(typeof r[k], "number", k);
  assert.equal(r.vsTusPrecios.desde, "2026-08-24");
  assert.ok(Math.abs(r.vsTusPrecios.pct) < 30);
  assert.equal(r.grafico.length, 26);
  // Con datos inventados el cálculo es exacto
  const serie = { semanas: [
    { ini: "2026-08-24", fin: "2026-08-30", codigos: { A: 100, B: 200 } },
    { ini: "2026-08-31", fin: "2026-09-06", codigos: { A: 110, B: 200 } },
    { ini: "2026-09-07", fin: "2026-09-13", codigos: { A: 120, C: 50 } }, // B desaparece y aparece C: solo cuentan los códigos comunes
  ] };
  const q = resumirSerie("vacuno", serie, { desde: "2026-08-24" });
  assert.equal(q.vsSemanaAnterior, 9.1);
  assert.equal(q.vsTusPrecios.pct, 20);
  assert.equal(q.ultima.precio, 85, "nivel = media de los códigos de la semana");
  assert.equal(resumirSerie("vacuno", serie, { desde: "2026-09-07" }).vsTusPrecios, null, "si tus precios son de esta misma semana, aún no hay nada que comparar");
  assert.equal(resumirSerie("vacuno", { semanas: [] }), null);
  assert.equal(resumirSerie("no-existe", serie), null);
});

test("serieDeProducto: ternera, cerdo, pollo (pechuga, muslo, entero) y cordero tienen termómetro; lo demás, no", () => {
  const de = (categoria, nombre) => serieDeProducto({ categoria, nombre });
  assert.equal(de("vacuno", "Entrecot de ternera"), "vacuno");
  assert.equal(de("cerdo", "Chuletas de lomo"), "cerdo");
  assert.equal(de("cordero", "Pierna de cordero recental"), "cordero");
  assert.equal(de("pollo", "Pechuga de pollo"), "pollo_pechuga");
  assert.equal(de("pollo", "Filetes de pechuga de pollo"), "pollo_pechuga");
  assert.equal(de("pollo", "Muslo de pollo"), "pollo_muslo");
  assert.equal(de("pollo", "Pollo entero"), "pollo_entero");
  for (const c of ["cerdo-iberico", "pavo", "conejo", "caza", "embutidos", "elaborados", "vino", "casqueria"]) assert.equal(de(c, "X"), null, c);
  const cubiertos = productos.filter((p) => serieDeProducto(p)).length;
  assert.equal(cubiertos, 71, "con el catálogo inicial: 22 de vacuno, 16 de cerdo, 18 de pollo y 15 de cordero");
});

test("resumenPanel: productos cubiertos, avisos a partir del 5 % y datos viejos", () => {
  const s = normalizar(respuestas());
  const datos = { actualizado: "2026-10-07T06:30:00Z", series: s };
  const r = resumenPanel(datos, productos, { desde: "2026-03-02", hoy: "2026-10-08" });
  assert.equal(r.series.length, 6);
  assert.equal(r.productosCubiertos, 71);
  assert.equal(r.productosTotales, productos.length);
  assert.equal(r.desactualizado, false);
  assert.ok(r.avisos.every((a) => Math.abs(a.pct) >= 5 && a.productos > 0));
  assert.ok(r.avisos.length >= 1, "en seis meses el mercado se ha movido más del 5 % en alguna serie");
  assert.equal(resumenPanel(datos, productos, { desde: "2026-09-21", hoy: "2026-10-08" }).avisos.length, 0, "tus precios son de la última semana: nada que avisar");
  assert.equal(resumenPanel(datos, productos, { hoy: "2026-10-20" }).desactualizado, true, "más de 3 días");
  const vacio = resumenPanel(null, productos, { hoy: "2026-10-08" });
  assert.equal(vacio.series.length, 0);
  assert.equal(vacio.desactualizado, true);
  assert.equal(resumenPanel(datos, [], { hoy: "2026-10-08" }).avisos.length, 0, "sin productos no hay a quién avisar");
});

const fetchFalso = (huecos = []) => async (url) => {
  const e = /\/api\/([A-Za-z]+)\/prices/.exec(url)?.[1];
  if (huecos.includes(e)) return { ok: false, status: 503, text: async () => "" };
  return { ok: true, status: 200, text: async () => JSON.stringify(fixture(e)) };
};

test("descargar: pide solo España y los dos últimos años, y un fallo no tira el resto (conserva lo anterior)", async () => {
  const urls = [];
  const traer = async (u, o) => { urls.push(u); assert.match(o.headers["user-agent"], /CarniceriaLaEstrella/); return fetchFalso()(u); };
  const ok = await descargar(traer, AHORA);
  assert.equal(urls.length, 4);
  for (const u of urls) { assert.match(u, /^https:\/\/api\.tech\.ec\.europa\.eu\/agrifood\/api\/[A-Za-z]+\/prices\?memberStateCodes=ES&years=2025,2026$/); }
  assert.deepEqual(ok.errores, []);
  assert.equal(Object.keys(ok.series).length, 6);
  const parcial = await descargar(fetchFalso(["beef"]), AHORA, { previo: { series: { vacuno: { semanas: [{ ini: "2026-09-14", fin: "2026-09-20", codigos: { ZR3: 1 } }] } } } });
  assert.equal(parcial.errores.length, 1);
  assert.match(parcial.errores[0], /beef: HTTP 503/);
  assert.equal(parcial.series.vacuno.semanas[0].codigos.ZR3, 1, "la ternera conserva lo anterior");
  assert.ok(parcial.series.cerdo, "y lo demás se actualiza");
  const roto = await descargar(async () => ({ ok: true, status: 200, text: async () => "<html>no es json</html>" }), AHORA);
  assert.equal(roto.errores.length, 4);
  assert.deepEqual(roto.series, {});
});

test("refrescarMercadoAuto: guarda, no repite dentro de 3 días ni de 10 minutos (aunque se fuerce) y falla claro si no hay nada", async () => {
  let guardado = null, llamadas = 0, ahora = AHORA;
  const deps = { ahora: () => ahora, almacen: { leerMercadoAuto: async () => guardado, guardarMercadoAuto: async (v) => { guardado = v; } }, traer: async (u) => { llamadas++; return fetchFalso()(u); } };
  const a = await refrescarMercadoAuto(deps, { forzar: true });
  assert.equal(a.descargado, true);
  assert.equal(llamadas, 4);
  assert.equal(guardado.actualizado, new Date(AHORA).toISOString());
  ahora += 5 * 60_000;
  assert.equal((await refrescarMercadoAuto(deps, { forzar: true })).descargado, false, "forzar no martillea a la UE: 10 minutos");
  ahora += 60 * 60_000;
  assert.equal((await refrescarMercadoAuto(deps, { forzar: false })).descargado, false, "sin forzar, hasta 3 días");
  assert.equal((await refrescarMercadoAuto(deps, { forzar: true })).descargado, true, "forzado y pasados 10 minutos, sí");
  assert.equal(llamadas, 8);
  ahora += 4 * 86_400_000;
  assert.equal((await refrescarMercadoAuto(deps, {})).descargado, true, "pasados 3 días, se refresca solo");
  const sinNada = { ahora: () => AHORA, almacen: { leerMercadoAuto: async () => null, guardarMercadoAuto: async () => {} }, traer: async () => ({ ok: false, status: 500, text: async () => "" }) };
  await assert.rejects(() => refrescarMercadoAuto(sinNada, { forzar: true }), /No se pudieron descargar los precios de la UE/);
});
