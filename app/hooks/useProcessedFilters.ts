"use client";

import { useMemo } from 'react';
import { Filtro } from "@/types/Filtro";
import { getFilterLevel } from "@/lib/filters";

// --- TIPOS ---
export interface ExtendedFiltro extends Filtro {
  web_oficial?: string;
  isPair?: boolean;
  baseCaudal?: number;
  baseVolumenVaso?: number;
}

// --- LÓGICA DE PROCESAMIENTO (Funciones Puras) ---
const buildPairedFilters = (filters: ExtendedFiltro[]): ExtendedFiltro[] => {
  return filters
    .filter(f => f.caudal && f.volumen_vaso_filtro)
    .map(f => ({
      ...f,
      isPair: true,
      baseCaudal: f.caudal,
      baseVolumenVaso: f.volumen_vaso_filtro,
      modelo: `${f.modelo} (×2)`,
      caudal: f.caudal! * 2,
      volumen_vaso_filtro: f.volumen_vaso_filtro! * 2,
      consumo: f.consumo ? f.consumo * 2 : null,
      volumen_prefiltro: f.volumen_prefiltro ? f.volumen_prefiltro * 2 : null,
      volumen_vaso_real: f.volumen_vaso_real ? f.volumen_vaso_real * 2 : null,
    }));
};

const dedupeAndSortFilters = (filters: ExtendedFiltro[], sortBy: string): ExtendedFiltro[] => {
  const seen = new Set<string>();
  const uniqueFilters = filters.filter(f => {
    const key = `${f.marca}---${f.modelo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...uniqueFilters].sort((a, b) => {
    switch (sortBy) {
      case "caudal": return (a.caudal ?? 0) - (b.caudal ?? 0);
      case "volumen": return (a.volumen_vaso_filtro ?? 0) - (b.volumen_vaso_filtro ?? 0);
      case "marca": return (a.marca ?? "").localeCompare(b.marca ?? "");
      case "modelo": return (a.modelo ?? "").localeCompare(b.modelo ?? "");
      default: return 0;
    }
  });
};

// --- EL HOOK PRINCIPAL ---
export const useProcessedFilters = (allRawFilters: Filtro[], liters: number, sortBy: string) => {
  // Memoiza los filtros base válidos
  const validFilters = useMemo(() =>
    allRawFilters.filter(f => f.caudal != null && f.volumen_vaso_filtro != null && f.marca && f.modelo) as ExtendedFiltro[],
    [allRawFilters]
  );

  // Memoiza la lista combinada de filtros individuales y pares
  const combinedFilters = useMemo(() => {
    const paired = buildPairedFilters(validFilters);
    return dedupeAndSortFilters([...validFilters, ...paired], sortBy);
  }, [validFilters, sortBy]);
  
  // Separa en recomendados y mínimos
  const { recommended, minimum } = useMemo(() => {
    const recommended: ExtendedFiltro[] = [];
    const minimum: ExtendedFiltro[] = [];
    combinedFilters.forEach(f => {
      const level = getFilterLevel(f, liters);
      if (level === "recommended") recommended.push(f);
      else if (level === "minimum") minimum.push(f);
    });
    return { recommended, minimum };
  }, [combinedFilters, liters]);

  // Separa por tipo (individual/par)
  const recommendedIndividual = useMemo(() => recommended.filter(f => !f.isPair), [recommended]);
  const recommendedPairs = useMemo(() => recommended.filter(f => f.isPair), [recommended]);
  const minimumIndividual = useMemo(() => minimum.filter(f => !f.isPair), [minimum]);
  const minimumPairs = useMemo(() => minimum.filter(f => f.isPair), [minimum]);

  // Calcula estadísticas generales
  const stats = useMemo(() => {
    const totalFiltros = validFilters.length;
    if (totalFiltros === 0) return null;

    const marcasCount = validFilters.reduce((acc, f) => {
        acc.set(f.marca, (acc.get(f.marca) || 0) + 1);
        return acc;
    }, new Map<string, number>());
    
    const marcaLider = [...marcasCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    return {
        totalFiltros,
        uniqueMarcas: marcasCount.size,
        marcaLider,
    };
  }, [validFilters]);

  return {
    recommended: {
        individual: recommendedIndividual,
        pairs: recommendedPairs,
        total: recommended.length,
    },
    minimum: {
        individual: minimumIndividual,
        pairs: minimumPairs,
        total: minimum.length,
    },
    stats,
    hasResults: recommended.length > 0 || minimum.length > 0,
  };
};