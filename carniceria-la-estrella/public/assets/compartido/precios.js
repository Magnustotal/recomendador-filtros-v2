// COPIA de lib/precios.mjs generada por scripts/empaquetar.mjs. No editar a mano.
// Ayudas para poner precio: calculadora desde el coste, ajuste porcentual y semáforo.
// Se usa en el servidor y en el panel (una sola fuente de verdad). Todos los importes son € con IVA salvo
// el coste, que se escribe SIN IVA. «Recargo» = porcentaje que se pone encima del coste ("pongo un 30 % encima").
import { redondear } from "./dinero.js";

export const MARGEN_POR_DEFECTO = 30;

// Cuánto se aparta del precio orientativo el rango «habitual», según lo fiable que sea la estimación.
export const AMPLITUD_RANGO = { a: 0.12, m: 0.2, b: 0.3 };
export const NOMBRE_FIABILIDAD = { a: "alta", m: "media", b: "baja" };

const cent = (n) => Math.round(n * 100) / 100;
const pct1 = (n) => Math.round(n * 10) / 10;
const esNumero = (n) => typeof n === "number" && Number.isFinite(n);

// Rango razonable alrededor del precio orientativo.
export function rangoOrientativo(precio, fiabilidad = "m") {
  const a = AMPLITUD_RANGO[fiabilidad] ?? AMPLITUD_RANGO.m;
  return { min: cent(precio * (1 - a)), max: cent(precio * (1 + a)) };
}

// Coste de cada kilo (o unidad) que se puede vender, contando lo que se pierde al limpiar y cortar.
export function costeEfectivo(coste, merma = 0) {
  if (merma < 0 || merma >= 100) throw new RangeError("merma entre 0 y 100");
  return coste / (1 - merma / 100);
}

// Precio de venta (con IVA) a partir del coste de compra sin IVA, la merma (%), el recargo (%) y el IVA (%).
// Devuelve el precio exacto y el redondeado a ,90/,95 (solo si se vende por kilo y hay redondeo).
export function precioDesdeCoste({ coste, merma = 0, margen = MARGEN_POR_DEFECTO, iva = 0, redondeo = null, unidad = "kg" }) {
  const sinIva = costeEfectivo(coste, merma) * (1 + margen / 100);
  const exacto = cent(sinIva * (1 + iva / 100));
  const precio = redondeo && unidad === "kg" ? redondear(exacto, redondeo) : exacto;
  return { exacto, precio };
}

// Recargo real (%) que deja un precio de venta sobre el coste, descontando el IVA y contando la merma.
export function recargoReal({ precio, coste, merma = 0, iva = 0 }) {
  const neto = precio / (1 + iva / 100);
  return pct1((neto / costeEfectivo(coste, merma) - 1) * 100);
}

// Sube o baja un precio un porcentaje (puede ser negativo). Sin redondeo a ,90: eso lo decide quien llama.
export function ajustarPorcentaje(precio, porcentaje) {
  return cent(precio * (1 + porcentaje / 100));
}

const eur = (n) => `${cent(n).toFixed(2).replace(".", ",")} €`;
const num = (n) => String(n).replace(".", ",");

/**
 * Semáforo de un precio.
 *  - Con coste: mide el recargo real frente al objetivo (si no, usa el rango de mercado).
 *  - Sin coste: compara con el rango orientativo.
 * nivel: "verde" | "ambar" | "rojo" | "gris". `base` dice en qué se ha apoyado.
 */
export function semaforo({ precio, orientativo = null, coste = null, merma = 0, iva = 0, margenObjetivo = MARGEN_POR_DEFECTO }) {
  if (!esNumero(precio) || precio <= 0) {
    return { nivel: "gris", etiqueta: "Sin precio", detalle: "Todavía no hay precio: en la tienda se verá «Consultar».", base: null };
  }
  if (esNumero(coste) && coste > 0) {
    const r = recargoReal({ precio, coste, merma, iva });
    const m = margenObjetivo;
    const objetivo = `Tu objetivo es un ${num(m)} % sobre el coste.`;
    const mercado = orientativo ? ` ${notaMercado(precio, orientativo)}` : "";
    let nivel, etiqueta, frase;
    if (r < 0) { nivel = "rojo"; etiqueta = "No cubre el coste"; frase = `Con tu coste y la merma, cada kilo (o unidad) que vendes te hace perder dinero (recargo ${num(r)} %).`; }
    else if (r < m * 0.5) { nivel = "rojo"; etiqueta = "Margen muy bajo"; frase = `Recargo real del ${num(r)} % sobre tu coste: apenas te deja ganancia.`; }
    else if (r < m * 0.8) { nivel = "ambar"; etiqueta = "Margen algo bajo"; frase = `Recargo real del ${num(r)} % sobre tu coste: queda por debajo de lo que buscas.`; }
    else if (r <= m * 1.5) { nivel = "verde"; etiqueta = "Margen correcto"; frase = `Recargo real del ${num(r)} % sobre tu coste: en la zona que buscas.`; }
    else if (r <= m * 2) { nivel = "ambar"; etiqueta = "Margen alto"; frase = `Recargo real del ${num(r)} % sobre tu coste: ganas bien, pero puede costarte ventas.`; }
    else { nivel = "rojo"; etiqueta = "Margen muy alto"; frase = `Recargo real del ${num(r)} % sobre tu coste: es mucho más de lo que buscas y puede espantar a los clientes.`; }
    return { nivel, etiqueta, detalle: `${frase} ${objetivo}${mercado}`, base: "coste", recargo: r };
  }
  if (orientativo && esNumero(orientativo.min) && esNumero(orientativo.max)) {
    const { min, max } = orientativo;
    const poco = orientativo.fiabilidad === "b" ? " (estimación poco fiable)" : "";
    const rango = `El rango habitual que manejo es ${eur(min)}–${eur(max)}${poco}.`;
    const pc = (v) => num(Math.abs(Math.round((v) * 100)));
    let nivel, etiqueta, frase;
    if (precio < min * 0.85) { nivel = "rojo"; etiqueta = "Muy barato"; frase = `Está un ${pc(precio / min - 1)} % por debajo del límite bajo.`; }
    else if (precio < min) { nivel = "ambar"; etiqueta = "Algo barato"; frase = `Está un poco por debajo del rango (un ${pc(precio / min - 1)} % bajo el límite).`; }
    else if (precio <= max) { nivel = "verde"; etiqueta = "En rango"; frase = "Está dentro del rango habitual."; }
    else if (precio <= max * 1.15) { nivel = "ambar"; etiqueta = "Algo caro"; frase = `Está un poco por encima del rango (un ${pc(precio / max - 1)} % sobre el límite).`; }
    else { nivel = "rojo"; etiqueta = "Muy caro"; frase = `Está un ${pc(precio / max - 1)} % por encima del límite alto.`; }
    return { nivel, etiqueta, detalle: `${frase} ${rango} Si escribes tu coste, el semáforo medirá tu margen real.`, base: "mercado" };
  }
  return { nivel: "gris", etiqueta: "Sin referencia", detalle: "No hay precio orientativo para este producto. Escribe tu coste para medir tu margen.", base: null };
}

function notaMercado(precio, o) {
  if (precio < o.min) return `Frente al mercado (${eur(o.min)}–${eur(o.max)}), es barato.`;
  if (precio > o.max) return `Frente al mercado (${eur(o.min)}–${eur(o.max)}), es caro.`;
  return `Frente al mercado (${eur(o.min)}–${eur(o.max)}), está en rango.`;
}
