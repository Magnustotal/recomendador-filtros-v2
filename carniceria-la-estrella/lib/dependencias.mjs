// Dependencias reales de las funciones en Netlify (en las pruebas se sustituyen por otras).
import { purgeCache } from "@netlify/functions";
import { crearAlmacen } from "./almacen.mjs";
import { ajustesPorDefecto } from "./datos.generado.mjs";
import { geocodificarNominatim } from "./geocodificar.mjs";

export function dependencias(context) {
  return {
    almacen: crearAlmacen(),
    env: process.env,
    ahora: () => Date.now(),
    ip: context?.ip ?? "desconocida",
    ajustesPorDefecto,
    geocodificar: (consulta) => geocodificarNominatim(consulta),
    async purgar(tags) {
      if (process.env.LS_SIN_PURGA === "1") return; // servidor local de pruebas: no hay CDN que purgar
      try { await purgeCache({ tags }); } catch (e) { console.warn("No se pudo purgar la caché (los cambios tardarán unos minutos en verse):", e?.message ?? e); }
    },
  };
}
