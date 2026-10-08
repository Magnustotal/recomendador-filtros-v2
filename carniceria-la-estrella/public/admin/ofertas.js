// Pestaña "Ofertas": todas las ofertas de producto y los regalos por compra en un solo sitio.
// Se crea una oferta eligiendo el producto en una lista; empieza y acaba sola en las fechas que se pongan.
import { api, textoErrores } from "./api.js";
import { h, $, importeEs, aviso, describirError, sinAcentos } from "./util.js";
import { sumarDias } from "/assets/compartido/horario.js";
import { fechaCorta, nombreOferta, rebajaValida, MAX_OFERTAS_POR_PRODUCTO, MAX_REGALOS } from "/assets/compartido/ofertas.js";

let productos = [];
let categorias = [];
let regalos = []; // copia de trabajo de los regalos (se guardan con su propio botón)
let hoy = new Date().toISOString().slice(0, 10);
let contexto = { recargar() {}, guardarRegalos: async () => ({ ok: false, errores: [] }), preciosCfg: () => ({ iva: {} }) };
let filtro = "";

export function iniciarOfertas(ctx) {
  contexto = ctx;
  $("of-buscar").addEventListener("input", (e) => { filtro = sinAcentos(e.target.value.trim()); pintarLista(); });
  $("of-nueva").addEventListener("click", () => abrirDialogo());
}

export function cargarOfertas({ productos: lista, categorias: cats, regalos: rg, hoy: h0 }) {
  if (lista) productos = lista;
  if (cats) categorias = cats;
  if (h0) hoy = h0;
  if (rg) regalos = structuredClone(rg);
  pintarLista();
  pintarRegalos();
}

// Para la ficha del producto y la lista de comprobación del panel
export const ofertasDe = (p) => p.ofertas ?? [];
export function resumenOfertas() {
  let activas = 0, programadas = 0;
  for (const p of productos) for (const o of ofertasDe(p)) { if (o.hasta < hoy) continue; if (o.desde > hoy) programadas++; else activas++; }
  return { activas, programadas, regalos: regalos.length };
}
export function buscarEnOfertas(texto) {
  filtro = sinAcentos(texto);
  $("of-buscar").value = texto;
  pintarLista();
}

const eurosTxt = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;
const unidadDe = (p) => (p.unidad === "kg" ? "kg" : "ud");
const estadoDe = (o) => (o.hasta < hoy ? "terminada" : o.desde > hoy ? "programada" : "activa");
const ETIQUETA_ESTADO = { activa: "Activa hoy", programada: "Programada", terminada: "Terminada" };
const nombreCat = (id) => categorias.find((c) => c.id === id)?.nombre ?? id;
const rangoTxt = (o) => (o.desde === o.hasta ? `El ${fechaCorta(o.desde)}` : `Del ${fechaCorta(o.desde)} al ${fechaCorta(o.hasta)}`);

function resumenTxt(p, o) {
  if (o.tipo === "precio") {
    const dto = p.precio ? ` (−${Math.round((1 - o.precio / p.precio) * 100)} %)` : "";
    return `Rebaja: ${p.precio != null ? `${eurosTxt(p.precio)} → ` : ""}${eurosTxt(o.precio)}/${unidadDe(p)}${dto}`;
  }
  const base = p.unidad === "kg" ? " kg" : " ud";
  return `${nombreOferta(o)}: se llevan ${o.lleva}${base} y se pagan ${o.paga}${base}`;
}

// Venta con pérdida (Ley 7/1996, art. 14): por debajo de lo que costó el producto, con el IVA, puede ser desleal en ciertos casos.
// Aviso orientativo, no bloquea nada: el coste es el que tú has apuntado (sin IVA) y no cuenta la merma.
function avisoPerdida(p, precioPorUnidad) {
  if (p.coste == null || !(precioPorUnidad > 0)) return "";
  const iva = contexto.preciosCfg()?.iva?.[p.categoria] ?? 10;
  const minimo = Math.round(p.coste * (1 + iva / 100) * 100) / 100;
  if (precioPorUnidad >= minimo) return "";
  return ` ⚠ Ojo: a ${eurosTxt(precioPorUnidad)} por ${unidadDe(p)} vendes por debajo de lo que te cuesta (${eurosTxt(minimo)} con IVA, según el coste que apuntaste). Vender con pérdida puede ser desleal en algunos casos (art. 14 de la Ley 7/1996); pregúntalo a tu gestoría antes de publicarla.`;
}

