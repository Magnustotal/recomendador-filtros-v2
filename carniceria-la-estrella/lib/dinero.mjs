// Precios y cantidades. Todo el dinero se calcula en céntimos enteros y las
// cantidades en gramos (kg) o unidades (ud), para no arrastrar errores de coma flotante.

export const FINALES_VALIDOS = [90, 95];

// Sube el precio al siguiente que termine en ,90 o ,95 (nunca baja del precio introducido).
export function redondear(precio, final) {
  if (!FINALES_VALIDOS.includes(final)) throw new RangeError("final debe ser 90 o 95");
  if (!Number.isFinite(precio) || precio < 0) throw new RangeError("precio no válido");
  const centimos = Math.round(precio * 100);
  const euros = Math.floor(centimos / 100);
  const candidato = euros * 100 + final;
  return (centimos <= candidato ? candidato : candidato + 100) / 100;
}

export function aCentimos(euros) {
  return Math.round(euros * 100);
}

export function formatoEuro(euros) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(euros);
}

// Importe de una línea en céntimos: precio por kg (cantidad en gramos) o por unidad.
export function importeLinea(precio, unidad, cantidad) {
  if (precio == null) return null;
  const porUnidad = unidad === "kg" ? cantidad / 1000 : cantidad;
  return Math.round(aCentimos(precio) * porUnidad);
}

export function formatoCantidad(cantidad, unidad) {
  if (unidad === "ud") return `${cantidad} ud`;
  if (cantidad < 1000) return `${cantidad} g`;
  const kg = cantidad / 1000;
  return `${Number.isInteger(kg) ? kg : String(kg).replace(".", ",")} kg`;
}

export function cantidadValida(producto, cantidad) {
  if (!Number.isInteger(cantidad) || cantidad <= 0) return false;
  const paso = producto.paso ?? (producto.unidad === "kg" ? 250 : 1);
  const minimo = producto.minimo ?? paso;
  const maximo = producto.maximo ?? (producto.unidad === "kg" ? 25000 : 50);
  return cantidad >= minimo && cantidad <= maximo && cantidad % paso === 0;
}
