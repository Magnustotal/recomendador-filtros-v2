// Descarga cada día los precios semanales de la carne que publica la UE y los deja guardados para el panel (pestaña «Mercado»).
import { refrescarMercadoAuto } from "../../lib/mercado-auto.mjs";
import { dependencias } from "../../lib/dependencias.mjs";

export default async (req, context) => {
  try {
    const { descargado, datos } = await refrescarMercadoAuto(dependencias(context), { forzar: true });
    console.log(descargado ? `Precios de la UE actualizados (${Object.keys(datos.series).length} series${datos.errores.length ? `, con fallos: ${datos.errores.join("; ")}` : ""}).` : "Precios de la UE: ya estaban al día.");
  } catch (e) {
    console.error("No se pudieron actualizar los precios de la UE:", e?.message ?? e);
  }
};

// Cada día a las 06:30 UTC (la UE publica una vez por semana; así un fallo puntual se arregla al día siguiente)
export const config = { schedule: "30 6 * * *" };