// Qué va a pasar con una rebaja según la regla de los 30 días (Ley 7/1996, art. 20): el tachado es el menor precio aplicado antes
function textoRebaja(p, o, n, ignorar) {
  const r = rebajaValida(p, o, ignorar);
  if (r.valida) {
    const extra = r.anterior !== p.precio ? ` Ojo: tu precio actual es ${eurosTxt(p.precio)}, pero en los 30 días anteriores aplicaste ${eurosTxt(r.anterior)}, y ese es el que hay que tachar.` : "";
    return `La tienda enseñará ${eurosTxt(r.anterior)} tachado y ${eurosTxt(n)} (−${Math.round((1 - n / r.anterior) * 100)} %).${extra}`;
  }
  if (r.motivo === "primera") return `⚠ Ese producto no tenía precio en los 30 días anteriores: sale a la venta por primera vez, así que no se anuncia como rebaja. Se cobrará ${eurosTxt(n)} sin tachar nada.`;
  return `⚠ En los 30 días anteriores aplicaste ${eurosTxt(r.anterior)}, que no es más caro que ${eurosTxt(n)}: esto no cuenta como rebaja (hay que tachar el precio más bajo de esos 30 días). Se cobrará ${eurosTxt(n)} sin tachado ni etiqueta de oferta. Cambia el precio o las fechas.`;
}

// ---------- lista ----------
function todas() {
  const lista = [];
  for (const p of productos) ofertasDe(p).forEach((o, i) => lista.push({ p, o, i }));
  return lista;
}

function tarjeta({ p, o, i }) {
  const editar = h("button", { type: "button", class: "btn-sec", texto: "Cambiar", "aria-label": `Cambiar la oferta de ${p.nombre}` });
  editar.addEventListener("click", () => abrirDialogo({ p, o, i }));
  const quitar = h("button", { type: "button", class: "btn-sec", texto: "Quitar", "aria-label": `Quitar la oferta de ${p.nombre}` });
  quitar.addEventListener("click", async () => {
    if (!confirm(`¿Quitar esta oferta de ${p.nombre}?`)) return;
    const r = await guardarProducto(p, ofertasDe(p).filter((_, k) => k !== i));
    if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); return; }
    aviso("Oferta quitada.");
    contexto.recargar();
  });
  const estado = estadoDe(o);
  return h("article", { class: `oferta-item oferta-${estado}` },
    h("header", {}, h("h4", { texto: p.nombre }), h("span", { class: `etiqueta-estado e-${estado}`, texto: ETIQUETA_ESTADO[estado] })),
    h("p", { class: "oferta-resumen", texto: resumenTxt(p, o) }),
    h("p", { class: "ayuda", texto: `${rangoTxt(o)} · ${nombreCat(p.categoria)}` }),
    o.tipo === "precio" && estado !== "terminada" && p.precio != null && o.precio < p.precio && !rebajaValida(p, o).valida ? h("p", { class: "oferta-aviso", texto: textoRebaja(p, o, o.precio) }) : null,
    h("div", { class: "acciones" }, editar, quitar));
}

function pintarLista() {
  const cont = $("of-lista");
  const coinciden = todas().filter(({ p }) => !filtro || sinAcentos(`${p.nombre} ${nombreCat(p.categoria)}`).includes(filtro));
  const grupo = (titulo, items, { plegable = false, extra = null } = {}) => {
    if (!items.length) return null;
    const cuerpo = h("div", { class: "of-grupo-lista" }, items.map(tarjeta));
    if (!plegable) return h("section", { class: "of-grupo" }, h("h3", { texto: `${titulo} (${items.length})` }), cuerpo);
    return h("details", { class: "of-grupo" }, h("summary", { texto: `${titulo} (${items.length})` }), extra, cuerpo);
  };
  const por = (e) => coinciden.filter(({ o }) => estadoDe(o) === e);
  const orden = (a, b) => (a.o.desde < b.o.desde ? -1 : a.o.desde > b.o.desde ? 1 : a.p.nombre.localeCompare(b.p.nombre, "es"));
  const terminadas = por("terminada").sort((a, b) => orden(b, a));
  const limpiar = terminadas.length ? h("button", { type: "button", class: "btn-sec", id: "of-borrar-terminadas", texto: "Borrar las terminadas" }) : null;
  limpiar?.addEventListener("click", async () => {
    if (!confirm(`¿Borrar las ${terminadas.length} ofertas terminadas${filtro ? " que se ven" : ""}?`)) return;
    const porProducto = new Map();
    for (const { p, o } of terminadas) porProducto.set(p, [...(porProducto.get(p) ?? []), o]);
    for (const [p, fuera] of porProducto) {
      const r = await guardarProducto(p, ofertasDe(p).filter((x) => !fuera.includes(x)));
      if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); break; }
    }
    aviso("Ofertas terminadas borradas.");
    contexto.recargar();
  });
  const nodos = [
    grupo("Activas hoy", por("activa").sort(orden)),
    grupo("Programadas", por("programada").sort(orden)),
    grupo("Terminadas", terminadas, { plegable: true, extra: limpiar }),
  ].filter(Boolean);
  const total = todas().length;
  cont.replaceChildren(...(nodos.length ? nodos : [h("p", { class: "vacio", texto: total ? "Ninguna oferta coincide con la búsqueda." : "Todavía no hay ofertas. Pulsa «Crear oferta» para programar la primera." })]));
}

