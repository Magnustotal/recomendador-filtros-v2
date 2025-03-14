// app/page.tsx
import type { Metadata } from "next";
import HomeContent from "./HomeContent";

export const metadata: Metadata = {
  title: "Recomendador de Filtros",
  description: "Encuentra el filtro perfecto para tu acuario",
  keywords: ["acuario", "filtro", "peces", "acuariofilia", "mantenimiento"],
  authors: "Javier B. V.",
};

export default function Home() {
  return <HomeContent />;
}