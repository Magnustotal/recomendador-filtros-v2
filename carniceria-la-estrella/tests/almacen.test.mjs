import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { arrancarBlobs } from "./ayuda/blobs-local.mjs";
import { crearAlmacen } from "../lib/almacen.mjs";

let blobs, almacen;
before(async () => { blobs = await arrancarBlobs(); almacen = crearAlmacen(); });
after(async () => { await blobs.parar(); });

test("ajustes y productos: valores por defecto antes de guardar nada", async () => {
  const a = await almacen.leerAjustes();
  assert.equal(a.negocio.nombre, "Carnicería La Estrella");
  const p = await almacen.leerProductos();
  assert.ok(p.length >= 200);
});

test("actualizarProductos guarda y la siguiente lectura lo ve", async () => {
  await almacen.actualizarProductos((lista) => lista.map((x) => (x.id === "pollo-pollo-entero" ? { ...x, precio: 8.5 } : x)));
  const lista = await almacen.leerProductos();
  assert.equal(lista.find((x) => x.id === "pollo-pollo-entero").precio, 8.5);
  assert.equal(lista.find((x) => x.id === "vacuno-solomillo-de-ternera").precio, null);
});

test("números de pedido correlativos por mes (con el servidor de Blobs real)", async () => {
  const hechos = [];
  for (let i = 1; i <= 5; i++) hechos.push(await almacen.crearPedido("2026-10-05", (numero) => ({ numero, estado: "nuevo", i })));
  assert.deepEqual(hechos.map((p) => p.numero), ["LE-2610-0001", "LE-2610-0002", "LE-2610-0003", "LE-2610-0004", "LE-2610-0005"]);
  const otro = await almacen.crearPedido("2026-11-01", (numero) => ({ numero, estado: "nuevo" }));
  assert.equal(otro.numero, "LE-2611-0001");
  const lista = await almacen.listarPedidos();
  assert.equal(lista.length, 6);
});

test("pedidos: leer, actualizar estado, listar (más nuevos primero) y borrar", async () => {
  await almacen.actualizarPedido("LE-2610-0001", { estado: "confirmado" });
  assert.equal((await almacen.leerPedido("LE-2610-0001")).estado, "confirmado");
  assert.equal((await almacen.listarPedidos())[0].numero, "LE-2611-0001");
  await almacen.borrarPedido("LE-2610-0001");
  assert.equal(await almacen.leerPedido("LE-2610-0001"), null);
  await assert.rejects(() => almacen.actualizarPedido("LE-9999-0001", { estado: "x" }));
});

test("fotos: bytes y tipo se conservan", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  await almacen.guardarFoto("11111111-2222-3333-4444-555555555555", bytes, "image/jpeg");
  const f = await almacen.leerFoto("11111111-2222-3333-4444-555555555555");
  assert.deepEqual([...new Uint8Array(f.bytes)], [...bytes]);
  assert.equal(f.tipo, "image/jpeg");
  await almacen.borrarFoto("11111111-2222-3333-4444-555555555555");
  assert.equal(await almacen.leerFoto("11111111-2222-3333-4444-555555555555"), null);
});

test("intentos de acceso: guardar, leer y borrar", async () => {
  await almacen.guardarIntentos("abc", { n: 2, desde: 5 });
  assert.deepEqual(await almacen.leerIntentos("abc"), { n: 2, desde: 5 });
  await almacen.borrarIntentos("abc");
  assert.equal(await almacen.leerIntentos("abc"), null);
});

test("actualizarProductos reintenta cuando el servicio detecta una modificación simultánea (ETag)", async () => {
  // Almacén falso con ETag real: simula lo que hace Netlify en producción.
  const datos = new Map(); let version = 0;
  const falso = {
    async getWithMetadata(k) { const v = datos.get(k); return v ? { data: structuredClone(v.data), etag: v.etag } : null; },
    async setJSON(k, d, o = {}) {
      const v = datos.get(k);
      if (o.onlyIfNew && v) return { modified: false };
      if (o.onlyIfMatch && (!v || v.etag !== o.onlyIfMatch)) return { modified: false };
      datos.set(k, { data: structuredClone(d), etag: `"v${++version}"` });
      return { modified: true };
    },
  };
  const a2 = crearAlmacen(() => falso);
  datos.set("productos", { data: [{ id: "a", precio: 1 }, { id: "b", precio: 1 }], etag: '"v0"' });
  let primera = true;
  await Promise.all([
    a2.actualizarProductos(async (l) => { if (primera) { primera = false; await new Promise((r) => setTimeout(r, 20)); } return l.map((x) => (x.id === "a" ? { ...x, precio: 5 } : x)); }),
    a2.actualizarProductos((l) => l.map((x) => (x.id === "b" ? { ...x, precio: 7 } : x))),
  ]);
  const final = datos.get("productos").data;
  assert.equal(final.find((x) => x.id === "a").precio, 5);
  assert.equal(final.find((x) => x.id === "b").precio, 7);
});

test("crearPedido: peticiones simultáneas obtienen números distintos (almacén con escrituras atómicas)", async () => {
  const datos = new Map();
  const falso = {
    async list({ prefix }) { await Promise.resolve(); return { blobs: [...datos.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
    async setJSON(k, d, o = {}) { await Promise.resolve(); if (o.onlyIfNew && datos.has(k)) return { modified: false }; datos.set(k, structuredClone(d)); return { modified: true }; },
    async get(k) { await Promise.resolve(); return datos.has(k) ? structuredClone(datos.get(k)) : null; },
  };
  const a2 = crearAlmacen(() => falso);
  const hechos = await Promise.all(Array.from({ length: 8 }, () => a2.crearPedido("2026-10-05", (numero) => ({ numero }))));
  const numeros = hechos.map((p) => p.numero).sort();
  assert.equal(new Set(numeros).size, 8);
  assert.equal(numeros[0], "LE-2610-0001");
  assert.equal(numeros[7], "LE-2610-0008");
});

test("probarEscrituraExclusiva: detecta si el almacén garantiza una sola escritura ganadora", async () => {
  const montar = (atomico) => {
    const datos = new Map();
    return {
      async setJSON(k, d, o = {}) { await Promise.resolve(); if (atomico && o.onlyIfNew && datos.has(k)) return { modified: false }; datos.set(k, { data: d, etag: "x" }); return { modified: true }; },
      async getWithMetadata(k) { return datos.get(k) ?? null; },
      async delete(k) { datos.delete(k); },
    };
  };
  assert.deepEqual(await crearAlmacen(() => montar(true)).probarEscrituraExclusiva(), { ganadores: 1, intentos: 8, conEtag: true });
  assert.equal((await crearAlmacen(() => montar(false)).probarEscrituraExclusiva()).ganadores, 8);
  // con el servidor de Blobs real también se puede ejecutar
  const real = await almacen.probarEscrituraExclusiva();
  assert.equal(real.intentos, 8);
});

test("crearPedido: si lo guardado no es nuestro pedido (número pisado), prueba con el siguiente", async () => {
  const datos = new Map(); let pisar = true;
  const falso = {
    async list() { return { blobs: [] }; },
    async setJSON(k, d) { datos.set(k, structuredClone(d)); if (pisar) { pisar = false; datos.set(k, { numero: "otro" }); } return { modified: true }; }, // otra petición pisa el primero
    async get(k) { return datos.get(k) ?? null; },
  };
  const p = await crearAlmacen(() => falso).crearPedido("2026-10-05", (numero) => ({ numero }));
  assert.equal(p.numero, "LE-2610-0002");
});
