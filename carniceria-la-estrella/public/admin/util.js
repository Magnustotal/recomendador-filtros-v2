// Utilidades del panel: crear elementos sin innerHTML (todo lo que viene de los datos va como texto),
// formato de importes/fechas y avisos.

export function h(tag, atributos = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v == null) continue;
    if (k === "class") n.className = v;
    else if (k === "texto") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const hijo of hijos.flat()) if (hijo != null && hijo !== false) n.append(hijo);
  return n;
}

export const $ = (id) => document.getElementById(id);

export const euros = (cent) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cent / 100);
export const eurosDe = (e) => euros(Math.round(e * 100));
export const numeroEs = (n) => (n == null || n === "" ? "" : String(n).replace(".", ","));
// Importes en euros: siempre con dos decimales (29,90, no 29,9).
export const importeEs = (n) => (n == null || n === "" || Number.isNaN(Number(n)) ? numeroEs(n) : Number(n).toFixed(2).replace(".", ","));

export function cantidad(c, unidad) {
  if (unidad === "ud") return `${c} ud`;
  if (c < 1000) return `${c} g`;
  const kg = c / 1000;
  return `${Number.isInteger(kg) ? kg : String(kg).replace(".", ",")} kg`;
}

export const DIAS = [[1, "L", "lunes"], [2, "M", "martes"], [3, "X", "miércoles"], [4, "J", "jueves"], [5, "V", "viernes"], [6, "S", "sábado"], [7, "D", "domingo"]];

export function fechaLarga(iso) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}
export function fechaHora(iso) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(iso));
}

// Avisos breves. El contenedor es una región viva (role=status) para lectores de pantalla.
let temporizador;
export function aviso(texto, { error = false } = {}) {
  const el = $("aviso");
  el.textContent = texto;
  el.classList.toggle("es-error", error);
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { el.hidden = true; }, error ? 9000 : 3500);
}

export const sinAcentos = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "Es obligatorio." no dice de qué campo habla: se antepone el nombre del campo si se sabe cuál es.
const ETIQUETAS = { nombre: "Nombre", categoria: "Categoría", unidad: "Se vende", descripcion: "Descripción", paso: "Paso", minimo: "Mínimo", maximo: "Máximo", precio: "Precio", opciones: "Opciones", alergenos: "Alérgenos", foto: "Foto", horario: "Horario" };
export function describirError(e) {
  if (!e.campo) return e.mensaje;
  const control = document.querySelector(`[data-ruta="${CSS.escape(e.campo)}"]`);
  const etiqueta = control?.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)?.textContent
    || control?.closest(".campo")?.querySelector("label")?.textContent?.trim()
    || ETIQUETAS[e.campo] || (/^horario\[(\d+)\]/.test(e.campo) ? `Horario, tramo ${Number(e.campo.match(/\[(\d+)\]/)[1]) + 1}` : "");
  return etiqueta ? `${etiqueta}: ${e.mensaje}` : e.mensaje;
}

export function fechaConAnio(iso) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(iso));
}
