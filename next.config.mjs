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
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
};

export default nextConfig;
