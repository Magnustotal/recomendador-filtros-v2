// Mercado automático: precios semanales de la carne en España que publica la Comisión Europea (Agri-food Data Portal).
// Se descargan solos (función programada de Netlify, o el botón del panel), sin que nadie anote nada.
//
// Qué son y qué NO son (importante para no engañarse):
//  - Son precios MAYORISTAS de canal o de pieza (€ por 100 kg) que declara España a la UE. No son el precio de una carnicería ni de un
//    supermercado, ni de cada corte. Sirven para ver hacia dónde se mueve el mercado: si el vacuno en canal sube un 6 %, tus precios de
//    ternera se van a quedar cortos.
//  - Solo cubren vacuno (ternera joven), cerdo blanco, pollo y cordero. No hay serie europea para ibérico, conejo, caza, pavo, embutidos ni
//    elaborados.
// Se usa en el servidor; al panel le llega ya resumido.

export const URL_BASE = "https://api.tech.ec.europa.eu/agrifood/api";
export const FUENTE = {
  nombre: "Comisión Europea, Agri-food Data Portal (precios de carne declarados por España)",
  url: "https://agridata.ec.europa.eu/extensions/DataPortal/agricultural_markets.html",
};
export const SEMANAS_GUARDADAS = 70;
export const DIAS_PARA_REFRESCAR = 3;

// Cada serie: de qué endpoint sale, cómo se reconocen sus filas y cómo se agrupan los códigos que la forman.
export const SERIES = {
  vacuno: {
    nombre: "Ternera (canal)", endpoint: "beef", columna: "productCode", filtro: (f) => f.category === "Young cattle",
    detalle: "Canal de ternera joven (categoría Z de la clasificación europea), media de sus clases.",
  },
  cerdo: {
    nombre: "Cerdo blanco (canal)", endpoint: "pigmeat", columna: "pigClass", filtro: (f) => ["S", "E", "R"].includes(f.pigClass),
    detalle: "Canal de cerdo cebado, clases S, E y R. No incluye el ibérico.",
  },
  pollo_entero: {
    nombre: "Pollo entero (canal 65 %)", endpoint: "poultry", columna: "productName", filtro: (f) => f.productName === "Whole broiler (65%)" && f.priceType === "Selling price",
    detalle: "Pollo entero de engorde, presentación 65 %, precio de venta.",
  },
  pollo_pechuga: {
    nombre: "Pechuga de pollo (filete)", endpoint: "poultry", columna: "productName", filtro: (f) => f.productName === "Breast Fillet" && f.priceType === "Selling price",
    detalle: "Filete de pechuga de pollo, precio de venta.",
  },
  pollo_muslo: {
    nombre: "Muslos de pollo", endpoint: "poultry", columna: "productName", filtro: (f) => f.productName === "Legs" && f.priceType === "Selling price",
    detalle: "Muslos (cuartos traseros) de pollo, precio de venta.",
  },
  cordero: {
    nombre: "Cordero ligero (canal)", endpoint: "sheepAndGoat", columna: "category", filtro: (f) => f.category === "Light Lamb",
    detalle: "Canal de cordero ligero (menos de 13 kg de canal según la definición europea; no verificado aquí).",
  },
};
export const ENDPOINTS = ["beef", "pigmeat", "poultry", "sheepAndGoat"];

const sinAcentos = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Serie europea que sirve de termómetro para un producto, o null si no hay (ibérico, conejo, caza, pavo, embutidos, elaborados…). */
export function serieDeProducto(p) {
  const n = sinAcentos(p?.nombre);
  switch (p?.categoria) {
    case "vacuno": return "vacuno";
    case "cerdo": return "cerdo";
    case "cordero": return "cordero";
    case "pollo":
      if (/pechuga|filete/.test(n)) return "pollo_pechuga";
      if (/muslo/.test(n)) return "pollo_muslo";
      return "pollo_entero";
    default: return null;
  }
}

// "€578.94" -> 578.94 ; lo que no sea un precio razonable se descarta
export function precioDe(texto) {
  const limpio = String(texto ?? "").replace(/[€\s,]/g, "");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return n > 0 && n < 100000 ? n : null;
}
// "21/09/2026" -> "2026-09-21"
export function fechaDe(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto ?? ""));
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

