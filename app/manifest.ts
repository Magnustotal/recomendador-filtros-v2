import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recomendador de Filtros para Acuarios",
    short_name: "Filtros",
    description:
      "Calcula el mejor filtro para tu acuario según volumen, caudal y eficiencia.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#2A81F7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
