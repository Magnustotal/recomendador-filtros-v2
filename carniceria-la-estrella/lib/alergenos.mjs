// Alérgenos: qué se enseña al cliente de cada producto. Se usa en el servidor y en el navegador (tienda y panel).
// Base legal (texto leído en el BOE y en EUR-Lex): en la venta a distancia la información sobre alérgenos tiene que estar
// disponible ANTES de comprar (Reglamento (UE) 1169/2011, art. 14.1, y Real Decreto 126/2015, arts. 4.1.b y 9).
// La lista de las 14 sustancias es la del anexo II del Reglamento (UE) 1169/2011.

export const ALERGENOS_UE = [
  "Cereales con gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Leche", "Frutos de cáscara",
  "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos",
];

// Categorías en las que es normal que haya alérgenos (adobos, empanados, curados, salsas, vino con sulfitos…) y por eso no se
// da por bueno un producto «en blanco»: hasta que alguien lo revisa, la tienda dice que se consulte antes de pedir.
// La carne fresca sin elaborar, la casquería, los avíos y los huevos (el propio nombre ya los indica) no entran.
export const CATEGORIAS_A_REVISAR = ["elaborados", "embutidos", "jamones", "quesos", "salsas", "especias", "vino"];

/**
 * Qué decir de los alérgenos de un producto.
 *  - nivel "contiene": tiene alérgenos indicados → «Alérgenos: …».
 *  - nivel "ninguno": revisado y sin ninguno → «Sin alérgenos declarados» (solo en las categorías a revisar).
 *  - nivel "pendiente": categoría a revisar y nadie lo ha revisado → «Alérgenos: consúltanos antes de pedir».
 *  - null: no hace falta decir nada.
 */
export function infoAlergenos(p) {
  const lista = Array.isArray(p?.alergenos) ? p.alergenos.filter(Boolean) : [];
  if (lista.length) return { nivel: "contiene", texto: `Alérgenos: ${lista.join(", ")}` };
  const sensible = CATEGORIAS_A_REVISAR.includes(p?.categoria);
  if (!sensible) return null;
  if (p?.alergenosRevisados) return { nivel: "ninguno", texto: "Sin alérgenos declarados" };
  return { nivel: "pendiente", texto: "Alérgenos: consúltanos antes de pedir" };
}

// Cuántos productos visibles de las categorías a revisar siguen sin revisar (para la lista de comprobación del panel).
export function alergenosPendientes(productos) {
  return productos.filter((p) => !p.oculto && infoAlergenos(p)?.nivel === "pendiente").length;
}
