// Pestaña "Mercado": precios semanales de la carne que la web descarga sola de la Comisión Europea (cada día, o con el botón).
// No se anota nada a mano. Son precios mayoristas, útiles para ver hacia dónde se mueve el mercado (ver lib/mercado-auto.mjs).
import { api, textoErrores } from "./api.js";
import { h, $, aviso } from "./util.js";

let resumen = null;
let contexto = { alCambiar() {} };
let ocupado = false;

const NUM = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });
const fecha = (iso) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const fechaLarga = (iso) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const horaMadrid = (iso) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(iso));

export function iniciarMercado(ctx) {
  contexto = ctx;
  $("merc-actualizar").addEventListener("click", () => actualizar(true));
}

export function cargarMercado({ mercadoAuto }) {
  resumen = mercadoAuto ?? null;
  pintar();
  // Sin datos o con datos viejos, se descargan solos: nadie tiene que acordarse
  if (resumen?.desactualizado && !ocupado) actualizar(false);
}

// Para la lista de comprobación de la pestaña Estado
export function resumenMercado() { return resumen; }

async function actualizar(manual) {
  if (ocupado) return;
  ocupado = true;
  const boton = $("merc-actualizar");
  boton.disabled = true;
  $("merc-estado").textContent = "Descargando los precios de la UE…";
  const r = await api("/mercado/actualizar", { metodo: "POST", cuerpo: {} });
  ocupado = false;
  boton.disabled = false;
  if (r.ok) {
    resumen = r.datos.mercadoAuto;
    contexto.alCambiar(resumen);
    if (manual) aviso("Precios de la UE al día.");
  } else if (manual || !resumen?.series?.length) {
    aviso(textoErrores(r.errores) || "No se han podido descargar los precios de la UE.", { error: true });
  }
  pintar();
}

// Línea de puntos con la evolución de las últimas semanas (el texto la describe, el dibujo es un añadido)
function grafico(s) {
  const v = s.grafico;
  if (!v || v.length < 2) return null;
  const min = Math.min(...v), max = Math.max(...v), W = 120, H = 32, margen = 2;
  const puntos = v.map((y, i) => `${(margen + (i * (W - 2 * margen)) / (v.length - 1)).toFixed(1)},${(max === min ? H / 2 : H - margen - ((y - min) / (max - min)) * (H - 2 * margen)).toFixed(1)}`).join(" ");
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("class", "merc-grafico"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
  const linea = document.createElementNS(NS, "polyline");
  linea.setAttribute("points", puntos); linea.setAttribute("fill", "none"); linea.setAttribute("stroke", "currentColor"); linea.setAttribute("stroke-width", "2"); linea.setAttribute("stroke-linejoin", "round"); linea.setAttribute("stroke-linecap", "round");
  svg.append(linea);
  return svg;
}

const cambio = (etiqueta, pct) => (pct == null ? null : h("li", { class: `merc-cambio ${pct > 0 ? "sube" : pct < 0 ? "baja" : ""}` },
  h("span", { class: "merc-etq", texto: etiqueta }), h("strong", { texto: `${pct > 0 ? "▲" : pct < 0 ? "▼" : "="} ${PCT.format(pct)} %` })));

function tarjeta(s) {
  const kilo = s.ultima.precio / 100;
  return h("li", { class: "merc-serie" },
    h("div", { class: "merc-cab" },
      h("div", {}, h("h3", { texto: s.nombre }), h("p", { class: "ayuda", texto: s.detalle })),
      h("div", { class: "merc-precio" }, h("strong", { texto: `${NUM.format(kilo)} €/kg` }), h("span", { class: "ayuda", texto: `${NUM.format(s.ultima.precio)} €/100 kg · semana del ${fecha(s.ultima.ini)} al ${fecha(s.ultima.fin)}` })),
      grafico(s)),
    h("ul", { class: "merc-cambios", "aria-label": `Cómo ha cambiado ${s.nombre}` },
      cambio("Semana anterior", s.vsSemanaAnterior), cambio("Hace 4 semanas", s.vsCuatroSemanas), cambio("Hace un año", s.vsUnAnio),
      s.vsTusPrecios ? cambio(`Desde tus últimos precios (${fecha(s.vsTusPrecios.desde)})`, s.vsTusPrecios.pct) : null),
    h("p", { class: "ayuda", texto: s.productos ? `Sirve de termómetro para ${s.productos} producto${s.productos === 1 ? "" : "s"} tuyo${s.productos === 1 ? "" : "s"}.` : "Ningún producto tuyo se apoya en esta serie." }));
}

function pintar() {
  const estado = $("merc-estado"), avisos = $("merc-avisos"), lista = $("merc-series"), pie = $("merc-pie");
  if (!resumen || !resumen.series.length) {
    estado.textContent = ocupado ? "Descargando los precios de la UE…" : "Todavía no hay datos: se descargan solos en unos segundos. Si no aparecen, pulsa «Actualizar ahora».";
    avisos.replaceChildren(); lista.replaceChildren(); pie.replaceChildren();
    return;
  }
  estado.textContent = `Última semana publicada: del ${fecha(resumen.series[0].ultima.ini)} al ${fechaLarga(resumen.ultimaSemana)}. Descargado el ${horaMadrid(resumen.actualizado)}.${resumen.errores.length ? ` Algunas series no se pudieron leer (${resumen.errores.length}); se conservan los datos anteriores.` : ""}`;
  avisos.replaceChildren(...resumen.avisos.map((a) => h("p", { class: "merc-aviso" },
    h("strong", { texto: `${a.nombre}: ${a.pct > 0 ? "ha subido" : "ha bajado"} un ${PCT.format(Math.abs(a.pct)).replace("+", "")} % ` }),
    `desde el ${fecha(a.desde)}, cuando confirmaste tus precios. Afecta a ${a.productos} producto${a.productos === 1 ? "" : "s"}: conviene repasar su precio en la pestaña Productos.`)));
  lista.replaceChildren(...resumen.series.map(tarjeta));
  pie.replaceChildren(
    h("p", { class: "ayuda", texto: `Cubre ${resumen.productosCubiertos} de tus ${resumen.productosTotales} productos (ternera, cerdo, pollo y cordero). Para ibérico, conejo, caza, pavo, embutidos y elaborados la UE no publica precios, así que no hay termómetro.` }),
    h("p", { class: "ayuda" }, "Fuente: ", h("a", { href: resumen.fuente.url, target: "_blank", rel: "noopener", texto: resumen.fuente.nombre }), "."));
}
