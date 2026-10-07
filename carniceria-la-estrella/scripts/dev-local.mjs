// Servidor local para probar la web, la tienda y el panel SIN Netlify.
//   node scripts/dev-local.mjs [--puerto 8888] [--datos ./.datos-locales]
// Reproduce lo importante de Netlify: archivos estáticos de public/ (con las cabeceras de
// netlify.toml, incluida la CSP), las rutas de las funciones (config.path/method) y los
// Blobs, con el servidor de Blobs de @netlify/blobs guardando en una carpeta.
// No reproduce: CDN/caché, rate limit, purgeCache ni el empaquetado con esbuild.
//
// Variables útiles: ADMIN_PASSWORD, SESSION_SECRET (hay valores de prueba), DEV_AHORA
// (fecha ISO para fijar el reloj en pruebas, p. ej. 2026-10-05T07:00:00Z).
import http from "node:http";
import { readFile, stat, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, normalize, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BlobsServer } from "@netlify/blobs/server";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml",
};

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : porDefecto;
}

// Lee las reglas [[headers]] de netlify.toml (formato simple: for + [headers.values]).
async function leerCabeceras() {
  const toml = await readFile(join(RAIZ, "netlify.toml"), "utf8");
  const reglas = [];
  for (const bloque of toml.split("[[headers]]").slice(1)) {
    const para = bloque.match(/for\s*=\s*"([^"]+)"/)?.[1];
    const valores = {};
    for (const m of bloque.matchAll(/^\s+([A-Za-z-]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/gm)) valores[m[1]] = m[2];
    if (para) reglas.push({ para, valores });
  }
  return reglas;
}
const casa = (patron, ruta) => (patron.endsWith("/*") ? ruta.startsWith(patron.slice(0, -1)) : patron === "/*" ? true : patron === ruta);

export async function arrancar({ puerto = 8888, datos } = {}) {
  const directorio = datos ?? (await mkdtemp(join(tmpdir(), "ls-datos-")));
  const token = "token-local";
  const blobs = new BlobsServer({ directory: directorio, token });
  const { port: pb } = await blobs.start();
  const url = `http://127.0.0.1:${pb}`;
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ apiURL: url, edgeURL: url, uncachedEdgeURL: url, token, siteID: "sitio-local" })).toString("base64");
  process.env.LS_SIN_PURGA = "1";
  process.env.ADMIN_PASSWORD ??= "clave-local-de-prueba";
  process.env.SESSION_SECRET ??= "s".repeat(48);
  if (process.env.DEV_AHORA) {
    const fijo = Date.parse(process.env.DEV_AHORA);
    const inicio = Date.now();
    Date.now = () => fijo + (Date.now.real() - inicio);
    Date.now.real = () => performance.timeOrigin + performance.now();
  }

  // Funciones
  const funciones = [];
  for (const nombre of ["pagina", "catalogo", "pedido", "admin"]) {
    const m = await import(pathToFileURL(join(RAIZ, "netlify/functions", `${nombre}.mjs`)).href);
    funciones.push({ manejar: m.default, rutas: [m.config.path].flat(), metodos: m.config.method ? [m.config.method].flat() : null });
  }
  const coincide = (f, ruta, metodo) => (!f.metodos || f.metodos.includes(metodo)) && f.rutas.some((p) => (p.endsWith("/*") ? ruta.startsWith(p.slice(0, -1)) : p === ruta));

  const cabeceras = await leerCabeceras();

  async function estatico(ruta) {
    if (ruta.endsWith("/")) ruta += "index.html";
    const archivo = normalize(join(RAIZ, "public", ruta));
    if (!archivo.startsWith(join(RAIZ, "public"))) return null;
    if (!existsSync(archivo) || !(await stat(archivo)).isFile()) return null;
    return { cuerpo: await readFile(archivo), tipo: TIPOS[extname(archivo)] ?? "application/octet-stream" };
  }

  const servidor = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, `http://${req.headers.host}`);
      const ruta = u.pathname;
      const metodo = req.method ?? "GET";
      const extra = {};
      for (const r of cabeceras) if (casa(r.para, ruta)) Object.assign(extra, r.valores);

      // 1) archivo estático (tiene prioridad, como en Netlify)
      if (metodo === "GET" || metodo === "HEAD") {
        const e = await estatico(ruta);
        if (e) {
          res.writeHead(200, { "Content-Type": e.tipo, ...extra });
          res.end(metodo === "HEAD" ? undefined : e.cuerpo);
          return;
        }
      }
      if (ruta === "/admin") { res.writeHead(301, { Location: "/admin/" }); res.end(); return; }

      // 2) función
      const f = funciones.find((x) => coincide(x, ruta, metodo));
      if (f) {
        const trozos = [];
        for await (const t of req) trozos.push(t);
        const cuerpo = Buffer.concat(trozos);
        const cab = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (v != null) cab.set(k, Array.isArray(v) ? v.join(", ") : v);
        const peticion = new Request(u, { method: metodo, headers: cab, body: metodo === "GET" || metodo === "HEAD" ? undefined : cuerpo });
        const r = await f.manejar(peticion, { ip: req.socket.remoteAddress ?? "local" });
        const salida = {};
        const cookies = r.headers.getSetCookie?.() ?? [];
        r.headers.forEach((v, k) => { if (k !== "set-cookie") salida[k] = v; });
        if (cookies.length) salida["set-cookie"] = cookies;
        res.writeHead(r.status, salida);
        res.end(metodo === "HEAD" ? undefined : Buffer.from(await r.arrayBuffer()));
        return;
      }

      // 3) 404 de Netlify (/* -> /404.html con estado 404)
      const nf = await estatico("/404.html");
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", ...extra });
      res.end(nf?.cuerpo ?? "No encontrado");
    } catch (e) {
      console.error(e);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Error interno");
    }
  });
  await new Promise((ok) => servidor.listen(puerto, "127.0.0.1", ok));
  const { port } = servidor.address();
  return {
    url: `http://127.0.0.1:${port}`,
    directorio,
    async parar() { await new Promise((ok) => servidor.close(ok)); await blobs.stop(); },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await arrancar({ puerto: Number(argumento("puerto", 8888)), datos: argumento("datos") });
  console.log(`Web local en ${s.url}  (panel: ${s.url}/admin/)  datos: ${s.directorio}`);
  console.log(`Contraseña del panel: ${process.env.ADMIN_PASSWORD}`);
}
