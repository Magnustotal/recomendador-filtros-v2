import { catalogo, foto } from "../../lib/api-publica.mjs";
import { dependencias } from "../../lib/dependencias.mjs";

export default async (req, context) => {
  const url = new URL(req.url);
  const deps = dependencias(context);
  if (url.pathname.startsWith("/api/foto/")) return foto(url.pathname.slice("/api/foto/".length), deps);
  return catalogo(deps);
};

export const config = { path: ["/api/catalogo", "/api/foto/*"], method: ["GET", "HEAD"] };
