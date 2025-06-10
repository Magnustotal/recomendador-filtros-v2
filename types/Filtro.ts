// types/Filtro.ts
export interface Filtro {
  marca: string;
  modelo: string;
  caudal: number;
  volumen_vaso_filtro?: number | null;
  volumen_prefiltro?: number | null;
  volumen_vaso_real?: number | null;
  cestas?: number | null;
  consumo: number;
  otras_caracteristicas?: string;
  enlace_amazon?: string;
}