/**
 * Convierte las respuestas de la UE ({ beef: [...], pigmeat: [...], ... }) en series propias:
 *   { id: { semanas: [{ ini, fin, codigos: { codigo: precio } }] } }   (de más antigua a más reciente, solo España)
 */
export function normalizar(respuestas, { ultimas = SEMANAS_GUARDADAS } = {}) {
  const salida = {};
  for (const [id, def] of Object.entries(SERIES)) {
    const filas = Array.isArray(respuestas?.[def.endpoint]) ? respuestas[def.endpoint] : null;
    if (!filas) continue;
    const porSemana = new Map();
    for (const f of filas) {
      if (f?.memberStateCode !== "ES" || !def.filtro(f)) continue;
      const ini = fechaDe(f.beginDate), fin = fechaDe(f.endDate), precio = precioDe(f.price);
      const codigo = f[def.columna];
      if (!ini || !fin || precio == null || typeof codigo !== "string") continue;
      const s = porSemana.get(ini) ?? { ini, fin, codigos: {} };
      s.codigos[codigo] = precio;
      porSemana.set(ini, s);
    }
    const semanas = [...porSemana.values()].sort((a, b) => (a.ini < b.ini ? -1 : 1)).slice(-ultimas);
    if (semanas.length) salida[id] = { semanas };
  }
  return salida;
}

const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const redondear2 = (n) => Math.round(n * 100) / 100;
export const nivelSemana = (s) => redondear2(media(Object.values(s.codigos)));

// Variación (%) entre dos semanas, sobre los códigos que están en las dos (así un código que falte un día no distorsiona).
function variacion(a, b) {
  const comunes = Object.keys(b.codigos).filter((c) => Object.hasOwn(a.codigos, c));
  if (!comunes.length) return null;
  return Math.round((media(comunes.map((c) => b.codigos[c] / a.codigos[c])) - 1) * 1000) / 10;
}

const sumarDias = (iso, d) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
// Última semana que empezó en esa fecha o antes (la que «estaba vigente»)
const semanaEn = (semanas, fecha) => { let r = null; for (const s of semanas) if (s.ini <= fecha) r = s; return r; };

/**
 * Resumen de una serie para el panel.
 *  desde: fecha (AAAA-MM-DD) de la última vez que se confirmaron los precios propios; con ella se mide cuánto se ha movido el mercado.
 */
export function resumirSerie(id, serie, { desde = null } = {}) {
  const def = SERIES[id];
  const semanas = serie?.semanas ?? [];
  if (!def || !semanas.length) return null;
  const ultima = semanas.at(-1);
  const pasado = (dias) => { const s = semanaEn(semanas, sumarDias(ultima.ini, -dias)); return s && s !== ultima ? variacion(s, ultima) : null; };
  const base = desde ? semanaEn(semanas, desde) : null;
  return {
    id, nombre: def.nombre, detalle: def.detalle, unidad: "€/100 kg",
    ultima: { ini: ultima.ini, fin: ultima.fin, precio: nivelSemana(ultima) },
    vsSemanaAnterior: pasado(7),
    vsCuatroSemanas: pasado(28),
    vsUnAnio: pasado(364),
    vsTusPrecios: base && base !== ultima ? { desde: base.ini, pct: variacion(base, ultima) } : null,
    grafico: semanas.slice(-26).map((s) => nivelSemana(s)),
  };
}

