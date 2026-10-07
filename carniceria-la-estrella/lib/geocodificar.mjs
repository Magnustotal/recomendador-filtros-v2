// Localización de direcciones para el radio de reparto. Usa Nominatim (OpenStreetMap), un servicio gratuito
// y externo: solo se llama cuando el reparto tiene radio en km y el código postal no está en la lista de la zona.
// Política de uso de Nominatim: máximo 1 petición por segundo y un User-Agent que identifique la aplicación.

const RADIO_TIERRA_KM = 6371;
const rad = (g) => (g * Math.PI) / 180;

// Distancia en línea recta entre dos puntos {lat, lng}, en km (fórmula de haversine).
export function distanciaKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const redondear1 = (n) => Math.round(n * 10) / 10;

// Devuelve {lat, lng} o null (sin red, sin resultado, tiempo agotado, respuesta rara...). Nunca lanza.
export async function geocodificarNominatim(consulta, { fetchFn = fetch, timeoutMs = 3500, agente = "carniceria-la-estrella-pedidos/1.0 (+https://carnicerialaestrella.netlify.app)" } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeoutMs);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=es&q=${encodeURIComponent(consulta)}`;
    const r = await fetchFn(url, { headers: { "User-Agent": agente, "Accept-Language": "es" }, signal: control.signal });
    if (!r.ok) return null;
    const datos = await r.json();
    const primero = Array.isArray(datos) ? datos[0] : null;
    const lat = Number(primero?.lat);
    const lng = Number(primero?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}
