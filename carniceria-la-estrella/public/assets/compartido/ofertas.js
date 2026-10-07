// COPIA de lib/ofertas.mjs generada por scripts/empaquetar.mjs. No editar a mano.
// Ofertas temporales de producto y regalos por compra. Se usa en el servidor (el pedido lo calcula todo aquí)
// y en el navegador (para enseñar lo mismo al cliente): una sola fuente de verdad, con pruebas.
//
// No hay nada «programado»: cada oferta lleva su fecha de inicio y de fin (días completos, ambos incluidos, hora de
// Madrid) y se comprueba contra el día de hoy cada vez que se calcula. Si hoy está dentro, se aplica; si no, no.
// Todo el dinero va en céntimos enteros y las cantidades en gramos (kg) o unidades (ud), como en el resto de la web.
import { importeLinea, aCentimos, formatoEuro } from "./dinero.js";
import { sumarDias } from "./horario.js";

export const MAX_OFERTAS_POR_PRODUCTO = 8;
export const MAX_REGALOS = 5;

export const TIPOS_OFERTA = { precio: "Precio rebajado", cantidad: "Lleva más, paga menos (3x2…)" };

const esNumero = (n) => typeof n === "number" && Number.isFinite(n);

// ¿Está activa hoy? Las fechas son AAAA-MM-DD, así que comparar textos equivale a comparar días. Una fecha vacía = sin límite.
export const estaVigente = (x, hoy) => (!x.desde || x.desde <= hoy) && (!x.hasta || hoy <= x.hasta);

export function ofertaVigente(ofertas, hoy) {
  return (ofertas ?? []).find((o) => o.desde && o.hasta && estaVigente(o, hoy)) ?? null;
}

// «3x2», o «Oferta» para una rebaja de precio.
export const nombreOferta = (o) => (o.tipo === "cantidad" ? `${o.lleva}x${o.paga}` : "Oferta");

// ---- precio anterior (Ley 7/1996 de Ordenación del Comercio Minorista, art. 20.1) ----
// Cuando se anuncia una rebaja hay que enseñar el precio anterior, que es el MENOR que se haya aplicado al mismo producto en
// los 30 días anteriores al inicio de la rebaja (no vale un precio «habitual» más alto si hace poco se vendió más barato).
// Sin precio en esos 30 días (producto que sale a la venta por primera vez) no hay rebaja que anunciar.

export const DIAS_PRECIO_ANTERIOR = 30;
const FECHA_BASE = "2000-01-01";

// Historial de precios del producto: [{ desde: "AAAA-MM-DD", precio: número|null }] por orden de fecha. Cada cambio de precio
// añade una entrada (con otro cambio el mismo día, se queda el último: se supone que el primero fue una errata corregida).
export function historialActualizado(previo, precioNuevo, hoy) {
  const nuevo = precioNuevo ?? null;
  let h = Array.isArray(previo?.historial) && previo.historial.length ? previo.historial.map((e) => ({ ...e })) : previo ? [{ desde: FECHA_BASE, precio: previo.precio ?? null }] : [];
  const ultimo = h.at(-1);
  if (!ultimo) { if (nuevo != null) h.push({ desde: hoy, precio: nuevo }); return h; }
  if ((ultimo.precio ?? null) === nuevo) return h;
  const dia = hoy < ultimo.desde ? ultimo.desde : hoy; // el historial nunca va hacia atrás (por si el reloj se desajusta)
  if (ultimo.desde === dia) h[h.length - 1] = { desde: dia, precio: nuevo };
  else h.push({ desde: dia, precio: nuevo });
  return h.slice(-60);
}

// Precio habitual (sin ofertas) que tenía el producto un día dado. Sin historial se supone que siempre fue el actual.
function precioRegularEn(p, dia) {
  const h = p.historial;
  if (!Array.isArray(h) || !h.length) return esNumero(p.precio) ? p.precio : null;
  let r = null;
  for (const e of h) { if (e.desde <= dia) r = e.precio; else break; }
  return esNumero(r) ? r : null;
}

/**
 * Precio anterior legal de una rebaja de precio `o` del producto `p`: el menor aplicado en los 30 días anteriores a su inicio,
 * contando precio habitual y otras rebajas que hubiera. null = no había precio (primera vez a la venta).
 * `ignorar` = oferta que no cuenta (la que se está editando). Si la oferta ya trae `anterior` (catálogo público), se usa.
 */
