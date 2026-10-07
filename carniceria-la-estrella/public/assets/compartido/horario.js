// COPIA de lib/horario.mjs generada por scripts/empaquetar.mjs. No editar a mano.
// Fechas y horas siempre en la zona horaria de Sevilla (Europe/Madrid).

const ZONA = "Europe/Madrid";
const DIAS_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const NOMBRES_DIA = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const JSONLD_DIA = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ahoraEnMadrid(fecha = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const p = {};
  for (const x of fmt.formatToParts(fecha)) p[x.type] = x.value;
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    dia: DIAS_ISO[p.weekday],
    minutos: Number(p.hour) * 60 + Number(p.minute),
  };
}

export function diaSemanaDeFecha(fechaISO) {
  const d = new Date(fechaISO + "T12:00:00Z").getUTCDay(); // 0 = domingo
  return d === 0 ? 7 : d;
}

export function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function aMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function tramosDelDia(horario, dia) {
  return horario.filter((t) => t.dias.includes(dia)).map((t) => ({ abre: aMinutos(t.abre), cierra: aMinutos(t.cierra) })).sort((a, b) => a.abre - b.abre);
}

// Una franja "HH:MM-HH:MM" cabe en el horario de apertura de ese día
export function franjaDentroDeHorario(horario, dia, franja) {
  const [d, h] = franja.split("-").map(aMinutos);
  return tramosDelDia(horario, dia).some((t) => d >= t.abre && h <= t.cierra);
}

// Agrupa días consecutivos con el mismo horario -> filas para la tabla de "Visítanos"
export function filasHorario(horario) {
  const claveDia = (dia) => tramosDelDia(horario, dia).map((t) => `${t.abre}-${t.cierra}`).join(",");
  const texto = (dia) => {
    const tr = tramosDelDia(horario, dia);
    if (!tr.length) return "Cerrado";
    const f = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
    return tr.map((t) => `${f(t.abre)}–${f(t.cierra)}`).join(" y ");
  };
  const grupos = [];
  for (let dia = 1; dia <= 7; dia++) {
    const k = claveDia(dia);
    const ult = grupos[grupos.length - 1];
    if (ult && ult.k === k) ult.dias.push(dia);
    else grupos.push({ k, dias: [dia], texto: texto(dia) });
  }
  const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return grupos.map((g) => {
    const n = NOMBRES_DIA;
    let etiqueta;
    if (g.dias.length === 1) etiqueta = mayus(n[g.dias[0]]);
    else if (g.dias.length === 2) etiqueta = `${mayus(n[g.dias[0]])} y ${n[g.dias[1]]}`;
    else etiqueta = `${mayus(n[g.dias[0]])} a ${n[g.dias[g.dias.length - 1]]}`;
    return { etiqueta, texto: g.texto, cerrado: g.texto === "Cerrado" };
  });
}

// Para el JSON-LD (schema.org): lista de OpeningHoursSpecification
export function especificacionJsonLd(horario) {
  return horario.map((t) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: t.dias.map((d) => JSONLD_DIA[d]),
    opens: t.abre,
    closes: t.cierra,
  }));
}
