// Prepara una foto subida desde el móvil u ordenador: la reduce y la recomprime como JPEG para que
// pese poco (el servidor admite hasta 700 KB) y cargue rápido en la tienda.
const LADO_MAXIMO = 900;
const PESO_MAXIMO = 680 * 1024;

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
  if (!archivo.type.startsWith("image/")) throw new Error("Elige un archivo de imagen (JPG, PNG o WebP).");
  let img;
  try { img = await abrirImagen(archivo); } catch { throw new Error("No se ha podido leer esa imagen. Prueba con otra foto."); }
  let lado = LADO_MAXIMO;
  for (let intento = 0; intento < 4; intento++) {
    const escala = Math.min(1, lado / Math.max(img.width, img.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(img.width * escala));
    lienzo.height = Math.max(1, Math.round(img.height * escala));
    const c = lienzo.getContext("2d");
    c.fillStyle = "#fff"; // los PNG con transparencia se quedan sobre blanco
    c.fillRect(0, 0, lienzo.width, lienzo.height);
    c.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    for (let calidad = 0.85; calidad >= 0.5; calidad -= 0.1) {
      const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
      if (blob && blob.size <= PESO_MAXIMO) return blob;
    }
    lado = Math.round(lado * 0.75);
  }
  throw new Error("La foto es demasiado pesada incluso reducida. Prueba con otra.");
}
