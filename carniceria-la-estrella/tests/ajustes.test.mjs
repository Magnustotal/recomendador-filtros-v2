import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarAjustes } from "../lib/ajustes.mjs";

const base = () => JSON.parse(readFileSync(new URL("../data/ajustes.default.json", import.meta.url), "utf8"));

test("los ajustes por defecto son válidos y la tienda arranca desactivada", () => {
  const r = validarAjustes(base());
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.valor.tienda.activa, false);
  assert.equal(r.valor.negocio.whatsapp, "34601006290");
});

test("el teléfono se normaliza y el WhatsApp se deriva de él", () => {
  const a = base(); a.negocio.telefono = "+34 955 12 34 56"; a.negocio.whatsapp = "999";
  const r = validarAjustes(a);
  assert.equal(r.ok, true);
  assert.equal(r.valor.negocio.telefono, "955123456");
  assert.equal(r.valor.negocio.whatsapp, "34955123456");
});

test("rechaza horarios invertidos, dominios sin https y enlaces de mapa ajenos", () => {
  const a = base(); a.horario[0].abre = "16:00"; a.seo.dominio = "http://x.es"; a.negocio.mapsUrl = "https://evil.example/x";
  const r = validarAjustes(a);
  assert.equal(r.ok, false);
  const campos = r.errores.map((e) => e.campo);
  assert.ok(campos.includes("horario[0]"));
  assert.ok(campos.includes("seo.dominio"));
  assert.ok(campos.includes("negocio.mapsUrl"));
});

test("con la tienda activa exige recogida o reparto y una forma de pago", () => {
  const a = base(); a.tienda.activa = true; a.tienda.recogida.activa = false; a.tienda.reparto.activo = false;
  a.tienda.pagos = { efectivo: false, tarjetaRecogida: false, bizum: false, transferencia: false };
  const r = validarAjustes(a);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.campo === "tienda"));
  assert.ok(r.errores.some((e) => e.campo === "tienda.pagos"));
});

test("redondeo solo admite 90, 95 o nada", () => {
  const a = base(); a.tienda.redondeo = 80;
  assert.equal(validarAjustes(a).valor.tienda.redondeo, null);
  a.tienda.redondeo = 95;
  assert.equal(validarAjustes(a).valor.tienda.redondeo, 95);
});

test("no acepta tipos inesperados ni listas enormes", () => {
  const a = base(); a.negocio.nombre = { x: 1 }; a.horario = new Array(20).fill(a.horario[0]);
  const r = validarAjustes(a);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.campo === "negocio.nombre"));
  assert.ok(r.errores.some((e) => e.campo === "horario"));
});
