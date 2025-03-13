// lib/filters.ts
import { Filtro } from "@/types/Filtro";

// Interfaz para los argumentos de la función getFilteredFilters
interface GetFilteredFiltersArgs {
  liters: number;
  filters: Filtro[];
}

// Función para filtrar los filtros que cumplen con los requisitos mínimos
export function getFilteredFilters({
  liters,
  filters,
}: GetFilteredFiltersArgs): Filtro[] {
  return filters.filter((filtro) => {
    // Excluimos filtros sin volumen de vaso o caudal definido
    if (!filtro.volumen_vaso_filtro || !filtro.caudal) {
      return false; // Si falta caudal o volumen, no lo incluimos
    }

    // El filtro debe mover al menos 10 veces el volumen del acuario
    if (filtro.caudal >= liters * 10) {
      return true; // Si cumple con el caudal, lo incluimos
    }
    return false; // Si no cumple, lo excluimos
  });
}

// Función para determinar el nivel de cumplimiento de un filtro
export function getFilterLevel(
  filtro: Filtro,
  liters: number,
): "recommended" | "minimum" | "insufficient" {
  // 1. Verificamos si el filtro tiene caudal y volumen definidos
  if (!filtro.caudal || !filtro.volumen_vaso_filtro) {
    return "insufficient"; // Si falta alguno, no cumple
  }

  // 2. Verificamos el caudal: debe ser al menos 10 veces el volumen del acuario
  const requiredFlow = liters * 10;
  if (filtro.caudal < requiredFlow) {
    return "insufficient"; // Si no cumple el caudal mínimo
  }

  // 3. Volumen útil del vaso del filtro: tomamos el 90% del volumen del vaso
  const usefulFilterVolume = filtro.volumen_vaso_filtro * 0.9;

  // 4. Definimos los requisitos de volumen del vaso
  const recommendedVolume = liters * 0.05; // 5% del volumen del acuario
  const minimumVolume = liters * 0.025; // 2.5% del volumen del acuario

  // 5. Clasificación del filtro según su volumen útil
  if (usefulFilterVolume >= recommendedVolume) {
    return "recommended"; // Cumple con el caudal y volumen recomendado
  } else if (usefulFilterVolume >= minimumVolume) {
    return "minimum"; // Cumple con el caudal y volumen mínimo
  } else {
    return "insufficient"; // Cumple con el caudal, pero no con el volumen mínimo
  }
}

// Función para calcular una "puntuación" del filtro basada en caudal y volumen del vaso
export function calculateFilterScore(filtro: Filtro): number {
  // Calculamos la puntuación dando mayor peso al caudal que al volumen del vaso
  return filtro.caudal * 10 + (filtro.volumen_vaso_filtro || 0);
}

// Función para generar combinaciones de filtros del mismo modelo
export function generateFilterCombinations(
  filters: Filtro[],
  liters: number,
): { combination: Filtro[] }[] {
  const combinations: { combination: Filtro[] }[] = [];

  // Recorremos todos los filtros disponibles
  for (let i = 0; i < filters.length; i++) {
    const filter1 = filters[i];

    // Comprobamos si el filtro individual cumple con los requisitos mínimos
    if (getFilterLevel(filter1, liters) !== "insufficient") {

      // Buscamos un segundo filtro del mismo modelo
      for (let j = i + 1; j < filters.length; j++) { // Empezamos desde el siguiente filtro
        if (filters[j].modelo === filter1.modelo) {
          const filter2 = filters[j];
          combinations.push({ combination: [filter1, filter2] }); // Añadimos la combinación
        }
      }
    }
  }

  return combinations; // Retornamos todas las combinaciones generadas
}