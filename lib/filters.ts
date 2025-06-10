// lib/filters.ts

import { Filtro } from "@/types/Filtro";

/**
 * Para cada filtro:
 *  - Si filtro.volumen_vaso_real es null, estimamos como 0.5382 × volumen_vaso_filtro.
 *  - Caudal mínimo y recomendado = 10 × litros_del_acuario.
 *  - Para volumen real (o estimado):
 *      • Mínimo: 0.9 × volumen_real ≥ 0.025 × litros_del_acuario
 *      • Recomendado: 0.9 × volumen_real ≥ 0.05 ×  litros_del_acuario
 *
 * Devuelve:
 *  - "recommended" si cumple ambos (caudal y volumen_real) para recomendado.
 *  - "minimum" si cumple ambos (caudal y volumen_real) para mínimo (pero no recomendado).
 *  - undefined en caso contrario.
 */
export function getFilterLevel(f: Filtro, litrosAcuario: number): "recommended" | "minimum" | undefined {
  // 1) Umbral de caudal (tanto mínimo como recomendado)
  const umbralCaudal = 10 * litrosAcuario; // 10 × volumen del acuario

  // No tiene caudal definido => no entra en ninguna categoría
  if (f.caudal == null) return undefined;

  // 2) Determinar volumen_real (si existe) o estimado
  let volumenReal: number;
  let isEstimado = false;

  if (f.volumen_vaso_real != null) {
    volumenReal = f.volumen_vaso_real;
  } else if (f.volumen_vaso_filtro != null) {
    // Estimación = 53.82 % del volumen_vaso_filtro
    volumenReal = f.volumen_vaso_filtro * 0.5382;
    isEstimado = true; // podríamos usar esta bandera si quisiéramos, pero aquí solo usamos el valor numérico
  } else {
    // Ni volumen_real ni volumen_vaso_filtro están definidos => no entra en ninguna categoría
    return undefined;
  }

  // 3) Calcular 90 % de volumen_real
  const noventaPorCiento = 0.9 * volumenReal;

  // 4) Umbrales sobre volumen_real:
  const umbralVolumenMin = 0.025 * litrosAcuario; // 2.5 %
  const umbralVolumenRec = 0.05 * litrosAcuario;  // 5 %

  // 5) Comprobar condiciones:
  const cumpleCaudal = f.caudal >= umbralCaudal;
  const cumpleVolumenMin = noventaPorCiento >= umbralVolumenMin;
  const cumpleVolumenRec = noventaPorCiento >= umbralVolumenRec;

  // Recomended si cumple caudal y volumen_recomendado
  if (cumpleCaudal && cumpleVolumenRec) {
    return "recommended";
  }

  // Minimum si no era recomendado, pero cumple caudal y volumen_mínimo
  if (cumpleCaudal && cumpleVolumenMin) {
    return "minimum";
  }

  return undefined;
}
