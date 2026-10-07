// Service worker: qué peticiones toca y cuáles deja pasar sin guardar (la API privada nunca se cachea).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function cargarSw() {
  const oyentes = {};
  const sw = { location: { origin: "https://tienda.test" }, addEventListener: (t, f) => { oyentes[t] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {} } };
  const contexto = vm.createContext({ self: sw, caches: { open: async () => ({ addAll: async () => {}, put: async () => {} }), match: async () => undefined, keys: async () => [], delete: async () => {} }, fetch: async () => new Response("ok"), URL, Response });
  vm.runInContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), contexto);
  return oyentes;
}
function peticion(oyentes, ruta, metodo = "GET") {
  let respondida = false;
  oyentes.fetch({ request: { method: metodo, url: `https://tienda.test${ruta}`, mode: "navigate" }, respondWith: () => { respondida = true; } });
  return respondida;
}

test("sw: la tienda se puede ver sin conexión (catálogo público) pero nada privado pasa por la caché", () => {
  const sw = cargarSw();
  assert.equal(peticion(sw, "/api/catalogo"), true, "el catálogo público sí");
  assert.equal(peticion(sw, "/tienda"), true);
  assert.equal(peticion(sw, "/assets/tienda.js"), true);
  for (const privada of ["/api/admin/pedidos", "/api/admin/datos", "/api/admin/mercado", "/api/pedido", "/api/foto/00000000-0000-0000-0000-000000000000", "/api/catalogo-x/otra", "/admin/", "/admin/main.js"]) {
    assert.equal(peticion(sw, privada), false, `${privada} no debe pasar por la caché`);
  }
  assert.equal(peticion(sw, "/api/catalogo", "POST"), false, "solo GET");
});
