/**
 * Marcas cuyo logo existe en `public/logos/<clave>.png`.
 * Para activar el logo de una marca: copia el archivo a `public/logos/` y
 * añade aquí su clave (nombre en minúsculas y con guiones, p. ej. "eheim").
 * Mientras una marca no esté en la lista no se pide ninguna imagen (evita 404).
 */
const BRANDS_WITH_LOGO: readonly string[] = [];

/** Ruta del logo de una marca, o cadena vacía si no hay logo disponible. */
export function getBrandLogo(brandName: string): string {
  const key = brandName.toLowerCase().replace(/\s+/g, "-");
  return BRANDS_WITH_LOGO.includes(key) ? `/logos/${key}.png` : "";
}
