// Precios de referencia del mercado: varias fuentes (supermercados, carnicerías online…) con el precio que el
// carnicero anota y su fecha. Se usa en el servidor (validación) y en el panel (semáforo): una sola fuente de verdad.
// Es de uso interno: el cliente no ve nunca estas cifras.
import { rangoOrientativo } from "./precios.mjs";

export const TIPOS_FUENTE = { supermercado: "Supermercado", carniceria_online: "Carnicería online", carniceria_local: "Carnicería local", mayorista: "Mayorista / lonja" };
// «diaria»: se espera un dato nuevo cada día (por ejemplo, si algún día se lee sola); «semanal» y «manual»: lo anota una persona.
export const FRECUENCIAS = { diaria: "Diaria", semanal: "Semanal", manual: "Cuando se pueda" };
// Pasados estos días, un precio deja de contar para el semáforo (los precios de la carne cambian a menudo).
export const VIGENCIA_DIAS = { diaria: 14, semanal: 45, manual: 45 };
export const AVISO_SEMANAL_DIAS = 7;

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esNumero = (n) => typeof n === "number" && Number.isFinite(n);
const DIA_MS = 86_400_000;

export const diasEntre = (desde, hasta) => Math.max(0, Math.floor((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS));

export function mediana(valores) {
  const v = [...valores].sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : Math.round(((v[m - 1] + v[m]) / 2) * 100) / 100;
}

/**
 * Referencia de mercado de un producto.
 *  precios: { [fuenteId]: { precio, fecha } }   fuentes: [{ id, nombre, frecuencia }]   hoy: "AAAA-MM-DD"
 * Solo cuentan los precios vigentes (según la frecuencia de su fuente). Devuelve null si no hay ninguno.
 */
export function referenciaMercado(precios, fuentes, hoy) {
  const usadas = [];
  let descartadas = 0;
  for (const f of fuentes ?? []) {
    const e = precios?.[f.id];
    if (!e || !esNumero(e.precio) || e.precio <= 0 || !RE_FECHA.test(e.fecha ?? "")) continue;
    const dias = diasEntre(e.fecha, hoy);
    if (dias > (VIGENCIA_DIAS[f.frecuencia] ?? VIGENCIA_DIAS.manual)) { descartadas++; continue; }
    usadas.push({ id: f.id, nombre: f.nombre, precio: e.precio, dias });
  }
  if (!usadas.length) return descartadas ? { n: 0, descartadas } : null;
  const valores = usadas.map((u) => u.precio);
  return { n: usadas.length, descartadas, mediana: mediana(valores), min: Math.min(...valores), max: Math.max(...valores), masAntigua: Math.max(...usadas.map((u) => u.dias)), fuentes: usadas };
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const haceDias = (d) => (d === 0 ? "de hoy" : d === 1 ? "de ayer" : `de hace ${d} días`);

/**
 * Convierte la referencia en un «orientativo» para el semáforo: centrado en la mediana y con un rango más
 * estrecho cuanto más fuentes hay (1 fuente = poco fiable, 2 = media, 3 o más = alta).
 */
export function rangoDesdeMercado(ref) {
  if (!ref || !ref.n) return null;
  const fiabilidad = ref.n >= 3 ? "a" : ref.n === 2 ? "m" : "b";
  const antigua = ref.n === 1 ? `el dato es ${haceDias(ref.masAntigua)}` : `la más antigua es ${haceDias(ref.masAntigua)}`;
  return { precio: ref.mediana, fiabilidad, ...rangoOrientativo(ref.mediana, fiabilidad), origen: `Referencia de mercado: mediana de ${plural(ref.n, "fuente", "fuentes")} (${antigua}).`, n: ref.n, masAntigua: ref.masAntigua };
}

// ---- validación de lo que llega del panel ----
const RE_ID_FUENTE = /^[a-z0-9][a-z0-9-]{0,29}$/;
const MAX_FUENTES = 30;
const PRECIO_MAX = 2000;

const limpiarTexto = (v, max) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

/**
 * Valida el conjunto de fuentes y precios. `idsProductos`: productos que pueden tener referencia.
 * Los precios de productos o fuentes desconocidos se rechazan (no se descartan en silencio).
 */
export function validarMercado(entrada, { idsProductos, hoy }) {
  const errores = [];
  const error = (campo, mensaje) => errores.push({ campo, mensaje });
  const e = entrada && typeof entrada === "object" ? entrada : {};
  const fuentes = [];
  if (!Array.isArray(e.fuentes)) error("fuentes", "Debe ser una lista.");
  else if (e.fuentes.length > MAX_FUENTES) error("fuentes", `Máximo ${MAX_FUENTES} fuentes.`);
  else {
    const ids = new Set(), nombres = new Set();
    e.fuentes.forEach((f, i) => {
      const campo = `fuentes[${i + 1}]`;
      if (!f || typeof f !== "object") return error(campo, "No es una fuente válida.");
      const nombre = limpiarTexto(f.nombre, 60);
      if (!nombre) return error(campo, "El nombre es obligatorio.");
      if (nombre.length > 60) return error(campo, "Nombre demasiado largo (máximo 60).");
      if (!RE_ID_FUENTE.test(f.id ?? "")) return error(campo, "Identificador no válido.");
      if (ids.has(f.id) || nombres.has(nombre.toLowerCase())) return error(campo, "Fuente repetida.");
      if (!(f.tipo in TIPOS_FUENTE)) return error(campo, "Tipo de fuente no válido.");
      if (!(f.frecuencia in FRECUENCIAS)) return error(campo, "Frecuencia no válida.");
      let url = "";
      if (f.url != null && f.url !== "") {
        url = limpiarTexto(f.url, 200);
        let u; try { u = new URL(url); } catch { u = null; }
        if (!u || !/^https?:$/.test(u.protocol) || url.length > 200) return error(campo, "La dirección web debe empezar por http:// o https:// (máximo 200 caracteres).");
      }
      const nota = limpiarTexto(f.nota, 200);
      if (nota.length > 200) return error(campo, "La nota es demasiado larga (máximo 200).");
      ids.add(f.id); nombres.add(nombre.toLowerCase());
      fuentes.push({ id: f.id, nombre, tipo: f.tipo, frecuencia: f.frecuencia, url, nota });
    });
  }
  const precios = {};
  const idsFuente = new Set(fuentes.map((f) => f.id));
  const crudo = e.precios;
  if (crudo == null || typeof crudo !== "object" || Array.isArray(crudo)) error("precios", "Debe ser un objeto con los precios por producto.");
  else {
    const limite = Date.parse(`${hoy}T00:00:00Z`) + DIA_MS; // se admite «mañana» por desfase horario
    for (const [pid, porFuente] of Object.entries(crudo)) {
      if (!idsProductos.includes(pid)) { error("precios", `Producto desconocido: ${limpiarTexto(pid, 60)}.`); continue; }
      if (!porFuente || typeof porFuente !== "object" || Array.isArray(porFuente)) { error("precios", `Datos no válidos para ${pid}.`); continue; }
      for (const [fid, dato] of Object.entries(porFuente)) {
        if (!idsFuente.has(fid)) { error("precios", `Fuente desconocida en ${pid}: ${limpiarTexto(fid, 30)}.`); continue; }
        const p = typeof dato?.precio === "string" ? Number(dato.precio.replace(",", ".")) : dato?.precio;
        if (!esNumero(p) || p <= 0 || p > PRECIO_MAX) { error("precios", `Precio no válido en ${pid} (${fid}): entre 0,01 y ${PRECIO_MAX} €.`); continue; }
        if (!RE_FECHA.test(dato.fecha ?? "") || new Date(`${dato.fecha}T00:00:00Z`).toISOString().slice(0, 10) !== dato.fecha) { error("precios", `Fecha no válida en ${pid} (${fid}).`); continue; }
        if (Date.parse(`${dato.fecha}T00:00:00Z`) > limite) { error("precios", `La fecha de ${pid} (${fid}) está en el futuro.`); continue; }
        (precios[pid] ??= {})[fid] = { precio: Math.round(p * 100) / 100, fecha: dato.fecha };
      }
    }
  }
  return errores.length ? { ok: false, errores } : { ok: true, valor: { fuentes, precios } };
}

// Fuente más atrasada respecto a su frecuencia, para avisar al carnicero («lleva N días sin anotarse»).
export function fuentesAtrasadas(mercado, hoy) {
  const salida = [];
  for (const f of mercado?.fuentes ?? []) {
    let ultima = null;
    for (const porFuente of Object.values(mercado.precios ?? {})) if (porFuente[f.id] && (!ultima || porFuente[f.id].fecha > ultima)) ultima = porFuente[f.id].fecha;
    const dias = ultima ? diasEntre(ultima, hoy) : null;
    const limite = f.frecuencia === "diaria" ? 2 : f.frecuencia === "semanal" ? AVISO_SEMANAL_DIAS : null;
    if (limite != null && (dias == null || dias > limite)) salida.push({ id: f.id, nombre: f.nombre, dias });
  }
  return salida;
}
