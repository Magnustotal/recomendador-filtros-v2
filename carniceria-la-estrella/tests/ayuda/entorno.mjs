// Entorno de pruebas de navegador: servidor local completo (web + funciones + blobs) con reloj fijo
// y la tienda activada mediante la propia API del panel (así se prueba también el panel).
import { createRequire } from "node:module";
import { arrancar } from "../../scripts/dev-local.mjs";

const require = createRequire(import.meta.url);
export const AHORA = "2026-10-05T07:00:00Z"; // lunes 09:00 en Madrid
export const PASSWORD = "clave-local-de-prueba";

export async function arrancarEntorno({ activarTienda = true, modificar = null, precios = true } = {}) {
  process.env.ADMIN_PASSWORD = PASSWORD;
  process.env.SESSION_SECRET = "s".repeat(48);
  process.env.DEV_AHORA = AHORA;
  const srv = await arrancar({ puerto: 0 });
  const api = clienteAdmin(srv.url);
  await api.entrar();
  if (activarTienda) await prepararTienda(api, { modificar, precios });
  const { chromium } = require("playwright-core");
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox"] });
  return {
    url: srv.url, api, navegador,
    async nuevaPagina({ ancho = 390, alto = 800, tactil = true, reloj = true, reducido = false } = {}) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, hasTouch: tactil, serviceWorkers: "block", locale: "es-ES", timezoneId: "Europe/Madrid", reducedMotion: reducido ? "reduce" : "no-preference" });
      const page = await ctx.newPage();
      if (reloj) await page.clock.setFixedTime(new Date(AHORA));
      const consola = [];
      page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consola.push(`${m.type()}: ${m.text()}`); });
      page.on("pageerror", (e) => consola.push(`pageerror: ${e.message}`));
      page.consola = consola;
      return page;
    },
    async parar() { await navegador.close(); await srv.parar(); },
  };
}

export function clienteAdmin(base) {
  let cookie = "";
  const llamar = async (ruta, { metodo = "GET", cuerpo } = {}) => {
    const h = { cookie };
    if (metodo !== "GET") { h.origin = base; h["x-requested-with"] = "ls-panel"; }
    if (cuerpo !== undefined) h["content-type"] = "application/json";
    const r = await fetch(`${base}/api/admin${ruta}`, { method: metodo, headers: h, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
    const texto = await r.text();
    let datos; try { datos = JSON.parse(texto); } catch { datos = texto; }
    return { estado: r.status, datos, cabeceras: r.headers };
  };
  return {
    llamar,
    async entrar() {
      const r = await fetch(`${base}/api/admin/login`, { method: "POST", headers: { origin: base, "x-requested-with": "ls-panel", "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) });
      if (r.status !== 200) throw new Error(`login ${r.status}`);
      cookie = r.headers.get("set-cookie").split(";")[0];
    },
  };
}

async function prepararTienda(api, { modificar, precios }) {
  const { datos } = await api.llamar("/datos");
  const a = structuredClone(datos.ajustes);
  a.tienda.activa = true;
  a.tienda.reparto.zona = "La Barzola, Los Príncipes y alrededores";
  a.tienda.reparto.coste = 3;
  a.tienda.reparto.gratisDesde = 40;
  a.tienda.reparto.minimo = 15;
  modificar?.(a);
  const r = await api.llamar("/ajustes", { metodo: "PUT", cuerpo: a });
  if (r.estado !== 200) throw new Error("ajustes: " + JSON.stringify(r.datos));
  if (!precios) return;
  const poner = { "vacuno-solomillo-de-ternera": 29.9, "vacuno-lomo-alto-de-ternera": 16.5 };
  for (const p of datos.productos) {
    if (p.id in poner || p.categoria === "pollo") {
      const rr = await api.llamar("/producto", { metodo: "PUT", cuerpo: { ...p, precio: poner[p.id] ?? 6.5 } });
      if (rr.estado !== 200) throw new Error("producto " + p.id + ": " + JSON.stringify(rr.datos));
    }
  }
}

// Ejecuta `fn` con el reloj del servidor local en otra fecha (el servidor corre en este mismo proceso). Sirve para dejar precios
// «de siempre» en el historial: un precio puesto hoy cuenta como primer precio del producto, y entonces una rebaja que empieza hoy
// no sería una rebaja (no hay precio anterior en los 30 días previos).
export async function enFecha(fechaISO, fn) {
  const real = Date.now;
  Date.now = () => Date.parse(`${fechaISO}T07:00:00Z`);
  try { return await fn(); } finally { Date.now = real; }
}
