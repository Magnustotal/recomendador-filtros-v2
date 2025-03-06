// lib/filters.ts
import { Filtro } from "@/types/Filtro";

interface GetFilteredFiltersArgs {
  liters: number;
  filters: Filtro[];
}

export function getFilteredFilters({
  liters,
  filters,
}: GetFilteredFiltersArgs): Filtro[] {
  return filters.filter((filtro) => {
    // Excluimos filtros sin volumen de vaso definido
    if (!filtro.volumen_vaso_filtro) {
      return false;
    }
    // Filtramos por caudal: El filtro debe mover al menos 10 veces el volumen del acuario
    if (filtro.caudal >= liters * 10) {
      return true;
    }
    return false;
  });
}

export function getFilterLevel(
  filtro: Filtro,
  liters: number,
): "recommended" | "minimum" | "insufficient" {

  // 1. Comprobar si el filtro tiene caudal y volumen del vaso definidos
  if (!filtro.caudal || !filtro.volumen_vaso_filtro) {
    return "insufficient"; // Si falta alguno, es insuficiente
  }

  // 2. Requisito de caudal (igual para ambos niveles: 10 veces el volumen del acuario)
  const requiredFlow = liters * 10;
  if (filtro.caudal < requiredFlow) {
    return "insufficient";  // No cumple el caudal mínimo
  }

  // 3. Volumen útil del vaso del filtro (90%)
  const usefulFilterVolume = filtro.volumen_vaso_filtro * 0.9;

  // 4. Requisitos de volumen del vaso
  const recommendedVolume = liters * 0.05; // 5% del volumen del acuario
  const minimumVolume = liters * 0.025;    // 2.5% del volumen del acuario

  // 5. Clasificación
  if (usefulFilterVolume >= recommendedVolume) {
    return "recommended";
  } else if (usefulFilterVolume >= minimumVolume) {
    return "minimum";
  } else {
    return "insufficient";
  }
}
// Función para calcular una "puntuación"  basada en el caudal y volumen del filtro.
export function calculateFilterScore(filtro: Filtro): number {
    return filtro.caudal * 10 + filtro.volumen_vaso_filtro;
}