export function precioAnterior(p, o, ignorar = null) {
  if (o.anterior !== undefined) return o.anterior;
  let menor = null;
  for (let i = DIAS_PRECIO_ANTERIOR; i >= 1; i--) {
    const dia = sumarDias(o.desde, -i);
    let precio = precioRegularEn(p, dia);
    for (const x of p.ofertas ?? []) {
      if (x === o || x === ignorar || x.tipo !== "precio" || !esNumero(x.precio) || !(x.desde <= dia && dia <= x.hasta)) continue;
      if (precio != null && x.precio < precio) precio = x.precio;
    }
    if (precio != null && (menor == null || precio < menor)) menor = precio;
  }
  return menor;
}

// ¿Es una rebaja de verdad? Devuelve { valida, anterior, motivo }. Para avisar al programarla y para decidir qué se enseña.
export function rebajaValida(p, o, ignorar = null) {
  const anterior = precioAnterior(p, o, ignorar);
  if (anterior == null) return { valida: false, anterior, motivo: "primera" };
  if (!(o.precio < anterior)) return { valida: false, anterior, motivo: "no-baja" };
  return { valida: true, anterior, motivo: null };
}

// Precio con el que se vende hoy. `habitual` es el precio anterior legal, el que se enseña tachado, y solo viene cuando la rebaja
// lo es de verdad. Una rebaja que no es más barata que el precio habitual actual no se aplica; una que sí lo es pero no cumple
// la regla de los 30 días se cobra, pero sin tachar nada ni anunciarla como oferta.
export function precioEfectivo(p, hoy) {
  const o = ofertaVigente(p.ofertas, hoy);
  if (o?.tipo === "precio" && esNumero(p.precio) && esNumero(o.precio) && o.precio < p.precio) {
    const r = rebajaValida(p, o);
    return { precio: o.precio, habitual: r.valida ? r.anterior : null, oferta: r.valida ? o : null };
  }
  if (o?.tipo === "cantidad" && esNumero(p.precio)) return { precio: p.precio, habitual: null, oferta: o };
  return { precio: p.precio, habitual: null, oferta: null };
}

/**
 * Importe de varias líneas con sus ofertas. `items` = [{ p, cantidad }] (p = producto con precio, unidad y ofertas).
 * Devuelve, por línea y en el mismo orden: { precio, habitual, subtotalCent, ahorroCent, oferta, gratis }.
 *  - subtotalCent: lo que se paga por la línea (null si el producto no tiene precio).
 *  - ahorroCent: lo que se ahorra frente al precio habitual.
 *  - gratis: cantidad que sale gratis por una oferta «lleva N, paga M» (en gramos o unidades).
 * «Lleva N, paga M» cuenta tramos completos de N kg (o N unidades) de ese producto en todo el pedido, aunque estén en varias líneas;
 * lo gratis se reparte entre las líneas por orden.
 */
export function calcularLineas(items, hoy) {
  const resultado = items.map(({ p, cantidad }) => {
    const e = precioEfectivo(p, hoy);
    const habitualCent = importeLinea(e.habitual ?? e.precio, p.unidad, cantidad); // el ahorro se mide contra el precio anterior legal
    const cent = importeLinea(e.precio, p.unidad, cantidad);
    return { precio: e.precio, habitual: e.habitual, subtotalCent: cent, ahorroCent: habitualCent == null || cent == null ? 0 : habitualCent - cent, oferta: e.oferta, gratis: 0 };
  });

  const total = new Map(); // cantidad total pedida de cada producto con oferta de cantidad
  items.forEach(({ p, cantidad }, i) => { if (resultado[i].oferta?.tipo === "cantidad") total.set(p.id, (total.get(p.id) ?? 0) + cantidad); });
  const pendiente = new Map();
  for (const [id, suma] of total) {
    const i = items.findIndex((x) => x.p.id === id);
    const { p } = items[i];
    const { lleva, paga } = resultado[i].oferta;
    const base = p.unidad === "kg" ? 1000 : 1;
    pendiente.set(id, Math.floor(suma / (lleva * base)) * (lleva - paga) * base);
  }
  items.forEach(({ p, cantidad }, i) => {
    const libre = Math.min(pendiente.get(p.id) ?? 0, cantidad);
    if (!(libre > 0)) return;
    pendiente.set(p.id, pendiente.get(p.id) - libre);
    const ahorro = importeLinea(p.precio, p.unidad, libre);
    resultado[i].gratis = libre;
    resultado[i].ahorroCent = ahorro;
    resultado[i].subtotalCent -= ahorro;
  });
  return resultado;
}

