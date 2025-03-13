// types/Filtro.ts

export interface Filtro {
  id: number;
  marca: string;
  modelo: string;
  caudal: number; // l/h
  volumen_vaso_filtro: number; // litros
  volumen_prefiltro: number | null; // litros
  volumen_vaso_real: number | null; // litros
  cestas: number | null;
  consumo: number; // vatios (W)
  asin: string | null; // código Amazon, puede ser null si no hay enlace
}
