import { test } from "node:test";
import assert from "node:assert/strict";
import { texto, numeroOpcional, telefonoEspana, franja, fechaISO, diasSemana, listaTextos, ErrorValidacion } from "../lib/validar.mjs";

test("texto: recorta, quita caracteres de control y respeta límites", () => {
  assert.equal(texto("  hola\u0000 mundo \n", { max: 20 }), "hola mundo");
  assert.equal(texto("a\nb", { multilinea: true, max: 10 }), "a\nb");
  assert.throws(() => texto("x".repeat(11), { max: 10 }), ErrorValidacion);
  assert.throws(() => texto("", { min: 1, campo: "nombre" }), /nombre: Es obligatorio/);
  assert.throws(() => texto(42), ErrorValidacion);
});

test("numeroOpcional acepta coma decimal, null y rechaza basura", () => {
  assert.equal(numeroOpcional("12,345"), 12.35);
  assert.equal(numeroOpcional(""), null);
  assert.equal(numeroOpcional(null), null);
  assert.throws(() => numeroOpcional("abc"), ErrorValidacion);
  assert.throws(() => numeroOpcional(-1), ErrorValidacion);
  assert.throws(() => numeroOpcional(Infinity), ErrorValidacion);
});

test("telefonoEspana normaliza prefijos y espacios", () => {
  assert.equal(telefonoEspana("601 00 62 90"), "601006290");
  assert.equal(telefonoEspana("+34 601006290"), "601006290");
  assert.equal(telefonoEspana("0034601006290"), "601006290");
  assert.throws(() => telefonoEspana("12345"), ErrorValidacion);
  assert.throws(() => telefonoEspana("501006290"), ErrorValidacion);
});

test("franja, fechaISO y diasSemana validan el formato", () => {
  assert.equal(franja("09:00-11:00"), "09:00-11:00");
  assert.throws(() => franja("11:00-09:00"), ErrorValidacion);
  assert.throws(() => franja("9:00-11:00"), ErrorValidacion);
  assert.equal(fechaISO("2026-10-07"), "2026-10-07");
  assert.throws(() => fechaISO("2026-02-30"), ErrorValidacion);
  assert.deepEqual(diasSemana([3, 1, 1]), [1, 3]);
  assert.throws(() => diasSemana([0]), ErrorValidacion);
});

test("listaTextos elimina duplicados y vacíos", () => {
  assert.deepEqual(listaTextos([" a ", "a", "", "b"]), ["a", "b"]);
  assert.throws(() => listaTextos("x"), ErrorValidacion);
});
