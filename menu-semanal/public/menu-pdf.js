// Lectura de menús en PDF de texto vectorial (sin OCR) con pdf.js, todo en el navegador.
// Las funciones puras (cuadrícula, limpieza, fechas) no dependen de pdf.js y se prueban con `node --test`.
import { normalizeName, parseISO, toISO } from './lib.js';

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;

const WEEKDAYS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };
const HEADER_RE = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d{1,2})$/i;
// Contenido que nunca es un plato: contacto y pies legales (aunque quepan en el ancho de una columna).
const CONTACT_RE = /@|raz[oó]n social|registro sanitario|https?:\/\/|www\.|\d[\d\s.-]{7,}\d/i;
const WEEKDAY_RE = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/;

export class PdfError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const sentence = (s) => (s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s);

/** Texto en orden de lectura: filas por altura y, dentro de cada fila, columnas separadas por « | ». */
export function layoutText(items) {
  const rows = [];
  for (const it of [...items].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= 1.5);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  return rows
    .map((r) => r.items.sort((a, b) => a.x - b.x).reduce((acc, it, i, arr) => {
      if (!i) return it.str.trim();
      const prev = arr[i - 1];
      const gap = it.x - (prev.x + prev.w);
      return acc + (gap > 14 ? ' | ' : gap > 1 ? ' ' : '') + it.str.trim();
    }, ''))
    .join('\n');
}

/**
 * Calendario en cuadrícula (semanas en filas, días en columnas, con cabeceras tipo «LUNES 5»):
 * devuelve «Lunes 5: plato / plato / postre» por día. Devuelve '' si no reconoce la cuadrícula.
 * Descarta las etiquetas de fila (1ºPLATO...) y el pie, que quedan fuera de las columnas.
 */
export function parseCalendarGrid(items) {
  const headers = items.filter((i) => HEADER_RE.test(i.str.trim()));
  if (headers.length < 3) return '';
  const bands = [];
  for (const h of [...headers].sort((a, b) => b.y - a.y)) {
    const band = bands.find((b) => Math.abs(b.y - h.y) <= 2);
    if (band) band.cols.push(h);
    else bands.push({ y: h.y, cols: [h] });
  }
  const centers = bands.flatMap((b) => b.cols.map((c) => c.x + c.w / 2)).sort((a, b) => a - b);
  const spacing = median(centers.slice(1).map((c, i) => c - centers[i]).filter((d) => d > 20)) || 120;
  const heights = bands.slice(1).map((b, i) => bands[i].y - b.y);
  const blockH = heights.length ? median(heights) : 160; // alto de una semana; con una sola, margen generoso

  const lines = [];
  let lost = false; // texto ancho dentro de la cuadrícula (celdas fusionadas): no se puede asignar a un día
  bands.forEach((band, bi) => {
    const top = band.y - 1;
    const bottom = bi + 1 < bands.length ? bands[bi + 1].y : band.y - blockH;
    const cols = band.cols.sort((a, b) => a.x - b.x).map((c) => ({ c, mid: c.x + c.w / 2, cells: [] }));
    for (const it of items) {
      if (!it.str.trim() || HEADER_RE.test(it.str.trim()) || CONTACT_RE.test(it.str) || it.y >= top || it.y <= bottom) continue;
      if (it.w > spacing * 1.3) {
        if (/\p{L}{3}/u.test(it.str)) lost = true;
        continue;
      }
      const mid = it.x + it.w / 2;
      const col = cols.reduce((best, c) => (Math.abs(c.mid - mid) < Math.abs(best.mid - mid) ? c : best));
      if (Math.abs(col.mid - mid) <= spacing * 0.6) col.cells.push(it);
    }
    for (const col of cols) {
      const [, name, n] = col.c.str.trim().match(HEADER_RE);
      const dishes = col.cells.sort((a, b) => b.y - a.y || a.x - b.x).map((i) => sentence(i.str.trim()));
      if (dishes.length) lines.push(`${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()} ${n}: ${dishes.join(' / ')}`);
    }
  });
  return !lost && lines.length >= 3 ? lines.join('\n') : '';
}

/** Quita datos de contacto (correos, teléfonos, webs) y pies de página legales antes de enviar el texto a ninguna parte. */
export function sanitizeMenuText(text) {
  return text
    .split('\n')
    .filter((l) => !/^\s*(raz[oó]n social|registro sanitario)/i.test(l))
    .map((l) => l
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')
      .replace(/https?:\/\/\S+|www\.\S+/gi, '')
      .replace(/(\+?\d[\d\s.-]{7,}\d)/g, '')
      .trim())
    .filter(Boolean)
    .join('\n');
}

export const hasWeekdayNames = (text) => WEEKDAY_RE.test(normalizeName(text));

/**
 * Fechas (YYYY-MM-DD) de los días que aparecen como «Lunes 5», «Martes 6»... El mes se deduce de la
 * coincidencia día de la semana + número, probando desde el mes anterior a `refISO` hasta dos después.
 */
export function detectMenuDates(text, refISO) {
  const tokens = [...normalizeName(text).matchAll(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(\d{1,2})\b/g)]
    .map((m) => ({ wd: WEEKDAYS[m[1]], n: Number(m[2]) }));
  if (!tokens.length) return [];
  const ref = parseISO(refISO);
  const months = [-1, 0, 1, 2].map((o) => new Date(ref.getFullYear(), ref.getMonth() + o, 1));
  const valid = (m, t) => {
    const d = new Date(m.getFullYear(), m.getMonth(), t.n);
    return d.getMonth() === m.getMonth() && d.getDay() === t.wd ? d : null;
  };
  const best = months
    .map((m, i) => ({ i, hits: tokens.filter((t) => valid(m, t)).length }))
    .sort((a, b) => b.hits - a.hits || Math.abs(a.i - 1) - Math.abs(b.i - 1))[0];
  if (!best.hits) return [];
  const order = [best.i, best.i + 1, best.i - 1].filter((i) => months[i]);
  const out = new Set();
  for (const t of tokens) {
    for (const i of order) {
      const d = valid(months[i], t);
      if (d) { out.add(toISO(d)); break; }
    }
  }
  return [...out].sort();
}

/** Lee un PDF de texto vectorial. `file` solo necesita `size` y `arrayBuffer()` (File/Blob). */
export async function extractPdfText(file) {
  if (file.size > MAX_PDF_BYTES) throw new PdfError('big', 'El PDF pesa más de 15 MB. Prueba con uno más pequeño.');
  const data = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...data.slice(0, 5)) !== '%PDF-') throw new PdfError('format', 'El archivo no parece un PDF.');
  const pdfjs = await import('./vendor/pdf.min.mjs'); // se descarga solo al usar un PDF
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    task.destroy();
    if (err?.name === 'PasswordException') throw new PdfError('password', 'El PDF está protegido con contraseña.');
    throw new PdfError('format', 'No se pudo leer el PDF.');
  }
  try {
    const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
    const chunks = [];
    for (let n = 1; n <= pages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const items = content.items
        .filter((i) => typeof i.str === 'string')
        .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
      chunks.push(parseCalendarGrid(items) || layoutText(items));
    }
    const text = sanitizeMenuText(chunks.join('\n\n'));
    if (text.replace(/\s/g, '').length < 20) {
      throw new PdfError('empty', 'El PDF no tiene texto seleccionable (¿es una imagen escaneada?). Súbelo como foto.');
    }
    return { text, pages };
  } finally {
    task.destroy();
  }
}
