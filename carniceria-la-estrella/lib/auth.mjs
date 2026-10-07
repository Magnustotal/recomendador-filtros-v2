// Sesión del panel: una contraseña (variable de entorno ADMIN_PASSWORD) y una cookie firmada.
import { createHmac, createHash, timingSafeEqual, randomBytes } from "node:crypto";

export const NOMBRE_COOKIE = "ls_panel";
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;
export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

const b64 = (buf) => Buffer.from(buf).toString("base64url");

export function configuracionAuth(env = process.env) {
  const password = env.ADMIN_PASSWORD ?? "";
  const secreto = env.SESSION_SECRET ?? "";
  const problemas = [];
  if (password.length < 10) problemas.push("ADMIN_PASSWORD debe tener al menos 10 caracteres.");
  if (secreto.length < 32) problemas.push("SESSION_SECRET debe tener al menos 32 caracteres.");
  return { password, secreto, ok: problemas.length === 0, problemas };
}

export function compararPassword(entrada, esperado) {
  if (typeof entrada !== "string" || !esperado) return false;
  const a = createHash("sha256").update(entrada).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

function firmar(datos, secreto) {
  return b64(createHmac("sha256", secreto).update(datos).digest());
}

export function crearSesion(secreto, ahoraMs = Date.now(), duracion = DURACION_SESION_MS) {
  const payload = b64(JSON.stringify({ exp: ahoraMs + duracion, n: b64(randomBytes(8)) }));
  return `${payload}.${firmar(payload, secreto)}`;
}

export function verificarSesion(token, secreto, ahoraMs = Date.now()) {
  if (typeof token !== "string" || !secreto) return false;
  const i = token.indexOf(".");
  if (i < 1) return false;
  const payload = token.slice(0, i), firma = token.slice(i + 1);
  const esperada = firmar(payload, secreto);
  const x = Buffer.from(firma), y = Buffer.from(esperada);
  if (x.length !== y.length || !timingSafeEqual(x, y)) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > ahoraMs; } catch { return false; }
}

export function leerCookie(cabecera, nombre) {
  if (!cabecera) return null;
  for (const trozo of cabecera.split(";")) {
    const [k, ...v] = trozo.trim().split("=");
    if (k === nombre) return v.join("=");
  }
  return null;
}

export function cookieSesion(token, { seguro }) {
  return `${NOMBRE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACION_SESION_MS / 1000}${seguro ? "; Secure" : ""}`;
}
export function cookieBorrar({ seguro }) {
  return `${NOMBRE_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${seguro ? "; Secure" : ""}`;
}

// Protección frente a CSRF en peticiones que cambian datos: mismo origen y cabecera propia.
export function peticionDeMismoOrigen(req) {
  const origen = req.headers.get("origin");
  if (!origen) return false;
  if (req.headers.get("x-requested-with") !== "ls-panel") return false;
  try { return new URL(origen).origin === new URL(req.url).origin; } catch { return false; }
}

// Limitación de intentos de acceso: estado = { n, desde, hasta } por huella de IP.
export function evaluarIntentos(estado, ahoraMs) {
  if (estado?.hasta && estado.hasta > ahoraMs) return { bloqueado: true, segundos: Math.ceil((estado.hasta - ahoraMs) / 1000) };
  return { bloqueado: false };
}
export function registrarFallo(estado, ahoraMs) {
  const n = estado && ahoraMs - estado.desde < BLOQUEO_MS ? estado.n + 1 : 1;
  const desde = estado && ahoraMs - estado.desde < BLOQUEO_MS ? estado.desde : ahoraMs;
  return n >= MAX_INTENTOS ? { n, desde, hasta: ahoraMs + BLOQUEO_MS } : { n, desde };
}
export function huellaIp(ip) {
  return createHash("sha256").update(String(ip ?? "desconocida")).digest("hex").slice(0, 32);
}