async function guardarProducto(p, ofertas) {
  return api("/producto", { metodo: "PUT", cuerpo: { ...p, ofertas } });
}

// ---------- crear o cambiar una oferta ----------
function abrirDialogo(edicion = null) {
  const dlg = $("dlg-oferta");
  const esNueva = !edicion;
  const id = (s) => `f-of-${s}`;
  const campo = (idc, etiqueta, control, ayuda) => h("div", { class: "campo" }, h("label", { for: idc, texto: etiqueta }), control, ayuda ? h("p", { class: "ayuda", texto: ayuda }) : null);
  const errores = h("div", { class: "errores", role: "alert", tabindex: "-1", hidden: true });

  // Producto: se escribe para buscar y salen TODOS los que coinciden, los activos de un color y los ocultos de otro
  // (el color nunca va solo: cada fila lleva su etiqueta escrita)
  let elegido = edicion?.p.id ?? "";
  const buscar = h("input", { id: id("buscar"), type: "search", autocomplete: "off", placeholder: "Escribe para encontrar el producto" });
  const resultados = h("div", { class: "of-resultados", role: "radiogroup", "aria-label": "Productos que coinciden" });
  const resumen = h("p", { class: "ayuda", role: "status" });
  const infoProd = h("p", { class: "ayuda", role: "status" });
  const pintarProductos = () => {
    const q = sinAcentos(buscar.value.trim());
    const coinciden = productos
      .filter((p) => !q || sinAcentos(`${p.nombre} ${nombreCat(p.categoria)}`).includes(q))
      .sort((a, b) => (Number(!!a.oculto) - Number(!!b.oculto)) || a.nombre.localeCompare(b.nombre, "es"));
    const ocultos = coinciden.filter((p) => p.oculto).length;
    resultados.replaceChildren(...(coinciden.length ? coinciden.map((p) => h("label", { class: `of-op ${p.oculto ? "es-oculto" : "es-activo"}` },
      h("input", { type: "radio", name: "of-producto", value: p.id, checked: p.id === elegido }),
      h("span", { class: "of-op-texto" },
        h("span", { class: "of-op-nombre", texto: p.nombre }),
        h("span", { class: "of-op-meta", texto: `${nombreCat(p.categoria)} · ${p.precio != null ? `${eurosTxt(p.precio)}/${unidadDe(p)}` : "sin precio"}` })),
      h("span", { class: `of-pastilla ${p.oculto ? "es-oculto" : "es-activo"}`, texto: p.oculto ? "Oculto: se activará con la oferta" : "Activo" }),
      p.agotado ? h("span", { class: "of-pastilla es-agotado", texto: "Agotado" }) : null)) : [h("p", { class: "ayuda", texto: "Ningún producto coincide." })]));
    resumen.textContent = coinciden.length ? `${coinciden.length} producto${coinciden.length === 1 ? "" : "s"}: ${coinciden.length - ocultos} activo${coinciden.length - ocultos === 1 ? "" : "s"} y ${ocultos} oculto${ocultos === 1 ? "" : "s"}.` : "";
    mostrarProducto();
  };
  const producto = () => productos.find((p) => p.id === elegido) ?? null;

  const tipoPrecio = h("input", { type: "radio", name: "tipo-oferta", value: "precio", checked: !edicion || edicion.o.tipo === "precio" });
  const tipoCantidad = h("input", { type: "radio", name: "tipo-oferta", value: "cantidad", checked: edicion?.o.tipo === "cantidad" });
  const tipos = h("div", { class: "modos", role: "radiogroup", "aria-label": "Tipo de oferta" },
    h("label", { class: "modo" }, tipoPrecio, h("span", { texto: "Rebaja de precio" })),
    h("label", { class: "modo" }, tipoCantidad, h("span", { texto: "Lleva más, paga menos (3x2…)" })));

  const precio = h("input", { id: id("precio"), type: "text", inputmode: "decimal", autocomplete: "off", value: edicion?.o.tipo === "precio" ? importeEs(edicion.o.precio) : "" });
  const lleva = h("input", { id: id("lleva"), type: "text", inputmode: "numeric", autocomplete: "off", maxlength: "2", value: edicion?.o.tipo === "cantidad" ? edicion.o.lleva : "3" });
  const paga = h("input", { id: id("paga"), type: "text", inputmode: "numeric", autocomplete: "off", maxlength: "2", value: edicion?.o.tipo === "cantidad" ? edicion.o.paga : "2" });
  const desde = h("input", { id: id("desde"), type: "date", value: edicion?.o.desde ?? hoy });
  const hasta = h("input", { id: id("hasta"), type: "date", value: edicion?.o.hasta ?? sumarDias(hoy, 6) });
  const ayudaPrecio = h("p", { class: "ayuda", role: "status" });
  const ayudaCantidad = h("p", { class: "ayuda", role: "status" });
  const panelPrecio = h("div", { class: "calc-panel" }, campo(id("precio"), "Precio de oferta (€)", precio), ayudaPrecio);
  const panelCantidad = h("div", { class: "calc-panel" }, h("div", { class: "fila-dos" }, campo(id("lleva"), "Se lleva", lleva), campo(id("paga"), "Se paga", paga)), ayudaCantidad);

  const num = (el) => { const t = el.value.trim().replace(",", "."); const n = Number(t); return t === "" || !Number.isFinite(n) ? null : n; };
  function mostrarProducto() {
    const p = producto();
    const precioTxt = p ? (p.precio != null ? `Precio habitual: ${eurosTxt(p.precio)}/${unidadDe(p)}.` : "Este producto todavía no tiene precio: solo se puede hacer un 3x2 (para rebajar, pon antes su precio en la pestaña Productos).") : "";
    const ocultoTxt = p?.oculto ? ` Está oculto en la tienda: con esta oferta se mostrará${desde.value && hasta.value ? ` del ${fechaCorta(desde.value)} al ${fechaCorta(hasta.value)}` : " mientras dure"} y volverá a ocultarse solo cuando termine.` : "";
    infoProd.textContent = precioTxt + ocultoTxt;
    refrescar();
  }
  function refrescar() {
    const p = producto();
    const esPrecio = tipoPrecio.checked;
    panelPrecio.hidden = !esPrecio;
    panelCantidad.hidden = esPrecio;
    const n = num(precio);
    if (p?.precio != null && n != null && n > 0) {
      if (n >= p.precio) ayudaPrecio.textContent = `Tiene que ser más barato que el precio habitual (${eurosTxt(p.precio)}).`;
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(desde.value)) ayudaPrecio.textContent = "Pon la fecha de inicio para comprobar el precio anterior.";
      else ayudaPrecio.textContent = textoRebaja(p, { tipo: "precio", desde: desde.value, hasta: hasta.value, precio: n }, n, edicion?.o) + avisoPerdida(p, n);
    } else ayudaPrecio.textContent = "Se enseña el precio anterior tachado y este.";
    const l = num(lleva), g = num(paga), u = p ? (p.unidad === "kg" ? "kg" : "ud") : "";
    ayudaCantidad.textContent = l && g && g < l
      ? `Con ${l} ${u} se pagan ${g} ${u}; se regala de cada tramo completo (con ${l * 2} ${u}, el doble).${p?.precio != null ? avisoPerdida(p, Math.round((p.precio * g / l) * 100) / 100) : ""}`
      : "Se paga menos de lo que se lleva (por ejemplo, lleva 3 y paga 2).";
  }
  for (const el of [tipoPrecio, tipoCantidad, precio, lleva, paga, desde, hasta]) el.addEventListener("input", refrescar);
  for (const el of [desde, hasta]) el.addEventListener("input", mostrarProducto);
  buscar.addEventListener("input", pintarProductos);
  resultados.addEventListener("change", (ev) => { if (ev.target.name === "of-producto") { elegido = ev.target.value; mostrarProducto(); } });
  pintarProductos();
  if (edicion) buscar.disabled = true;

  const guardarBtn = h("button", { type: "submit", class: "btn-prim", texto: esNueva ? "Crear oferta" : "Guardar cambios" });
  const cancelar = h("button", { type: "button", class: "btn-sec", texto: "Cancelar", onclick: () => dlg.close() });
  const formulario = h("form", { novalidate: true, "aria-labelledby": "dlg-of-titulo" },
    h("h2", { id: "dlg-of-titulo", texto: esNueva ? "Crear oferta" : `Cambiar la oferta de ${edicion.p.nombre}` }),
    errores,
    ...(edicion ? [h("p", { class: "ayuda", texto: `${edicion.p.nombre} · ${nombreCat(edicion.p.categoria)}` }), infoProd] : [
      campo(id("buscar"), "Producto", buscar),
      h("p", { class: "ayuda" }, h("span", { class: "of-pastilla es-activo", texto: "Activo" }), " se ve ahora en la tienda. ", h("span", { class: "of-pastilla es-oculto", texto: "Oculto" }), " no se ve: con la oferta se mostrará y, cuando termine, volverá a ocultarse solo."),
      resumen, resultados, infoProd]),
    h("fieldset", { class: "campo-grupo" }, h("legend", { texto: "Qué oferta" }), tipos, panelPrecio, panelCantidad),
    h("div", { class: "fila-dos" }, campo(id("desde"), "Desde (incluido)", desde), campo(id("hasta"), "Hasta (incluido)", hasta)),
    h("p", { class: "ayuda", texto: "Se activa y se desactiva sola en esas fechas. Con una rebaja, la tienda tacha el precio anterior, que según la Ley 7/1996 (art. 20) es el más bajo que hayas aplicado a ese producto en los 30 días previos al inicio: la web lo calcula con el historial de tus precios y ofertas. Conviene que tu gestoría lo confirme." }),
    h("div", { class: "dlg-acciones" }, guardarBtn, cancelar));

  formulario.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const p = producto();
    const fallo = (msg) => { errores.replaceChildren(h("ul", {}, h("li", { texto: msg }))); errores.hidden = false; errores.focus(); };
    if (!p) return fallo("Elige el producto de la lista.");
    const o = tipoPrecio.checked
      ? { tipo: "precio", desde: desde.value, hasta: hasta.value, precio: precio.value.trim() === "" ? null : precio.value }
      : { tipo: "cantidad", desde: desde.value, hasta: hasta.value, lleva: Number(lleva.value), paga: Number(paga.value) };
    const actuales = ofertasDe(p);
    if (esNueva && actuales.length >= MAX_OFERTAS_POR_PRODUCTO) return fallo(`Ese producto ya tiene ${MAX_OFERTAS_POR_PRODUCTO} ofertas: quita alguna terminada.`);
    const lista = esNueva ? [...actuales, o] : actuales.map((x, k) => (k === edicion.i ? o : x));
    guardarBtn.disabled = true;
    const r = await guardarProducto(p, lista);
    guardarBtn.disabled = false;
    if (!r.ok) { errores.replaceChildren(h("ul", {}, r.errores.map((e) => h("li", { texto: describirError(e) })))); errores.hidden = false; errores.focus(); return; }
    dlg.close();
    aviso(esNueva ? `Oferta creada para ${p.nombre}.` : "Oferta cambiada.");
    contexto.recargar();
  });

  dlg.replaceChildren(formulario);
  dlg.addEventListener("close", () => dlg.replaceChildren(), { once: true });
  dlg.showModal();
  (esNueva ? buscar : precio).focus();
}

