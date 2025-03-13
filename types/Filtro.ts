// types/Filtro.ts
export interface Filtro {
  id: number;
  marca: string;
  modelo: string;
  caudal: number;
  volumen_vaso_filtro: number;
  volumen_prefiltro: number | null;
  volumen_vaso_real: number | null;
  cestas: number | null;
  consumo: number;
  asin: string | null;
}