import { test } from "node:test";
import assert from "node:assert/strict";
import { distanciaKm, geocodificarNominatim, redondear1 } from "../lib/geocodificar.mjs";

const TIENDA = { lat: 37.4119071, lng: -5.9763565 };

test("distancia (haversine): valores conocidos", () => {
  assert.equal(distanciaKm(TIENDA, TIENDA), 0);
  // Sevilla (Plaza Nueva) está a unos 3,5-4 km de La Barzola (en línea recta)
  const d = distanciaKm(TIENDA, { lat: 37.3886, lng: -5.9953 });
  assert.ok(d > 2.5 && d < 4.5, `d=${d}`);
  // Sevilla - Madrid, unos 390 km en línea recta
  const sm = distanciaKm({ lat: 37.3891, lng: -5.9845 }, { lat: 40.4168, lng: -3.7038 });
  assert.ok(sm > 380 && sm < 400, `sm=${sm}`);
  assert.equal(redondear1(1.2499), 1.2);
});

test("geocodificarNominatim: éxito, sin resultados, error HTTP, red caída y tiempo agotado", async () => {
  const responder = (cuerpo, ok = true) => async () => ({ ok, json: async () => cuerpo });
  assert.deepEqual(await geocodificarNominatim("x", { fetchFn: responder([{ lat: "37.4", lon: "-5.97" }]) }), { lat: 37.4, lng: -5.97 });
  assert.equal(await geocodificarNominatim("x", { fetchFn: responder([]) }), null);
  assert.equal(await geocodificarNominatim("x", { fetchFn: responder({ error: 1 }) }), null);
  assert.equal(await geocodificarNominatim("x", { fetchFn: responder([{ lat: "abc", lon: "1" }]) }), null);
  assert.equal(await geocodificarNominatim("x", { fetchFn: responder([], false) }), null);
  assert.equal(await geocodificarNominatim("x", { fetchFn: async () => { throw new Error("sin red"); } }), null);
  assert.equal(await geocodificarNominatim("x", { fetchFn: (u, { signal }) => new Promise((_, mal) => signal.addEventListener("abort", () => mal(new Error("tiempo")))), timeoutMs: 30 }), null);
});

test("geocodificarNominatim: la petición lleva User-Agent, país y la consulta codificada", async () => {
  let visto;
  await geocodificarNominatim("Calle Sol 4, 41001 Sevilla", { fetchFn: async (url, op) => { visto = { url, op }; return { ok: true, json: async () => [] }; } });
  assert.match(visto.url, /^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
  assert.match(visto.url, /countrycodes=es/);
  assert.match(visto.url, /q=Calle%20Sol%204%2C%2041001%20Sevilla/);
  assert.match(visto.op.headers["User-Agent"], /carniceria-la-estrella/);
});
