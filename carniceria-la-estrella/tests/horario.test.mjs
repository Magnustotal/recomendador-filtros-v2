import { test } from "node:test";
import assert from "node:assert/strict";
import { ahoraEnMadrid, diaSemanaDeFecha, sumarDias, tramosDelDia, franjaDentroDeHorario, filasHorario, especificacionJsonLd } from "../lib/horario.mjs";

const HORARIO = [
  { dias: [1, 2, 3, 4, 5], abre: "09:00", cierra: "15:00" },
  { dias: [1, 2, 3, 4, 5], abre: "17:30", cierra: "20:30" },
  { dias: [6], abre: "09:00", cierra: "15:00" },
];

test("ahoraEnMadrid usa la hora de Sevilla, también en horario de verano e invierno", () => {
  // 2026-10-07 22:30 UTC = 2026-10-08 00:30 en Madrid (CEST, UTC+2)
  assert.deepEqual(ahoraEnMadrid(new Date("2026-10-07T22:30:00Z")), { fecha: "2026-10-08", dia: 4, minutos: 30 });
  // invierno: UTC+1
  assert.deepEqual(ahoraEnMadrid(new Date("2026-12-25T09:15:00Z")), { fecha: "2026-12-25", dia: 5, minutos: 615 });
});

test("diaSemanaDeFecha y sumarDias", () => {
  assert.equal(diaSemanaDeFecha("2026-10-04"), 7); // domingo
  assert.equal(diaSemanaDeFecha("2026-10-05"), 1); // lunes
  assert.equal(sumarDias("2026-10-31", 1), "2026-11-01");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});

test("franjaDentroDeHorario respeta los tramos de cada día", () => {
  assert.equal(franjaDentroDeHorario(HORARIO, 1, "09:00-11:00"), true);
  assert.equal(franjaDentroDeHorario(HORARIO, 1, "17:30-19:30"), true);
  assert.equal(franjaDentroDeHorario(HORARIO, 6, "17:30-19:30"), false);
  assert.equal(franjaDentroDeHorario(HORARIO, 1, "14:00-16:00"), false);
  assert.equal(franjaDentroDeHorario(HORARIO, 7, "09:00-11:00"), false);
  assert.equal(tramosDelDia(HORARIO, 6).length, 1);
});

test("filasHorario agrupa días iguales como la tabla actual", () => {
  assert.deepEqual(filasHorario(HORARIO), [
    { etiqueta: "Lunes a viernes", texto: "9:00–15:00 y 17:30–20:30", cerrado: false },
    { etiqueta: "Sábado", texto: "9:00–15:00", cerrado: false },
    { etiqueta: "Domingo", texto: "Cerrado", cerrado: true },
  ]);
});

test("especificacionJsonLd genera schema.org", () => {
  const s = especificacionJsonLd(HORARIO);
  assert.equal(s.length, 3);
  assert.deepEqual(s[2], { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "09:00", closes: "15:00" });
});
