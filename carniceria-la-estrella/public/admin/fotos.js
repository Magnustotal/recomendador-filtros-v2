// Prepara una foto subida desde el móvil u ordenador, sea cual sea su tamaño:
//  - solo se admiten JPG, PNG y WebP (lo demás se rechaza antes de subir nada);
//  - se reduce a un máximo de 1000 px por el lado largo y se amplía hasta un mínimo de 400 px
//    (por debajo de 120 px no hay foto aprovechable y se rechaza);
//  - se recomprime siempre como JPEG de menos de 680 KB, lo que además elimina los datos ocultos
//    de la foto (ubicación GPS, modelo del móvil…) y corrige la orientación.
// El servidor vuelve a comprobar tipo, peso y medidas: esto es la comodidad, no la seguridad.
export const TIPOS_ADMITIDOS = ["image/jpeg", "image/png", "image/webp"];
export const LADO_MAXIMO = 1000;
export const LADO_MINIMO = 400;
export const LADO_INUTIL = 120;
export const PESO_MAXIMO = 680 * 1024;
export const PESO_ORIGINAL_MAXIMO = 25 * 1024 * 1024;

const EXTENSIONES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function tipoDeArchivo(archivo) {
  if (TIPOS_ADMITIDOS.includes(archivo.type)) return archivo.type;
  if (!archivo.type) return EXTENSIONES[archivo.name?.split(".").pop()?.toLowerCase()] ?? null; // algunos navegadores no informan del tipo
  return null;
}

// Lado largo final: dentro de [mínimo, máximo]. Devuelve el factor de escala a aplicar.
export function escalaFinal(ancho, alto, maximo = LADO_MAXIMO, minimo = LADO_MINIMO) {
  const largo = Math.max(ancho, alto);
  if (largo > maximo) return maximo / largo;
  if (largo < minimo) return minimo / largo;
  return 1;
}

async function abrirImagen(archivo) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(archivo, { imageOrientation: "from-image" }); } catch { /* se prueba con <img> */ }
  }
  const url = URL.createObjectURL(archivo);
  try {
    return await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error("imagen")); i.src = url; });
  } finally { URL.revokeObjectURL(url); }
}

export async function prepararFoto(archivo) {
  if (!tipoDeArchivo(archivo)) throw new Error("Solo se admiten fotos JPG, PNG o WebP. Si es una foto del móvil en otro formato (por ejemplo HEIC), hazla de nuevo en formato JPG o haz una captura.");
  if (archivo.size > PESO_ORIGINAL_MAXIMO) throw new Error(`La foto pesa ${(archivo.size / 1048576).toFixed(0)} MB y el máximo para subirla es 25 MB.`);
  let img;
  try { img = await abrirImagen(archivo); } catch { throw new Error("No se ha podido leer esa imagen. Prueba con otra foto."); }
  const origen = { ancho: img.width, alto: img.height, bytes: archivo.size };
  if (Math.max(img.width, img.height) < LADO_INUTIL) throw new Error(`La foto es demasiado pequeña (${img.width}×${img.height} px): no se vería bien. Usa una de al menos ${LADO_MINIMO} px por el lado largo.`);

  let factor = escalaFinal(img.width, img.height);
  for (let intento = 0; intento < 5; intento++) {
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(img.width * factor));
    lienzo.height = Math.max(1, Math.round(img.height * factor));
    const c = lienzo.getContext("2d");
    c.imageSmoothingQuality = "high";
    c.fillStyle = "#fff"; // los PNG con transparencia se quedan sobre blanco
    c.fillRect(0, 0, lienzo.width, lienzo.height);
    c.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    for (let calidad = 0.85; calidad >= 0.45; calidad -= 0.1) {
      const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
      if (blob && blob.size <= PESO_MAXIMO) {
        return { blob, ancho: lienzo.width, alto: lienzo.height, origen, ampliada: factor > 1, reducida: factor < 1 };
      }
    }
    // Demasiado pesada: se baja la resolución, pero nunca por debajo del mínimo
    const largoActual = Math.max(lienzo.width, lienzo.height);
    if (largoActual <= LADO_MINIMO) break;
    factor = Math.max(LADO_MINIMO / Math.max(img.width, img.height), factor * 0.8);
  }
  throw new Error("La foto es demasiado pesada incluso reducida al mínimo. Prueba con otra.");
}

export const pesoLegible = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
