import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Versión (de package.json) y fecha (del momento del build) del pie de página:
// salen de aquí para que nunca queden desfasadas respecto a lo desplegado.
const buildDate = new Date().toLocaleDateString("es-ES", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sitio 100 % estático: `npm run build` genera la carpeta `out/` lista para
  // subir tal cual a Netlify (o a cualquier hosting estático).
  output: "export",
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
};

export default nextConfig;
