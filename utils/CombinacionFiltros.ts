// utils/combinarFiltros.ts
import { Filtro } from "@/types/Filtro";

// Combina un array de filtros en uno solo
export function combinarFiltros(filtros: Filtro[]): Filtro {
  return {
    id: Date.now(), // Genera un ID único para la combinación
    marca: "Combinación", // O alguna marca que indique que es una combinación
    modelo: filtros.map(f => f.modelo).join(" + "), // Combina los modelos
    caudal: filtros.reduce((sum, f) => sum + f.caudal, 0), // Suma el caudal
    volumen_vaso_filtro: filtros.reduce((sum, f) => sum + f.volumen_vaso_filtro, 0), // Suma el volumen vaso filtro
    volumen_prefiltro: null, // O lo que consideres
    volumen_vaso_real: filtros.reduce((sum, f) => sum + (f.volumen_vaso_real || 0), 0), // Suma el volumen real (si es que lo tienes)
    cestas: null, // O lo que consideres
    consumo: filtros.reduce((sum, f) => sum + f.consumo, 0), // Suma el consumo
    asin: null, // Si lo quieres dejar en null, o si se puede combinar de alguna manera, hazlo
  };
}