/**
 * Regalos por compra que están activos hoy y cuántos le tocan a un pedido que suma `baseCent` (céntimos, ya con las ofertas
 * y sin el envío). Devuelve todos los vigentes, también los de cantidad 0, para poder decir «te faltan X €».
 *   regalo = { regalo: "texto", minimo: euros, repetir: bool, maximo: entero|null, desde, hasta }
 */
export function regalosDelPedido(regalos, baseCent, hoy) {
  const salida = [];
  for (const r of regalos ?? []) {
    if (!estaVigente(r, hoy)) continue;
    const minimoCent = aCentimos(r.minimo);
    if (!(minimoCent > 0)) continue;
    let cantidad = r.repetir ? Math.floor(baseCent / minimoCent) : baseCent >= minimoCent ? 1 : 0;
    if (r.maximo != null) cantidad = Math.min(cantidad, r.maximo);
    const completo = r.maximo != null && cantidad >= r.maximo;
    const faltaCent = completo || (!r.repetir && cantidad >= 1) ? null : minimoCent * (cantidad + 1) - baseCent;
    salida.push({ texto: r.regalo, cantidad, minimoCent, repetir: !!r.repetir, maximo: r.maximo ?? null, hasta: r.hasta ?? null, faltaCent });
  }
  return salida;
}

// ---- escaparate: lo que se enseña en la portada y en la tienda ----

export const fechaCorta = (iso) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

// «Por cada 30,00 € de compra (máximo 2 por pedido)» / «En compras de 30,00 € o más»
export function condicionRegalo(r) {
  const base = r.repetir ? `Por cada ${formatoEuro(r.minimo)} de compra` : `En compras de ${formatoEuro(r.minimo)} o más`;
  return r.repetir && r.maximo != null ? `${base} (máximo ${r.maximo} por pedido)` : base;
}
export const textoRegalo = (r) => `${condicionRegalo(r)}, de regalo ${r.regalo}${r.hasta ? ` (hasta el ${fechaCorta(r.hasta)})` : ""}.`;

// «Oferta de la semana» si hay una sola cosa que enseñar; «Ofertas de la semana» si hay varias.
export const tituloDestacadas = (n) => (n === 1 ? "Oferta de la semana" : "Ofertas de la semana");

/**
 * Tarjetas del escaparate: las ofertas de producto que están activas hoy (con precio y sin agotar) por orden de fin,
 * y después los regalos por compra activos hoy.
 *   { clase: "producto", p, oferta, precio, habitual, hasta }  |  { clase: "regalo", regalo, hasta }
 */
export function destacadas(productos, regalos, hoy) {
  const tarjetas = [];
  for (const p of productos ?? []) {
    if (p.oculto || p.agotado) continue;
    const e = precioEfectivo(p, hoy);
    if (!e.oferta) continue;
    tarjetas.push({ clase: "producto", p, oferta: e.oferta, precio: e.precio, habitual: e.habitual, hasta: e.oferta.hasta });
  }
  tarjetas.sort((a, b) => (a.hasta < b.hasta ? -1 : a.hasta > b.hasta ? 1 : a.p.nombre.localeCompare(b.p.nombre, "es")));
  for (const r of regalos ?? []) if (estaVigente(r, hoy) && r.minimo > 0) tarjetas.push({ clase: "regalo", regalo: r, hasta: r.hasta ?? null });
  return tarjetas;
}

// ---- validación (la usan productos.mjs y ajustes.mjs) ----

const fechaReal = (f) => { const d = new Date(`${f}T00:00:00Z`); return typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f; };
export { fechaReal };

// Dos rangos de fechas (desde, hasta) se pisan si comparten algún día.
export function hayRangosSolapados(rangos) {
  const orden = [...rangos].sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  for (let i = 1; i < orden.length; i++) if (orden[i].desde <= orden[i - 1].hasta) return [orden[i - 1], orden[i]];
  return null;
}
