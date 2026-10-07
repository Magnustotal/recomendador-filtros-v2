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
