import { test } from "node:test";
import assert from "node:assert/strict";
import { configuracionAuth, compararPassword, crearSesion, verificarSesion, leerCookie, cookieSesion, peticionDeMismoOrigen, evaluarIntentos, registrarFallo, MAX_INTENTOS, BLOQUEO_MS } from "../lib/auth.mjs";

const SECRETO = "s".repeat(40);

test("la configuración exige contraseña y secreto largos", () => {
  assert.equal(configuracionAuth({ ADMIN_PASSWORD: "corta", SESSION_SECRET: "x" }).ok, false);
  assert.equal(configuracionAuth({ ADMIN_PASSWORD: "una-clave-larga", SESSION_SECRET: SECRETO }).ok, true);
  assert.equal(configuracionAuth({}).problemas.length, 2);
});

test("compararPassword es exacta y no acepta vacíos ni tipos raros", () => {
  assert.equal(compararPassword("abc123456789", "abc123456789"), true);
  assert.equal(compararPassword("abc123456780", "abc123456789"), false);
  assert.equal(compararPassword("", ""), false);
  assert.equal(compararPassword(undefined, "x"), false);
  assert.equal(compararPassword({ a: 1 }, "x"), false);
});

test("la sesión firmada se verifica y caduca", () => {
  const t = crearSesion(SECRETO, 1000, 5000);
  assert.equal(verificarSesion(t, SECRETO, 2000), true);
  assert.equal(verificarSesion(t, SECRETO, 6001), false);
  assert.equal(verificarSesion(t, "otro".repeat(10), 2000), false);
  const [p, f] = t.split(".");
  const manipulado = Buffer.from(JSON.stringify({ exp: 9e15 })).toString("base64url") + "." + f;
  assert.equal(verificarSesion(manipulado, SECRETO, 2000), false);
  assert.equal(verificarSesion("basura", SECRETO), false);
  assert.equal(verificarSesion(undefined, SECRETO), false);
});

test("cookies: se leen, y la de sesión es HttpOnly + SameSite=Strict (+ Secure en https)", () => {
  assert.equal(leerCookie("a=1; ls_panel=xyz; b=2", "ls_panel"), "xyz");
  assert.equal(leerCookie("a=1", "ls_panel"), null);
  const c = cookieSesion("tok", { seguro: true });
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/); assert.match(c, /Secure/);
  assert.doesNotMatch(cookieSesion("tok", { seguro: false }), /Secure/);
});

test("CSRF: solo mismo origen y con la cabecera del panel", () => {
  const req = (headers) => ({ url: "https://tienda.example/api/admin/x", headers: new Headers(headers) });
  assert.equal(peticionDeMismoOrigen(req({ origin: "https://tienda.example", "x-requested-with": "ls-panel" })), true);
  assert.equal(peticionDeMismoOrigen(req({ origin: "https://evil.example", "x-requested-with": "ls-panel" })), false);
  assert.equal(peticionDeMismoOrigen(req({ origin: "https://tienda.example" })), false);
  assert.equal(peticionDeMismoOrigen(req({ "x-requested-with": "ls-panel" })), false);
});

test("límite de intentos: bloquea tras 5 fallos y se libera después", () => {
  let e = null; const t0 = 1_000_000;
  for (let i = 0; i < MAX_INTENTOS - 1; i++) { e = registrarFallo(e, t0 + i); assert.equal(evaluarIntentos(e, t0 + i).bloqueado, false); }
  e = registrarFallo(e, t0 + 10);
  assert.equal(evaluarIntentos(e, t0 + 11).bloqueado, true);
  assert.equal(evaluarIntentos(e, t0 + 10 + BLOQUEO_MS + 1).bloqueado, false);
});
