// Sirve las páginas con los datos del panel (SEO, horario, mapa) y sitemap/robots.
import { renderizarPagina, cspParaHtml, base, infoWeb } from "./render.mjs";
import { CABECERAS_SEGURIDAD } from "./http.mjs";
import { ahoraEnMadrid } from "./horario.mjs";

const PAGINAS = {
  "/": "index.html",
  "/tienda": "tienda.html",
  "/tienda.html": "tienda.html",
  "/privacidad.html": "privacidad.html",
  "/aviso-legal.html": "aviso-legal.html",
};

const CACHE = { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": "public, durable, max-age=300, stale-while-revalidate=86400", "Netlify-Cache-Tag": "paginas" };

export async function pagina(req, deps) {
  const url = new URL(req.url);
  const ruta = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : "/";
  let ajustes;
  try { ajustes = await deps.almacen.leerAjustes(); } catch (e) { console.error("No se pudieron leer los ajustes; se usan los de por defecto:", e); ajustes = deps.ajustesPorDefecto; }
  const origen = url.origin;
  let meta = null;
  try { meta = await deps.almacen.leerMeta(); } catch { /* sin fecha de cambios: se usa la de publicación */ }

  if (ruta === "/sitemap.xml") {
    const dominio = base(ajustes, origen);
    const hoy = ahoraEnMadrid(new Date(deps.ahora())).fecha;
    const paginas = ["/", ...(ajustes.tienda.activa ? ["/tienda"] : [])];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paginas.map((p) => `  <url>\n    <loc>${dominio}${p}</loc>\n    <lastmod>${infoWeb(meta).actualizadaISO}</lastmod>\n  </url>`).join("\n")}\n</urlset>\n`;
    return new Response(xml, { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8", ...CACHE } });
  }
  if (ruta === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${base(ajustes, origen)}/sitemap.xml\n`, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...CACHE } });
  }

  const plantilla = PAGINAS[ruta];
  if (!plantilla) return new Response("No encontrado", { status: 404 });
  const html = renderizarPagina(plantilla, ajustes, { origen, ahora: new Date(deps.ahora()), meta });
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": cspParaHtml(html), ...CABECERAS_SEGURIDAD, ...CACHE },
  });
}