/** Lo que recibe el panel: resumen por serie, cuántos productos cubre cada una y las que se han movido de forma notable. */
export function resumenPanel(datos, productos, { desde = null, hoy = null, umbralPct = 5 } = {}) {
  const series = [];
  const cubiertos = new Map();
  for (const p of productos ?? []) { const s = serieDeProducto(p); if (s) cubiertos.set(s, (cubiertos.get(s) ?? 0) + 1); }
  for (const id of Object.keys(SERIES)) {
    const r = resumirSerie(id, datos?.series?.[id], { desde });
    if (r) series.push({ ...r, productos: cubiertos.get(id) ?? 0 });
  }
  const avisos = series
    .filter((s) => s.productos > 0 && s.vsTusPrecios && Math.abs(s.vsTusPrecios.pct) >= umbralPct)
    .map((s) => ({ serie: s.id, nombre: s.nombre, pct: s.vsTusPrecios.pct, productos: s.productos, desde: s.vsTusPrecios.desde }));
  const totalCubiertos = [...cubiertos.values()].reduce((a, b) => a + b, 0);
  const ultimaSemana = series.reduce((m, s) => (s.ultima.fin > m ? s.ultima.fin : m), "");
  return {
    actualizado: datos?.actualizado ?? null,
    desactualizado: !datos?.actualizado || (hoy != null && Date.parse(`${hoy}T00:00:00Z`) - Date.parse(datos.actualizado) > DIAS_PARA_REFRESCAR * 86_400_000),
    errores: datos?.errores ?? [],
    fuente: FUENTE,
    series,
    avisos,
    productosCubiertos: totalCubiertos,
    productosTotales: (productos ?? []).length,
    ultimaSemana: ultimaSemana || null,
  };
}

/**
 * Descarga las cuatro series (solo España, año actual y anterior) y las deja normalizadas.
 *  `traer` es fetch (se sustituye en las pruebas). Un fallo en una serie no tira las demás: se conservan los datos anteriores de esa serie.
 *  Devuelve { series, errores } con lo que se pudo leer.
 */
export async function descargar(traer, ahora, { previo = null } = {}) {
  const anio = new Date(ahora).getUTCFullYear();
  const respuestas = {};
  const errores = [];
  for (const endpoint of ENDPOINTS) {
    const url = `${URL_BASE}/${endpoint}/prices?memberStateCodes=ES&years=${anio - 1},${anio}`;
    try {
      const r = await traer(url, { headers: { accept: "application/json", "user-agent": "CarniceriaLaEstrella/1.0 (+https://carnicerialaestrella.netlify.app)" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const texto = await r.text();
      if (texto.length > 8_000_000) throw new Error("respuesta demasiado grande");
      const json = JSON.parse(texto);
      if (!Array.isArray(json)) throw new Error("formato inesperado");
      respuestas[endpoint] = json;
    } catch (e) {
      errores.push(`${endpoint}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  const nuevas = normalizar(respuestas);
  // Lo que no se pudo descargar conserva lo que ya había
  const series = { ...(previo?.series ?? {}) };
  for (const [id, s] of Object.entries(nuevas)) series[id] = s;
  return { series, errores };
}

const DIEZ_MINUTOS = 10 * 60 * 1000;

/**
 * Descarga y guarda los precios de la UE. Lo llaman la función programada (cada día) y el botón/arranque del panel.
 *  forzar=false: si lo guardado es de hace menos de DIAS_PARA_REFRESCAR días, no hace nada.
 *  Aunque se fuerce, no repite una descarga hecha hace menos de 10 minutos (el botón no puede martillear a la UE).
 *  Devuelve { datos, descargado }. Si no se pudo leer nada y no había nada guardado, lanza un error.
 */
export async function refrescarMercadoAuto(deps, { forzar = false } = {}) {
  const ahora = deps.ahora();
  const previo = await deps.almacen.leerMercadoAuto().catch(() => null);
  const edad = previo?.actualizado ? ahora - Date.parse(previo.actualizado) : Infinity;
  if (previo && (edad < DIEZ_MINUTOS || (!forzar && edad < DIAS_PARA_REFRESCAR * 86_400_000))) return { datos: previo, descargado: false };
  const { series, errores } = await descargar(deps.traer ?? fetch, ahora, { previo });
  if (!Object.keys(series).length) throw new Error(`No se pudieron descargar los precios de la UE (${errores.join("; ") || "sin datos"}).`);
  const datos = { actualizado: new Date(ahora).toISOString(), fuente: FUENTE, series, errores };
  await deps.almacen.guardarMercadoAuto(datos);
  return { datos, descargado: true };
}
