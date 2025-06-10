/**
 * Devuelve la ruta a la imagen del logo de una marca.
 * NOTA: Debes tener estas imágenes en tu carpeta `public/logos/`.
 * El nombre del archivo debe coincidir con la clave en minúsculas (ej. 'eheim.png').
 * @param brandName - El nombre de la marca (ej. "EHEIM", "Fluval").
 * @returns La ruta a la imagen del logo o una cadena vacía si no se encuentra.
 */
export function getBrandLogo(brandName: string): string {
  // Normaliza el nombre de la marca a minúsculas y sin espacios para usarlo como clave
  const formattedBrand = brandName.toLowerCase().replace(/\s+/g, '-');
  
  // Mapeo completo de marcas a rutas de logos basado en tu lista
  const logoMap: { [key: string]: string } = {
    'ada': '/logos/ada.png',
    'aquael': '/logos/aquael.png',
    'atman': '/logos/atman.png',
    'blau': '/logos/blau.png',
    'boyu': '/logos/boyu.png',
    'dennerle': '/logos/dennerle.png',
    'eheim': '/logos/eheim.png',
    'fluval': '/logos/fluval.png',
    'hydor': '/logos/hydor.png',
    'hydra': '/logos/hydra.png',
    'ica': '/logos/ica.png',
    'jbl': '/logos/jbl.png',
    'oase': '/logos/oase.png',
    'prodac': '/logos/prodac.png',
    'sera': '/logos/sera.png',
    'sicce': '/logos/sicce.png',
    'sunsun': '/logos/sunsun.png',
    'tetra': '/logos/tetra.png',
    'vevor': '/logos/vevor.png',
  };

  return logoMap[formattedBrand] || ''; // Devuelve la ruta o una cadena vacía
}