// ---------- regalo por compra ----------
function pintarRegalos() {
  const cont = $("of-regalos");
  const errores = h("div", { class: "errores", role: "alert", tabindex: "-1", hidden: true });
  const lista = h("div", { class: "regalos-lista" });
  const guardar = h("button", { type: "button", class: "btn-prim", id: "of-guardar-regalos", texto: "Guardar regalos", disabled: true });
  const anadir = h("button", { type: "button", class: "btn-sec", id: "of-anadir-regalo", texto: "Añadir un regalo" });
  const cambio = () => { guardar.disabled = false; };
  const pintar = () => {
    lista.replaceChildren(...(regalos.length ? regalos.map((r, i) => {
      const n = i + 1;
      const texto = h("input", { id: `of-regalo-${n}-texto`, type: "text", maxlength: "80", autocomplete: "off", value: r.regalo ?? "", placeholder: "Por ejemplo: 250 g de chorizo" });
      const minimo = h("input", { id: `of-regalo-${n}-minimo`, type: "text", inputmode: "decimal", autocomplete: "off", value: importeEs(r.minimo) });
      const maximo = h("input", { id: `of-regalo-${n}-maximo`, type: "text", inputmode: "numeric", autocomplete: "off", maxlength: "2", value: r.maximo ?? "" });
      const dDesde = h("input", { id: `of-regalo-${n}-desde`, type: "date", value: r.desde ?? "" });
      const dHasta = h("input", { id: `of-regalo-${n}-hasta`, type: "date", value: r.hasta ?? "" });
      const repetir = h("input", { id: `of-regalo-${n}-repetir`, type: "checkbox", checked: !!r.repetir });
      const enlazar = (clave, el, conv = (v) => v) => el.addEventListener("input", () => { r[clave] = conv(el.value); cambio(); });
      enlazar("regalo", texto); enlazar("minimo", minimo, (v) => (v.trim() === "" ? null : v)); enlazar("maximo", maximo, (v) => (v.trim() === "" ? null : v)); enlazar("desde", dDesde, (v) => v || null); enlazar("hasta", dHasta, (v) => v || null);
      repetir.addEventListener("change", () => { r.repetir = repetir.checked; cambio(); });
      const quitar = h("button", { type: "button", class: "btn-sec", texto: "Quitar", "aria-label": `Quitar el regalo ${n}` });
      quitar.addEventListener("click", () => { regalos.splice(i, 1); cambio(); pintar(); });
      const c = (idc, etiqueta, control, ayuda) => h("div", { class: "campo" }, h("label", { for: idc, texto: etiqueta }), control, ayuda ? h("p", { class: "ayuda", texto: ayuda }) : null);
      return h("fieldset", { class: "oferta-fila" }, h("legend", { texto: `Regalo ${n}` }),
        c(`of-regalo-${n}-texto`, "De regalo", texto),
        h("div", { class: "fila-dos" }, c(`of-regalo-${n}-minimo`, "Compra de (€)", minimo, "Productos ya con las ofertas, sin contar el envío."), c(`of-regalo-${n}-maximo`, "Máximo por pedido (opcional)", maximo)),
        h("div", { class: "campo check" }, h("label", { for: `of-regalo-${n}-repetir` }, repetir, h("span", { texto: "Se repite: por cada tramo completo se regala uno más (si no, uno solo)" }))),
        h("div", { class: "fila-dos" }, c(`of-regalo-${n}-desde`, "Desde (opcional, incluido)", dDesde), c(`of-regalo-${n}-hasta`, "Hasta (opcional, incluido)", dHasta)),
        quitar);
    }) : [h("p", { class: "ayuda", texto: "Ningún regalo configurado." })]));
    anadir.hidden = regalos.length >= MAX_REGALOS;
  };
  anadir.addEventListener("click", () => {
    regalos.push({ regalo: "", minimo: 30, repetir: true, maximo: null, desde: null, hasta: null });
    cambio(); pintar();
    lista.querySelector(`#of-regalo-${regalos.length}-texto`)?.focus();
  });
  guardar.addEventListener("click", async () => {
    guardar.disabled = true;
    const r = await contexto.guardarRegalos(regalos);
    if (!r.ok) { errores.replaceChildren(h("ul", {}, r.errores.map((e) => h("li", { texto: describirError(e) })))); errores.hidden = false; errores.focus(); guardar.disabled = false; return; }
    errores.hidden = true;
    aviso("Regalos guardados.");
  });
  pintar();
  cont.replaceChildren(
    h("p", { class: "ayuda", texto: "Por ejemplo: «por cada 30 € de compra, 250 g de chorizo de regalo». Se aplica solo en las fechas que pongas (o siempre, si las dejas vacías) y el cliente lo ve en la portada, en la tienda, en su pedido y en el mensaje de WhatsApp. El regalo es un texto: tú lo preparas." }),
    errores, lista, h("div", { class: "acciones" }, anadir, guardar));
}
