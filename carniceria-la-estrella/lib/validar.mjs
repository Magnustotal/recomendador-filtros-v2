// Utilidades de validación y saneado de texto. Todo lo que llega de fuera pasa por aquí.

export function texto(valor, { max = 200, min = 0, campo = "campo", multilinea = false } = {}) {
  if (valor == null) valor = "";
  if (typeof valor !== "string") throw new ErrorValidacion(campo, "Debe ser texto.");
  let t = valor.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (!multilinea) t = t.replace(/[\r\n\t]+/g, " ");
  t = t.trim();
  if (t.length < min) throw new ErrorValidacion(campo, min === 1 ? "Es obligatorio." : `Debe tener al menos ${min} caracteres.`);
  if (t.length > max) throw new ErrorValidacion(campo, `Máximo ${max} caracteres.`);
  return t;
}

export function numeroOpcional(valor, { campo = "campo", min = 0, max = 1e6, decimales = 2 } = {}) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "string" ? Number(valor.replace(",", ".")) : valor;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new ErrorValidacion(campo, "Debe ser un número.");
  if (n < min || n > max) throw new ErrorValidacion(campo, `Debe estar entre ${min} y ${max}.`);
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

export function entero(valor, { campo = "campo", min = 0, max = 1e9 } = {}) {
  if (typeof valor !== "number" || !Number.isInteger(valor)) throw new ErrorValidacion(campo, "Debe ser un número entero.");
  if (valor < min || valor > max) throw new ErrorValidacion(campo, `Debe estar entre ${min} y ${max}.`);
  return valor;
}

export function booleano(valor, defecto = false) {
  return typeof valor === "boolean" ? valor : defecto;
}

export function listaTextos(valor, { max = 30, maxLong = 80, campo = "campo" } = {}) {
  if (valor == null) return [];
  if (!Array.isArray(valor)) throw new ErrorValidacion(campo, "Debe ser una lista.");
  if (valor.length > max) throw new ErrorValidacion(campo, `Máximo ${max} elementos.`);
  const salida = [];
  for (const v of valor) {
    const t = texto(v, { max: maxLong, campo });
    if (t && !salida.includes(t)) salida.push(t);
  }
  return salida;
}

export function hora(valor, campo = "hora") {
  if (typeof valor !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) throw new ErrorValidacion(campo, "Formato HH:MM.");
  return valor;
}

export function franja(valor, campo = "franja") {
  if (typeof valor !== "string") throw new ErrorValidacion(campo, "Formato HH:MM-HH:MM.");
  const m = valor.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!m) throw new ErrorValidacion(campo, "Formato HH:MM-HH:MM.");
  hora(m[1], campo); hora(m[2], campo);
  if (m[1] >= m[2]) throw new ErrorValidacion(campo, "La hora de fin debe ser posterior a la de inicio.");
  return valor;
}

export function diasSemana(valor, campo = "días") {
  if (!Array.isArray(valor)) throw new ErrorValidacion(campo, "Debe ser una lista de días (1 = lunes ... 7 = domingo).");
  const dias = [...new Set(valor)];
  if (!dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) throw new ErrorValidacion(campo, "Días entre 1 (lunes) y 7 (domingo).");
  return dias.sort((a, b) => a - b);
}

export function fechaISO(valor, campo = "fecha") {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new ErrorValidacion(campo, "Formato AAAA-MM-DD.");
  const d = new Date(valor + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) throw new ErrorValidacion(campo, "Fecha no válida.");
  return valor;
}

export function telefonoEspana(valor, campo = "teléfono") {
  const solo = String(valor ?? "").replace(/[\s.\-()]/g, "");
  const m = solo.match(/^(?:\+34|0034)?([6789]\d{8})$/);
  if (!m) throw new ErrorValidacion(campo, "Teléfono español de 9 cifras.");
  return m[1];
}

export class ErrorValidacion extends Error {
  constructor(campo, mensaje) {
    super(`${campo}: ${mensaje}`);
    this.campo = campo;
    this.mensaje = mensaje;
  }
}

// Ejecuta una función de validación y devuelve {ok, valor} o {ok:false, errores}
export function recoger(fn) {
  const errores = [];
  const ctx = {
    intento(f) {
      try { return f(); } catch (e) { if (e instanceof ErrorValidacion) { errores.push({ campo: e.campo, mensaje: e.mensaje }); return undefined; } throw e; }
    },
    error(campo, mensaje) { errores.push({ campo, mensaje }); },
  };
  const valor = fn(ctx);
  return errores.length ? { ok: false, errores } : { ok: true, valor };
}
