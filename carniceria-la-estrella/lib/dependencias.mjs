// Dependencias reales de las funciones en Netlify (en las pruebas se sustituyen por otras).
import { purgeCache } from "@netlify/functions";
import { crearAlmacen } from "./almacen.mjs";
import { ajustesPorDefecto } from "./datos.generado.mjs";
import { geocodificarNominatim } from "./geocodificar.mjs";
import { readFile } from "node:fs/promises";

export function dependencias(context) {
  return {
    almacen: crearAlmacen(),
    env: process.env,
    ahora: () => Date.now(),
    ip: context?.ip ?? "desconocida",
    ajustesPorDefecto,
    geocodificar: (consulta) => geocodificarNominatim(consulta),
    // Descargas externas (precios de la UE). En las pruebas de navegador, LS_MERCADO_FIXTURE apunta a una carpeta con un JSON por endpoint.
    traer: process.env.LS_MERCADO_FIXTURE
      ? async (url) => {
          const nombre = /\/api\/([A-Za-z]+)\/prices/.exec(url)?.[1];
          try { const texto = await readFile(`${process.env.LS_MERCADO_FIXTURE}/${nombre}.json`, "utf8"); return { ok: true, status: 200, text: async () => texto }; } catch { return { ok: false, status: 404, text: async () => "" }; }
        }
      : (...a) => fetch(...a),
    async purgar(tags) {
      if (process.env.LS_SIN_PURGA === "1") return; // servidor local de pruebas: no hay CDN que purgar
      try { await purgeCache({ tags }); } catch (e) { console.warn("No se pudo purgar la caché (los cambios tardarán unos minutos en verse):", e?.message ?? e); }
    },
  };
}
