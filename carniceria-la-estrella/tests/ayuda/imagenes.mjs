// Cabeceras de imagen sintéticas (solo lo que hace falta para leer tipo y medidas).
const u16 = (n) => [(n >> 8) & 255, n & 255];
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const texto = (t) => [...t].map((c) => c.charCodeAt(0));

export function jpegCon(ancho, alto, { relleno = 0 } = {}) {
  const sof = [0xff, 0xc0, ...u16(17), 8, ...u16(alto), ...u16(ancho), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const app0 = [0xff, 0xe0, ...u16(16), ...texto("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]; // un segmento anterior que hay que saltar
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, ...new Array(relleno).fill(0), 0xff, 0xd9]);
}

export function pngCon(ancho, alto) {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...u32(13), ...texto("IHDR"), ...u32(ancho), ...u32(alto), 8, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44]);
}

const riff = (cuerpo) => new Uint8Array([...texto("RIFF"), ...u32(cuerpo.length + 4), ...texto("WEBP"), ...cuerpo]);
export function webpLossy(ancho, alto) {
  return riff([...texto("VP8 "), ...u32(10), 0, 0, 0, 0x9d, 0x01, 0x2a, ancho & 255, (ancho >> 8) & 0x3f, alto & 255, (alto >> 8) & 0x3f]);
}
export function webpLossless(ancho, alto) {
  const bits = ((ancho - 1) & 0x3fff) | (((alto - 1) & 0x3fff) << 14);
  return riff([...texto("VP8L"), ...u32(5), 0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]);
}
export function webpExtendido(ancho, alto) {
  const a = ancho - 1, h = alto - 1;
  return riff([...texto("VP8X"), ...u32(10), 0, 0, 0, 0, a & 255, (a >> 8) & 255, (a >> 16) & 255, h & 255, (h >> 8) & 255, (h >> 16) & 255]);
}
