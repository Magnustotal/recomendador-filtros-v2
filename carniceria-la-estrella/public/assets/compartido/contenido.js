// COPIA de lib/contenido.mjs generada por scripts/empaquetar.mjs. No editar a mano.
// Precio por unidad de medida de los productos envasados (Real Decreto 3423/2000, arts. 2.b, 3 y 4 y anexo I; leído en el BOE).
// Un producto envasado con cantidad conocida (un bote de 250 g, una botella de 75 cl) tiene que enseñar, junto al precio de venta,
// el precio por kilo o por litro, a la vista y sin que el cliente lo pida. No hace falta cuando coincide con el precio de venta
// (lo que se vende por kilo, por pieza o por docena de huevos) ni en los vinos con denominación de origen o indicación geográfica.
// Se usa en el servidor y en el navegador.

// Cuánto vale cada medida, en kilos (las de peso) o en litros (las de volumen).
export const MEDIDAS = {
  g: { nombre: "g", por: "kg", factor: 0.001 },
  kg: { nombre: "kg", por: "kg", factor: 1 },
  ml: { nombre: "ml", por: "l", factor: 0.001 },
  cl: { nombre: "cl", por: "l", factor: 0.01 },
  l: { nombre: "l", por: "l", factor: 1 },
};

// Categorías donde casi todo viene envasado (bote, bolsa, botella) y por tanto toca revisar si hay que enseñar el precio por kilo o litro.
export const CATEGORIAS_ENVASADAS = ["especias", "salsas", "vino"];

export function contenidoValido(c) {
  return !!c && typeof c === "object" && Object.hasOwn(MEDIDAS, c.medida) && Number.isFinite(c.cantidad) && c.cantidad > 0 && c.cantidad <= 100000;
}

// {precio, por} con el precio (en €) de un kilo o un litro, o null si no hay contenido o el producto no se vende por unidad.
export function precioPorMedida(precio, contenido, unidad = "ud") {
  if (precio == null || unidad !== "ud" || !contenidoValido(contenido)) return null;
  const m = MEDIDAS[contenido.medida];
  return { precio: Math.round((precio / (contenido.cantidad * m.factor)) * 100) / 100, por: m.por };
}

const numeroEs = (n) => String(n).replace(".", ",");

// «75 cl», «250 g»
export function textoContenido(contenido) {
  return contenidoValido(contenido) ? `${numeroEs(contenido.cantidad)} ${MEDIDAS[contenido.medida].nombre}` : "";
}

// «75 cl · 12,00 €/l»; sin contenido o sin precio, cadena vacía. `formato` es el que ya usa la página para los euros.
export function lineaContenido(precio, contenido, unidad, formato) {
  const pm = precioPorMedida(precio, contenido, unidad);
  return pm ? `${textoContenido(contenido)} · ${formato(pm.precio)}/${pm.por}` : "";
}

// Productos visibles de las categorías envasadas que nadie ha mirado todavía (sin contenido y sin marcar como exentos).
export function contenidoPendiente(productos) {
  return productos.filter((p) => !p.oculto && p.unidad === "ud" && CATEGORIAS_ENVASADAS.includes(p.categoria) && !contenidoValido(p.contenido) && !p.precioUnidadExento).length;
}
