// Utilidades HTTP comunes a todas las funciones.

export const CABECERAS_SEGURIDAD = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export function json(estado, cuerpo, extra = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CABECERAS_SEGURIDAD, ...extra },
  });
}

export function error(estado, mensaje, extra) {
  return json(estado, { ok: false, errores: [{ campo: "", mensaje }] }, extra);
}

// Lee el cuerpo JSON con un límite de tamaño real (no solo el de la cabecera).
export async function leerJson(req, maxBytes = 64 * 1024) {
  const largo = Number(req.headers.get("content-length"));
  if (Number.isFinite(largo) && largo > maxBytes) throw new ErrorHttp(413, "Petición demasiado grande.");
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > maxBytes) throw new ErrorHttp(413, "Petición demasiado grande.");
  if (!buf.length) throw new ErrorHttp(400, "Falta el cuerpo de la petición.");
  try { return JSON.parse(new TextDecoder().decode(buf)); } catch { throw new ErrorHttp(400, "JSON no válido."); }
}

export async function leerBytes(req, maxBytes) {
  const largo = Number(req.headers.get("content-length"));
  if (Number.isFinite(largo) && largo > maxBytes) throw new ErrorHttp(413, "Archivo demasiado grande.");
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > maxBytes) throw new ErrorHttp(413, "Archivo demasiado grande.");
  return buf;
}

export class ErrorHttp extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}

export function esHttps(req) {
  try { return new URL(req.url).protocol === "https:"; } catch { return false; }
}

// Tipo de imagen por sus primeros bytes (no se fía de la cabecera Content-Type).
export function tipoImagen(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

// Medidas de la imagen leídas de su cabecera (sin decodificarla). null si no se pueden leer.
export function dimensionesImagen(b, tipo = tipoImagen(b)) {
  const u16 = (i) => (b[i] << 8) | b[i + 1];
  const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const ok = (ancho, alto) => (ancho > 0 && alto > 0 ? { ancho, alto } : null);
  if (tipo === "image/png") return b.length >= 24 && String.fromCharCode(b[12], b[13], b[14], b[15]) === "IHDR" ? ok(u32(16), u32(20)) : null;
  if (tipo === "image/jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; } // relleno
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; } // marcadores sin longitud
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return ok(u16(i + 7), u16(i + 5)); // SOFn: alto, ancho
      const largo = u16(i + 2);
      if (largo < 2) return null;
      i += 2 + largo;
    }
    return null;
  }
  if (tipo === "image/webp") {
    const trozo = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (trozo === "VP8 " && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return ok((b[26] | (b[27] << 8)) & 0x3fff, (b[28] | (b[29] << 8)) & 0x3fff);
    if (trozo === "VP8L" && b.length >= 25 && b[20] === 0x2f) { const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0; return ok(1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)); }
    if (trozo === "VP8X" && b.length >= 30) return ok(1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16)));
  }
  return null;
}

// Límites de las fotos de producto (el panel las normaliza al subirlas; el servidor lo comprueba otra vez).
export const FOTO_LADO_MINIMO = 400;
export const FOTO_LADO_MAXIMO = 1600;
