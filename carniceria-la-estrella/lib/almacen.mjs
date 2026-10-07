// Acceso a Netlify Blobs: ajustes, productos, pedidos, fotos y control de intentos de acceso.
import { getStore } from "@netlify/blobs";
import { ajustesPorDefecto, productosPorDefecto, mercadoPorDefecto } from "./datos.generado.mjs";
import { numeroPedido } from "./pedido.mjs";

const REINTENTOS = 8;

// Ajustes guardados con una versión anterior: se completan con los valores por defecto de lo que falte (sin tocar listas).
function completar(guardado, defecto) {
  if (guardado == null || typeof guardado !== "object" || Array.isArray(guardado)) return guardado;
  const salida = { ...guardado };
  for (const [k, v] of Object.entries(defecto)) {
    if (!(k in salida)) salida[k] = structuredClone(v);
    else if (v && typeof v === "object" && !Array.isArray(v)) salida[k] = completar(salida[k], v);
  }
  return salida;
}

export function crearAlmacen(abrir = (nombre) => getStore({ name: nombre, consistency: "strong" })) {
  const config = () => abrir("config");
  const pedidos = () => abrir("pedidos");
  const fotos = () => abrir("fotos");
  const seguridad = () => abrir("seguridad");

  // Lectura-modificación-escritura con control de concurrencia (ETag) y reintentos.
  async function actualizarJson(store, clave, porDefecto, transformar) {
    for (let i = 0; i < REINTENTOS; i++) {
      const actual = await store.getWithMetadata(clave, { type: "json" });
      const base = actual?.data ?? structuredClone(porDefecto);
      const nuevo = await transformar(base);
      const condicion = actual ? (actual.etag ? { onlyIfMatch: actual.etag } : {}) : { onlyIfNew: true };
      const r = await store.setJSON(clave, nuevo, condicion);
      if (r?.modified !== false) return nuevo;
    }
    throw new Error("No se pudo guardar: demasiadas modificaciones simultáneas. Inténtalo de nuevo.");
  }

  return {
    async leerAjustes() { return completar(await config().get("ajustes", { type: "json" }), ajustesPorDefecto) ?? structuredClone(ajustesPorDefecto); },
    async guardarAjustes(valor) { await config().setJSON("ajustes", valor); },

    // Fechas de «última actualización»: contenido = cualquier cambio hecho desde el panel; precios = último cambio
    // (o confirmación) de precios. Son marcas informativas: si fallan, no deben romper nada.
    async leerMeta() { return (await config().get("meta", { type: "json" })) ?? {}; },
    async tocarMeta({ contenido = true, precios = false }, ahora = new Date()) {
      try {
        const meta = (await config().get("meta", { type: "json" })) ?? {};
        const iso = ahora.toISOString();
        if (contenido) meta.contenido = iso;
        if (precios) meta.precios = iso;
        await config().setJSON("meta", meta);
      } catch (e) { console.warn("No se pudo guardar la fecha de actualización:", e?.message ?? e); }
    },

    // Precios de referencia de otras fuentes (uso interno del carnicero): { fuentes, precios }.
    async leerMercado() {
      const m = await config().get("mercado", { type: "json" });
      return m ?? { fuentes: structuredClone(mercadoPorDefecto.fuentes), precios: {} };
    },
    async guardarMercado(valor) { await config().setJSON("mercado", valor); },

    async leerProductos() { return (await config().get("productos", { type: "json" })) ?? structuredClone(productosPorDefecto); },
    actualizarProductos(transformar) { return actualizarJson(config(), "productos", productosPorDefecto, transformar); },

    // ---- pedidos ----
    // Reserva el siguiente número libre del mes escribiendo el propio pedido con onlyIfNew:
    // si otra petición se adelantó, se prueba con el número siguiente.
    async crearPedido(fecha, construir) {
      const prefijo = `p/LE-${fecha.slice(2, 4)}${fecha.slice(5, 7)}-`;
      const { blobs } = await pedidos().list({ prefix: prefijo });
      let n = blobs.reduce((m, b) => Math.max(m, Number(b.key.slice(prefijo.length)) || 0), 0) + 1;
      for (let i = 0; i < 25; i++, n++) {
        const numero = numeroPedido(fecha, n);
        const pedido = construir(numero);
        const r = await pedidos().setJSON(`p/${numero}`, pedido, { onlyIfNew: true });
        if (r?.modified === false) continue;
        // Segunda red de seguridad: si lo guardado no es nuestro pedido, otra petición pisó el número.
        const leido = await pedidos().get(`p/${numero}`, { type: "json" });
        if (JSON.stringify(leido) === JSON.stringify(pedido)) return pedido;
      }
      throw new Error("No se pudo reservar un número de pedido. Inténtalo de nuevo.");
    },
    async leerPedido(numero) { return pedidos().get(`p/${numero}`, { type: "json" }); },
    async actualizarPedido(numero, cambios) {
      return actualizarJson(pedidos(), `p/${numero}`, null, (p) => { if (!p) throw new Error("Pedido no encontrado"); return { ...p, ...cambios }; });
    },
    async borrarPedido(numero) { await pedidos().delete(`p/${numero}`); },
    async listarPedidos(limite = 200) {
      const { blobs } = await pedidos().list({ prefix: "p/" });
      const claves = blobs.map((b) => b.key).sort().reverse().slice(0, limite);
      const lista = await Promise.all(claves.map((k) => pedidos().get(k, { type: "json" })));
      return lista.filter(Boolean);
    },

    // ---- fotos ----
    async guardarFoto(id, bytes, tipo) { await fotos().set(id, bytes, { metadata: { tipo } }); },
    async leerFoto(id) {
      const r = await fotos().getWithMetadata(id, { type: "arrayBuffer" });
      return r ? { bytes: r.data, tipo: r.metadata?.tipo ?? "image/jpeg" } : null;
    },
    async borrarFoto(id) { await fotos().delete(id); },

    // Comprobación para el panel: ¿el almacén garantiza que solo UNA de varias escrituras simultáneas "solo si no existe"
    // gana? De eso dependen los números de pedido únicos. También dice si hay ETag (control de ediciones simultáneas).
    async probarEscrituraExclusiva(intentos = 8) {
      const s = seguridad();
      const clave = `sonda/${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const resultados = await Promise.all(Array.from({ length: intentos }, (_, i) => s.setJSON(clave, { i }, { onlyIfNew: true }).then((r) => r?.modified !== false)));
      const lectura = await s.getWithMetadata(clave, { type: "json" });
      await s.delete(clave);
      return { ganadores: resultados.filter(Boolean).length, intentos, conEtag: Boolean(lectura?.etag) };
    },

    // ---- intentos de acceso al panel ----
    async leerIntentos(huella) { return (await seguridad().get(`login/${huella}`, { type: "json" })) ?? null; },
    async guardarIntentos(huella, estado) { await seguridad().setJSON(`login/${huella}`, estado); },
    async borrarIntentos(huella) { await seguridad().delete(`login/${huella}`); },
  };
}
