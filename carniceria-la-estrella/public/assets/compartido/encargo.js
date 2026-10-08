// COPIA de lib/encargo.mjs generada por scripts/empaquetar.mjs. No editar a mano.
// Productos «por encargo»: no están en stock, pero se pueden pedir y se traen. Su precio es orientativo y el negocio lo confirma antes de
// hacer el encargo. Se usa en el servidor y en el navegador (tienda y panel).

export const TEXTO_ENCARGO = "Por encargo: el precio es orientativo y te lo confirmamos antes de hacer el encargo.";
// Lo mismo sin el «Por encargo:» inicial, para ir junto a la etiqueta «Por encargo» de la tarjeta
export const TEXTO_ENCARGO_CORTO = "El precio es orientativo y te lo confirmamos antes de hacer el encargo.";

// Un producto es por encargo si se ha marcado así, o si su nombre ya lo dice entre paréntesis (así se llaman desde el principio el cochinillo,
// el cabrito, el capón… y no hace falta tocar los productos ya guardados).
export function esPorEncargo(p) {
  return !!p && (p.porEncargo === true || /\(\s*por encargo\s*\)/i.test(p.nombre ?? ""));
}

// ¿Se puede añadir al pedido? Lo agotado no, salvo que sea por encargo.
export function sePuedePedir(p) {
  return !!p && (!p.agotado || esPorEncargo(p));
}
