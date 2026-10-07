import { pagina } from "../../lib/api-pagina.mjs";
import { dependencias } from "../../lib/dependencias.mjs";

export default async (req, context) => pagina(req, dependencias(context));

export const config = { path: ["/", "/tienda", "/tienda.html", "/privacidad.html", "/aviso-legal.html", "/sitemap.xml", "/robots.txt"], method: ["GET", "HEAD"] };
