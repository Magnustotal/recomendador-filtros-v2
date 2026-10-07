// PNG de ruido a color (no se comprime): sirve para probar la reducción de fotos pesadas.
import { deflateSync, crc32 } from "node:zlib";
import { randomBytes } from "node:crypto";

function trozo(tipo, datos) {
  const cab = Buffer.alloc(8); cab.writeUInt32BE(datos.length, 0); cab.write(tipo, 4, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([cab.subarray(4), datos])) >>> 0, 0);
  return Buffer.concat([cab, datos, crc]);
}
export function pngRuido(ancho, alto) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 2;
  const filas = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) randomBytes(ancho * 3).copy(filas, y * (ancho * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", ihdr), trozo("IDAT", deflateSync(filas, { level: 1 })), trozo("IEND", Buffer.alloc(0))]);
}
