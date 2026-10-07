// Pestaña "Productos": lista con precio y "agotado" editables en el momento, y un editor completo.
import { api, textoErrores } from "./api.js";
import { h, $, importeEs, aviso, sinAcentos, describirError, fechaConAnio } from "./util.js";
import { prepararFoto, pesoLegible, LADO_MAXIMO, LADO_MINIMO } from "./fotos.js";
import { semaforo, rangoOrientativo, precioDesdeCoste, ajustarPorcentaje, MARGEN_POR_DEFECTO, NOMBRE_FIABILIDAD } from "/assets/compartido/precios.js";
import { redondear } from "/assets/compartido/dinero.js";
import { referenciaMercado, rangoDesdeMercado } from "/assets/compartido/mercado.js";
import { ofertaVigente, nombreOferta } from "/assets/compartido/ofertas.js";

let productos = [];
let categorias = [];
let meta = {};
let mercado = null; // { fuentes, precios, anclas }: precios de otras tiendas que anota el carnicero
let hoyIso = new Date().toISOString().slice(0, 10);
let orientativos = null; // { precios: { id: [precio, fiabilidad] }, fecha, nivel, _nota }
let contexto = null; // { redondeoActual(), guardarRedondeo(valor), recargar(), preciosCfg() }
let busqueda = "";
const abiertas = new Set(); // categorías desplegadas (cuando no se está buscando)
let ultimaCategoria = ""; // la última que se ha abierto o a la que se ha ido: es la de un producto nuevo

export function iniciarProductos(ctx) {
  contexto = ctx;
  // En pantallas anchas las herramientas de precios se ven abiertas; en el móvil, plegadas para llegar antes a los productos.
  $("prod-herramientas").open = matchMedia("(min-width: 800px)").matches;
  $("prod-buscar").addEventListener("input", (e) => { busqueda = sinAcentos(e.target.value.trim()); pintar(); });
  $("prod-expandir").addEventListener("click", () => { for (const c of categorias) abiertas.add(c.id); pintar(); });
  $("prod-contraer").addEventListener("click", () => { abiertas.clear(); pintar(); });
  $("prod-nuevo").addEventListener("click", () => abrirEditor(null));
  $("prod-precios-al-dia").addEventListener("click", async () => {
    if (!confirm("Esto indica a tus clientes que has repasado los precios hoy («Precios actualizados por última vez el …» en la tienda). ¿Lo has hecho?")) return;
    const r = await api("/precios-al-dia", { metodo: "POST", cuerpo: {} });
    if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); return; }
    meta = r.datos.meta;
    pintar();
    aviso("Hecho: la tienda muestra que los precios se han actualizado hoy.");
  });
  $("prod-aceptar-todos").addEventListener("click", async () => {
    const n = orientativosPendientes();
    if (!n) return;
    if (!confirm(`Se pondrá el precio orientativo a los ${n} productos que aún no tienen precio (no se toca ninguno que ya tenga). Son estimaciones sin verificar (no son una tarifa): un precio equivocado se publica en la tienda y puede obligarte a mantenerlo o a cancelar pedidos. Revísalos después. ¿Continuar?`)) return;
    const r = await api("/orientativos", { metodo: "POST", cuerpo: {} });
    if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); return; }
    await contexto.recargar();
    aviso(`Precios orientativos aplicados a ${r.datos.aplicados} productos. Revísalos y ajústalos cuando puedas.`);
  });
  $("prod-redondeo").addEventListener("change", async (e) => {
    const valor = e.target.value ? Number(e.target.value) : null;
    const ok = await contexto.guardarRedondeo(valor);
    if (!ok) e.target.value = contexto.redondeoActual() ?? "";
    $("prod-redondear").disabled = !contexto.redondeoActual();
  });
  $("prod-redondear").addEventListener("click", async () => {
    const final = contexto.redondeoActual();
    if (!final) return;
    if (!confirm(`Esto cambiará TODOS los precios por kilo para que terminen en ,${final} (siempre hacia arriba). ¿Continuar?`)) return;
    const r = await api("/redondeo", { metodo: "POST", cuerpo: { final } });
    if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); return; }
    await contexto.recargar();
    aviso(r.datos.tocados ? `Redondeados ${r.datos.tocados} precios.` : "Todos los precios ya estaban redondeados.");
  });
}

export function cargarProductos({ productos: lista, categorias: cats, orientativos: orient, meta: m, mercado: merc, hoy }) {
  if (orient) orientativos = orient;
  if (merc) mercado = merc;
  if (hoy) hoyIso = hoy;
  if (m) meta = m;
  productos = lista;
  categorias = cats;
  $("prod-redondeo").value = contexto.redondeoActual() ?? "";
  $("prod-redondear").disabled = !contexto.redondeoActual();
  pintar();
}

export const productosSinPrecio = () => productos.filter((p) => !p.oculto && p.precio == null).length;
export const productosConPrecio = () => productos.filter((p) => p.precio != null).length;

// ---------- precios orientativos y semáforo ----------
const cfgPrecios = () => contexto.preciosCfg();
const ivaDe = (categoria) => cfgPrecios().iva?.[categoria] ?? 10;
// Precios de otras tiendas (pestaña «Mercado»): si hay datos recientes, mandan sobre la estimación propia.
export function fijarMercado(m, hoy) {
  mercado = m;
  if (hoy) hoyIso = hoy;
  if (productos.length) pintar();
}
export function orientativoDe(id) {
  const delMercado = rangoDesdeMercado(referenciaMercado(mercado?.precios?.[id], mercado?.fuentes, hoyIso));
  if (delMercado) return { ...delMercado, mercado: true };
  const e = orientativos?.precios?.[id];
  if (!e) return null;
  const [precio, fiabilidad] = e;
  return { precio, fiabilidad, ...rangoOrientativo(precio, fiabilidad) };
}
// De dónde sale el rango de mercado, dicho con claridad (no es una fuente oficial ni se actualiza solo).
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function referenciaTexto(o) {
  if (o.mercado) return `${o.origen} Son los precios que anotas en la pestaña «Mercado»; solo los ves tú.`;
  const [a, m] = (orientativos?.fecha ?? "").split("-");
  const cuando = a && m ? `${NOMBRES_MES[Number(m) - 1]} de ${a}` : "fecha desconocida";
  return `Rango de mercado: estimación propia de ${cuando}, con fiabilidad ${NOMBRE_FIABILIDAD[o.fiabilidad]}. No procede de una fuente oficial ni se actualiza sola: tómalo como orientación.`;
}
export const datosPrecios = () => ({ fechaPrecios: meta?.precios ?? null, fechaReferencia: orientativos?.fecha ?? null });
export const orientativosPendientes = () => productos.filter((p) => p.precio == null && orientativoDe(p.id)).length;
const semDe = (p) => semaforo({ precio: p.precio, orientativo: orientativoDe(p.id), coste: p.coste, merma: p.merma ?? 0, iva: ivaDe(p.categoria), margenObjetivo: p.margen ?? cfgPrecios().margenDefecto ?? MARGEN_POR_DEFECTO });
// Etiqueta de la lista: oferta activa hoy, o la próxima programada
const diaMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
function textoOfertaFila(p) {
  const activa = ofertaVigente(p.ofertas, hoyIso);
  if (activa) return `${nombreOferta(activa)} hasta el ${diaMes(activa.hasta)}`;
  const proxima = (p.ofertas ?? []).filter((o) => o.desde > hoyIso).sort((a, b) => (a.desde < b.desde ? -1 : 1))[0];
  return proxima ? `${nombreOferta(proxima)} programada: ${diaMes(proxima.desde)}` : null;
}
// Aviso ante un precio que parece una errata (un cero de más o de menos, una coma mal puesta): muy lejos del que tenía o del orientativo
function precioSospechoso(p, texto) {
  const n = Number(String(texto ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const orientativo = p.id ? orientativoDe(p.id) : null;
  const motivos = [];
  if (p.precio != null && (n < p.precio * 0.5 || n > p.precio * 2)) motivos.push(`antes era ${eurosTxt(p.precio)}`);
  if (orientativo && (n < orientativo.precio * 0.4 || n > orientativo.precio * 2.5)) motivos.push(`el orientativo es ${eurosTxt(orientativo.precio)}`);
  return motivos.length ? `El precio ${eurosTxt(n)} se aleja mucho (${motivos.join("; ")}). ¿Es correcto? Un precio mal escrito se publica en la tienda y puede obligarte a mantenerlo o a cancelar pedidos.` : null;
}
const SIMBOLO = { verde: "✔", ambar: "!", rojo: "✖", gris: "–" };
const eurosTxt = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

// Etiqueta del semáforo: lleva icono y texto, no solo color.
function etiquetaSem(r) {
  return h("span", { class: `sem sem-${r.nivel}`, title: r.detalle }, h("span", { "aria-hidden": "true", texto: SIMBOLO[r.nivel] }), ` ${r.etiqueta}`);
}

const nombreCategoria = (id) => categorias.find((c) => c.id === id)?.nombre ?? id;
const unidadTexto = (p) => (p.unidad === "kg" ? "€/kg" : "€/ud");

const icono = (id) => h("span", { class: "icono", "aria-hidden": "true", style: `--ico:url(/assets/iconos/${id}.svg)` });
const ordenar = (lista) => lista.sort((a, b) => a.orden - b.orden);
const porCategoria = (id) => productos.filter((p) => p.categoria === id);
const textoCuenta = (lista) => {
  const sin = lista.filter((p) => p.precio == null).length;
  return `${lista.length} producto${lista.length === 1 ? "" : "s"}${sin ? ` · ${sin} sin precio` : " · todos con precio"}`;
};

// Recalcula los contadores sin rehacer las filas (tras aceptar o cambiar un precio).
function pintarCuentas() {
  for (const c of categorias) {
    const el = document.querySelector(`#pcat-${c.id} .cat-cuenta`);
    if (el) el.textContent = textoCuenta(porCategoria(c.id));
  }
  const pend = orientativosPendientes();
  $("prod-contador").textContent = `${visibles()} de ${productos.length} productos · ${productosSinPrecio()} sin precio · ${pend} con precio orientativo sin aceptar`;
  const botonTodos = $("prod-aceptar-todos");
  botonTodos.disabled = pend === 0;
  botonTodos.textContent = pend ? `Aceptar los ${pend} precios orientativos pendientes` : "No quedan precios orientativos pendientes";
}
let nVisibles = 0;
const visibles = () => nVisibles;

function irACategoria(id) {
  abiertas.add(id);
  ultimaCategoria = id;
  const d = $(`pcat-${id}`);
  if (d && !d.open) d.open = true; // dispara «toggle», que rellena las filas
  if (!d) { pintar(); }
  // Se vuelve a ajustar cuando ya se han pintado las filas (si no, la página aún es corta y se queda a medio camino)
  const ir = () => $(`pcat-${id}`)?.scrollIntoView({ block: "start", behavior: "instant" });
  ir();
  requestAnimationFrame(() => requestAnimationFrame(ir));
  for (const b of $("prod-chips").children) b.toggleAttribute("aria-current", b.dataset.cat === id);
}

function pintar() {
  $("prod-fecha-precios").textContent = meta?.precios
    ? `Precios actualizados por última vez: ${fechaConAnio(meta.precios)}. Es la fecha que ve el cliente en la tienda; se actualiza sola cuando cambias un precio, o al pulsar el botón.`
    : "Todavía no hay fecha de actualización de precios: la tienda no muestra ninguna hasta que cambies un precio o pulses el botón.";
  const buscando = busqueda !== "";
  const grupos = [];
  nVisibles = 0;
  for (const c of categorias) {
    const todos = porCategoria(c.id);
    if (!todos.length) continue;
    const coinciden = buscando ? todos.filter((p) => sinAcentos(`${p.nombre} ${c.nombre}`).includes(busqueda)) : todos;
    if (!coinciden.length) continue;
    nVisibles += coinciden.length;
    const abierta = buscando || abiertas.has(c.id);
    const cuerpo = h("div", { class: "prod-cat-lista" });
    const d = h("details", { class: "prod-cat", id: `pcat-${c.id}` },
      h("summary", {}, icono(c.id), h("span", { class: "cat-nombre", texto: c.nombre }), h("span", { class: "cat-cuenta", texto: textoCuenta(todos) })),
      cuerpo);
    const rellenar = () => { if (!cuerpo.childElementCount) cuerpo.replaceChildren(...ordenar([...coinciden]).map(fila)); };
    // «Última categoría» solo cambia por una acción de la persona (no al repintar la lista)
    d.querySelector("summary").addEventListener("click", () => { ultimaCategoria = c.id; });
    d.addEventListener("toggle", () => {
      if (d.open) { rellenar(); if (!buscando) abiertas.add(c.id); }
      else if (!buscando) abiertas.delete(c.id);
    });
    if (abierta) { d.open = true; rellenar(); }
    grupos.push({ c, d, n: coinciden.length });
  }
  $("prod-lista").replaceChildren(...grupos.map((g) => g.d));
  if (!grupos.length) $("prod-lista").append(h("p", { class: "vacio", texto: "Ningún producto coincide con la búsqueda." }));
  const chips = grupos.map(({ c, n }) => {
    const b = h("button", { type: "button", class: "chip", "data-cat": c.id, "aria-label": `${c.nombre}, ${n} producto${n === 1 ? "" : "s"}` }, icono(c.id), c.nombre);
    b.toggleAttribute("aria-current", c.id === ultimaCategoria);
    b.addEventListener("click", () => irACategoria(c.id));
    return b;
  });
  $("prod-chips").replaceChildren(...chips);
  $("prod-chips").hidden = chips.length < 2;
  pintarCuentas();
}

async function guardar(p, cambios, { estado, alFallar }) {
  const r = await api("/producto", { metodo: "PUT", cuerpo: { ...p, ...cambios } });
  if (!r.ok) { alFallar?.(); aviso(textoErrores(r.errores), { error: true }); return null; }
  Object.assign(p, r.datos.producto);
  if (estado) { estado.textContent = "✓ Guardado"; setTimeout(() => { estado.textContent = ""; }, 2500); }
  return r.datos.producto;
}

function fila(p) {
  const estado = h("span", { class: "fila-estado", role: "status" });
  const precio = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: importeEs(p.precio), placeholder: "Consultar", "aria-label": `Precio de ${p.nombre} en ${unidadTexto(p)}` });
  const sem = h("span", { class: "sem-hueco" });
  const sugerido = h("div", { class: "sugerido" });
  const etiquetas = h("span", { class: "etiquetas" });

  // Lo que depende del precio actual: semáforo, sugerencia y etiquetas (se repinta sin rehacer la lista)
  const actualizar = () => {
    precio.value = importeEs(p.precio);
    sem.replaceChildren(etiquetaSem(semDe(p)));
    const o = orientativoDe(p.id);
    if (p.precio == null && o) {
      const aceptar = h("button", { type: "button", class: "btn-sec btn-mini", texto: "Aceptar", "aria-label": `Aceptar el precio orientativo de ${p.nombre}: ${eurosTxt(o.precio)}` });
      aceptar.addEventListener("click", async () => {
        const g = await guardar(p, { precio: o.precio }, { estado });
        if (g) { actualizar(); pintarCuentas(); }
      });
      sugerido.replaceChildren(h("span", { texto: `Orientativo: ${eurosTxt(o.precio)}${p.unidad === "kg" ? "/kg" : "/ud"}` }), aceptar);
    } else sugerido.replaceChildren();
    etiquetas.replaceChildren(...[p.oculto && "Oculto", p.agotado && "Agotado", p.foto && "Con foto", p.alcohol && "+18", textoOfertaFila(p)].filter(Boolean).map((t) => h("span", { class: "mini", texto: t })));
  };

  precio.addEventListener("change", async () => {
    const antes = p.precio;
    const sospecha = precioSospechoso(p, precio.value);
    if (sospecha && !confirm(sospecha)) { precio.value = importeEs(antes); return; }
    const g = await guardar(p, { precio: precio.value.trim() === "" ? null : precio.value }, { estado, alFallar: () => { precio.value = importeEs(antes); } });
    if (g) { actualizar(); pintarCuentas(); if (g.precio == null) estado.textContent = "✓ Sin precio (se verá «Consultar»)"; }
  });
  const agotado = h("input", { type: "checkbox", id: `ag-${p.id}`, checked: !!p.agotado });
  agotado.addEventListener("change", async () => {
    await guardar(p, { agotado: agotado.checked }, { estado, alFallar: () => { agotado.checked = !agotado.checked; } });
    actualizar();
  });
  const editar = h("button", { type: "button", class: "btn-sec", texto: "Editar", "aria-label": `Editar ${p.nombre}` });
  editar.addEventListener("click", () => abrirEditor(p));
  const fila_ = h("div", { class: "prod-fila" },
    h("div", { class: "prod-nombre" }, h("strong", { texto: p.nombre }), h("small", { texto: nombreCategoria(p.categoria) }), etiquetas, sugerido),
    h("div", { class: "precio-sem" }, h("label", { class: "precio" }, precio, h("span", { texto: unidadTexto(p) })), sem),
    h("label", { class: "interruptor", for: agotado.id }, agotado, h("span", { texto: "Agotado" })),
    editar, estado);
  actualizar();
  return fila_;
}

// ---------- editor ----------
function abrirEditor(original) {
  const esNuevo = !original;
  const p = original ? structuredClone(original) : { nombre: "", categoria: ultimaCategoria || categorias[0].id, descripcion: "", unidad: "kg", paso: 250, minimo: null, maximo: null, precio: null, agotado: false, oculto: false, opciones: [], foto: null, alcohol: false, alergenos: [] };
  const dlg = $("dlg-producto");

  const campo = (id, etiqueta, control, ayuda) => h("div", { class: "campo" }, h("label", { for: id, texto: etiqueta }), control, ayuda ? h("p", { class: "ayuda", texto: ayuda }) : null);
  const nombre = h("input", { id: "f-nombre", type: "text", maxlength: "80", value: p.nombre, required: true });
  const grupos = [...new Set(categorias.map((c) => c.grupo))];
  const categoria = h("select", { id: "f-categoria" }, ...grupos.map((g) => h("optgroup", { label: g }, ...categorias.filter((c) => c.grupo === g).map((c) => h("option", { value: c.id, texto: c.nombre, selected: c.id === p.categoria })))));
  const descripcion = h("input", { id: "f-descripcion", type: "text", maxlength: "160", value: p.descripcion ?? "" });
  const unidad = h("select", { id: "f-unidad" }, h("option", { value: "kg", texto: "Al peso (kilos y gramos)", selected: p.unidad === "kg" }), h("option", { value: "ud", texto: "Por unidades", selected: p.unidad === "ud" }));
  const paso = h("input", { id: "f-paso", type: "number", min: "1", step: "1", inputmode: "numeric", value: p.paso ?? "" });
  const minimo = h("input", { id: "f-minimo", type: "number", min: "1", step: "1", inputmode: "numeric", value: p.minimo ?? "" });
  const maximo = h("input", { id: "f-maximo", type: "number", min: "1", step: "1", inputmode: "numeric", value: p.maximo ?? "" });
  const precio = h("input", { id: "f-precio", type: "text", inputmode: "decimal", value: importeEs(p.precio), placeholder: "Vacío = Consultar" });
  const opciones = h("textarea", { id: "f-opciones", rows: "4", placeholder: "Una por línea: Entero / En filetes / Picado" }, (p.opciones ?? []).join("\n"));
  const alergenos = h("input", { id: "f-alergenos", type: "text", value: (p.alergenos ?? []).join(", "), placeholder: "gluten, leche, huevo…" });
  const chk = (id, etiqueta, marcado) => h("label", { class: "check", for: id }, h("input", { id, type: "checkbox", checked: marcado }), h("span", { texto: etiqueta }));
  const cAgotado = chk("f-agotado", "Agotado (se ve pero no se puede pedir)", p.agotado);
  const cOculto = chk("f-oculto", "Oculto (no aparece en la tienda)", p.oculto);
  const cAlcohol = chk("f-alcohol", "Bebida alcohólica (pide confirmar que es mayor de 18)", p.alcohol);

  const ayudaUnidad = h("p", { class: "ayuda", id: "ayuda-unidad" });
  const sincronizarUnidad = () => {
    const kg = unidad.value === "kg";
    ayudaUnidad.textContent = kg ? "Pasos en gramos: 250 = de cuarto en cuarto de kilo. Mínimo y máximo, también en gramos." : "Pasos en unidades: 1 = de una en una.";
    if (!paso.dataset.tocado) paso.value = kg ? 250 : 1;
  };
  unidad.addEventListener("change", sincronizarUnidad);
  paso.addEventListener("input", () => { paso.dataset.tocado = "1"; });
  sincronizarUnidad();
  if (!esNuevo) paso.value = p.paso ?? paso.value;

  // Foto
  const vista = h("div", { class: "foto-vista" });
  const estadoFoto = h("p", { class: "ayuda", role: "status" });
  const archivo = h("input", { id: "f-foto", type: "file", accept: "image/jpeg,image/png,image/webp", class: "sr-only" });
  const quitar = h("button", { type: "button", class: "btn-sec", texto: "Quitar foto" });
  const pintarFoto = () => {
    vista.replaceChildren(p.foto ? h("img", { src: `/api/foto/${p.foto}`, alt: `Foto de ${p.nombre || "este producto"}`, width: "120", height: "120" }) : h("span", { class: "sin-foto", texto: "Sin foto" }));
    quitar.hidden = !p.foto;
  };
  archivo.addEventListener("change", async () => {
    const f = archivo.files[0];
    if (!f) return;
    estadoFoto.textContent = "Preparando la foto…";
    try {
      const { blob, ancho, alto, origen, ampliada, reducida } = await prepararFoto(f);
      estadoFoto.textContent = "Subiendo la foto…";
      const r = await api("/foto", { metodo: "POST", bytes: blob, tipo: "image/jpeg" });
      if (!r.ok) throw new Error(textoErrores(r.errores));
      p.foto = r.datos.id;
      const cambio = reducida ? "reducida" : ampliada ? "ampliada (era pequeña y puede verse algo borrosa)" : "ajustada";
      estadoFoto.textContent = `Foto subida: ${cambio} de ${origen.ancho}×${origen.alto} px (${pesoLegible(origen.bytes)}) a ${ancho}×${alto} px (${pesoLegible(blob.size)}). Pulsa «Guardar» para aplicarla al producto.`;
      pintarFoto();
    } catch (e) { estadoFoto.textContent = e.message; }
    archivo.value = "";
  });
  quitar.addEventListener("click", () => { p.foto = null; estadoFoto.textContent = "Foto quitada. Pulsa «Guardar» para aplicarlo."; pintarFoto(); });
  pintarFoto();

  const errores = h("div", { class: "errores", role: "alert", tabindex: "-1", hidden: true });
  const guardarBtn = h("button", { type: "submit", class: "btn-prim", texto: "Guardar" });
  const cancelar = h("button", { type: "button", class: "btn-sec", texto: "Cancelar", onclick: () => dlg.close() });
  const eliminar = esNuevo ? null : h("button", { type: "button", class: "btn-peligro", texto: "Eliminar producto", onclick: async () => {
    if (!confirm(`¿Eliminar «${p.nombre}» de la tienda? Si solo quieres quitarlo un tiempo, es mejor marcarlo como «Oculto» o «Agotado».`)) return;
    const r = await api(`/producto?id=${encodeURIComponent(p.id)}`, { metodo: "DELETE" });
    if (!r.ok) { mostrarErrores(errores, r.errores); return; }
    productos = productos.filter((x) => x.id !== p.id);
    dlg.close();
    pintar();
    aviso("Producto eliminado.");
  } });

  // ---------- calculadora de precio y semáforo ----------
  const orient = esNuevo ? null : orientativoDe(p.id);
  const redondeoActual = () => contexto.redondeoActual();
  const numero = (el) => { const t = el.value.trim().replace(",", "."); const n = Number(t); return t === "" || !Number.isFinite(n) ? null : n; };
  const costeIn = h("input", { id: "f-coste", type: "text", inputmode: "decimal", autocomplete: "off", value: importeEs(p.coste) });
  const mermaIn = h("input", { id: "f-merma", type: "text", inputmode: "decimal", autocomplete: "off", value: p.merma == null ? "" : String(p.merma).replace(".", ","), placeholder: "0" });
  const margenIn = h("input", { id: "f-margen", type: "text", inputmode: "decimal", autocomplete: "off", value: p.margen == null ? "" : String(p.margen).replace(".", ","), placeholder: String(cfgPrecios().margenDefecto ?? MARGEN_POR_DEFECTO).replace(".", ",") });
  const iva = () => ivaDe(categoria.value);
  const margenObjetivo = () => numero(margenIn) ?? cfgPrecios().margenDefecto ?? MARGEN_POR_DEFECTO;
  const porUnidad = () => (unidad.value === "kg" ? "kg" : "ud");
  // Precio tal y como quedará al guardarlo (con el redondeo ,90/,95 si se vende por kilo)
  const efectivo = () => {
    const n = numero(precio);
    if (n == null || n < 0) return null;
    return redondeoActual() && unidad.value === "kg" ? redondear(n, redondeoActual()) : n;
  };

  const semPildora = h("div", { class: "sem-grande", role: "status" });
  const semDetalle = h("p", { class: "ayuda" });
  const semFuente = h("p", { class: "ayuda fuente-rango" }, orient ? referenciaTexto(orient) : "");
  semFuente.hidden = !orient;
  const marca = h("span", { class: "sem-marca", "aria-hidden": "true", texto: "▲" });
  const zona = h("span", { class: "sem-zona" });
  const barra = h("div", { class: "sem-barra", role: "img" }, zona, marca);
  const refrescarSem = () => {
    const n = efectivo();
    const o = orient;
    const r = semaforo({ precio: n, orientativo: o, coste: numero(costeIn), merma: numero(mermaIn) ?? 0, iva: iva(), margenObjetivo: margenObjetivo() });
    semPildora.replaceChildren(etiquetaSem(r));
    semDetalle.textContent = r.detalle;
    barra.hidden = !o;
    if (o) {
      const lo = o.min * 0.6, hi = o.max * 1.4;
      const pos = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
      zona.style.left = `${pos(o.min)}%`;
      zona.style.width = `${pos(o.max) - pos(o.min)}%`;
      marca.hidden = n == null;
      if (n != null) marca.style.left = `${pos(n)}%`;
      barra.setAttribute("aria-label", `Rango habitual de ${eurosTxt(o.min)} a ${eurosTxt(o.max)}${n != null ? `; tu precio, ${eurosTxt(n)}` : ""}`);
    }
  };

  // --- modo 1: escribirlo directamente (el campo «Precio») ---
  // --- modo 2: desde mi coste ---
  const resultado = h("p", { class: "calc-resultado", role: "status" });
  const usar = h("button", { type: "button", class: "btn-sec", texto: "Usar este precio" });
  let calculado = null;
  const refrescarCoste = () => {
    const c = numero(costeIn);
    const m = numero(mermaIn) ?? 0;
    calculado = null;
    if (c == null || c <= 0) { resultado.textContent = "Escribe lo que te cuesta el kilo (o la unidad) sin IVA y verás el precio de venta."; usar.disabled = true; return; }
    if (m < 0 || m >= 100) { resultado.textContent = "La merma tiene que estar entre 0 y 99 %."; usar.disabled = true; return; }
    calculado = precioDesdeCoste({ coste: c, merma: m, margen: margenObjetivo(), iva: iva(), redondeo: redondeoActual(), unidad: unidad.value });
    resultado.textContent = `Precio de venta calculado: ${eurosTxt(calculado.exacto)}${calculado.precio !== calculado.exacto ? ` → ${eurosTxt(calculado.precio)} con el redondeo ,${redondeoActual()}` : ""} (con ${iva()} % de IVA y un ${String(margenObjetivo()).replace(".", ",")} % sobre el coste).`;
    usar.disabled = false;
  };
  usar.addEventListener("click", () => { if (!calculado) return; precio.value = importeEs(calculado.precio); trabajo = calculado.exacto; refrescarSem(); aviso("Precio puesto en el campo «Precio». Pulsa Guardar para aplicarlo."); });
  const panelCoste = h("div", { class: "calc-panel" },
    h("div", { class: "fila-tres" },
      campo("f-coste", `Coste de compra (€/${porUnidad()}, sin IVA)`, costeIn),
      campo("f-merma", "Merma (%)", mermaIn),
      campo("f-margen", "Recargo sobre coste (%)", margenIn)),
    h("p", { class: "ayuda", texto: "La merma es lo que se pierde al limpiar y cortar (grasa, hueso, recortes). El recargo es lo que pones encima del coste; si lo dejas vacío se usa el general. El IVA sale de la categoría (se cambia en Tienda → Precios y márgenes)." }),
    resultado, usar);

  // --- modo 3: ajustar el orientativo ---
  let trabajo = numero(precio) ?? orient?.precio ?? null;
  const delta = h("p", { class: "calc-resultado", role: "status" });
  const refrescarAjuste = () => {
    const n = efectivo();
    delta.textContent = orient
      ? `Orientativo: ${eurosTxt(orient.precio)} (fiabilidad ${NOMBRE_FIABILIDAD[orient.fiabilidad]}).${n != null && orient.precio ? ` Tu precio está un ${String(Math.round((n / orient.precio - 1) * 1000) / 10).replace(".", ",")} % ${n >= orient.precio ? "por encima" : "por debajo"}.` : ""}`
      : "Este producto no tiene precio orientativo: escribe un precio en el campo «Precio» y ajústalo desde ahí.";
  };
  const aplicarTrabajo = () => { precio.value = importeEs(redondeoActual() && unidad.value === "kg" ? redondear(trabajo, redondeoActual()) : trabajo); refrescarSem(); refrescarAjuste(); };
  const botonPct = (pct) => {
    const b = h("button", { type: "button", class: "btn-sec", texto: `${pct > 0 ? "+" : "−"}${Math.abs(pct)} %`, "aria-label": `${pct > 0 ? "Subir" : "Bajar"} el precio un ${Math.abs(pct)} por ciento` });
    b.addEventListener("click", () => {
      if (trabajo == null || trabajo <= 0) trabajo = orient?.precio ?? null;
      if (trabajo == null) { aviso("Escribe primero un precio en el campo «Precio».", { error: true }); return; }
      trabajo = ajustarPorcentaje(trabajo, pct);
      aplicarTrabajo();
    });
    return b;
  };
  const volver = h("button", { type: "button", class: "btn-sec", texto: "Volver al orientativo", disabled: !orient });
  volver.addEventListener("click", () => { trabajo = orient.precio; aplicarTrabajo(); });
  const panelAjuste = h("div", { class: "calc-panel" },
    h("div", { class: "acciones" }, [-10, -5, -1, 1, 5, 10].map(botonPct), volver),
    delta);

  const panelDirecto = h("div", { class: "calc-panel" }, h("p", { class: "ayuda", texto: "Escribe el precio en el campo «Precio» de arriba. El semáforo te dice si está bien." }));
  const MODOS = [["directo", "Escribirlo yo", panelDirecto], ["coste", "Desde mi coste", panelCoste], ["ajuste", "Ajustar el orientativo", panelAjuste]];
  const radios = MODOS.map(([valor, texto]) => h("label", { class: "modo" }, h("input", { type: "radio", name: "modo-precio", value: valor, checked: valor === (p.coste != null ? "coste" : "directo") }), h("span", { texto })));
  const mostrarModo = () => { const v = radios.find((r) => r.querySelector("input").checked).querySelector("input").value; for (const [valor, , panel] of MODOS) panel.hidden = valor !== v; };
  for (const r of radios) r.querySelector("input").addEventListener("change", mostrarModo);
  const calculadora = h("fieldset", { class: "campo-grupo calculadora" }, h("legend", { texto: "Ayuda para poner el precio" }),
    h("div", { class: "modos", role: "radiogroup", "aria-label": "Cómo quieres poner el precio" }, radios),
    panelDirecto, panelCoste, panelAjuste, semPildora, barra, semDetalle, semFuente);
  precio.addEventListener("input", () => { trabajo = numero(precio); refrescarSem(); refrescarAjuste(); });
  for (const el of [costeIn, mermaIn, margenIn]) el.addEventListener("input", () => { refrescarCoste(); refrescarSem(); });
  categoria.addEventListener("change", () => { refrescarCoste(); refrescarSem(); });
  unidad.addEventListener("change", () => { refrescarCoste(); refrescarSem(); refrescarAjuste(); calculadora.querySelector('label[for="f-coste"]').textContent = `Coste de compra (€/${porUnidad()}, sin IVA)`; });
  mostrarModo(); refrescarCoste(); refrescarSem(); refrescarAjuste();

  // --- ofertas: se crean y se cambian en la pestaña «Ofertas»; aquí solo se resumen ---
  const textoOfertaFicha = (o) => `${o.hasta < hoyIso ? "Terminada" : o.desde > hoyIso ? "Programada" : "Activa hoy"}: ${o.tipo === "precio" ? `rebaja a ${eurosTxt(o.precio)}` : nombreOferta(o)} (${diaMes(o.desde)} al ${diaMes(o.hasta)})`;
  const irOfertas = h("button", { type: "button", class: "btn-sec", texto: "Crear o cambiar ofertas de este producto" });
  irOfertas.addEventListener("click", () => { dlg.close(); contexto.irAOfertas(p); });
  const ofertasGrupo = esNuevo ? null : h("fieldset", { class: "campo-grupo ofertas" }, h("legend", { texto: "Ofertas" }),
    (p.ofertas ?? []).length
      ? h("ul", { class: "ofertas-resumen" }, p.ofertas.map((o) => h("li", { texto: textoOfertaFicha(o) })))
      : h("p", { class: "ayuda", texto: "Este producto no tiene ofertas." }),
    h("div", { class: "acciones" }, irOfertas));

  const formulario = h("form", { novalidate: true, "aria-labelledby": "dlg-titulo" },
    h("h2", { id: "dlg-titulo", texto: esNuevo ? "Nuevo producto" : "Editar producto" }),
    errores,
    campo("f-nombre", "Nombre", nombre),
    campo("f-categoria", "Categoría", categoria),
    campo("f-descripcion", "Descripción corta (opcional)", descripcion),
    h("div", { class: "fila-dos" }, campo("f-unidad", "Se vende", unidad), campo("f-precio", "Precio (€ por kg o por unidad)", precio, "Déjalo vacío para que se vea «Consultar».")),
    ayudaUnidad,
    calculadora,
    ofertasGrupo,
    h("div", { class: "fila-tres" }, campo("f-paso", "Paso", paso), campo("f-minimo", "Mínimo (opcional)", minimo), campo("f-maximo", "Máximo (opcional)", maximo)),
    campo("f-opciones", "Opciones al pedir (opcional)", opciones, "Por ejemplo cómo cortarlo. Si hay opciones, el cliente elige una."),
    campo("f-alergenos", "Alérgenos (opcional)", alergenos, "Separados por comas."),
    h("fieldset", { class: "campo-grupo" }, h("legend", { texto: "Foto" }), vista,
      h("div", { class: "acciones" }, h("label", { class: "btn-sec", for: "f-foto", texto: p.foto ? "Cambiar foto" : "Subir foto" }), quitar), archivo,
      h("p", { class: "ayuda", id: "reglas-foto", texto: `Formatos JPG, PNG o WebP, de cualquier tamaño: se ajusta sola a entre ${LADO_MINIMO} y ${LADO_MAXIMO} px por el lado largo y se guarda como JPG ligero (sin ubicación ni datos ocultos).` }), estadoFoto),
    h("div", { class: "checks" }, cAgotado, cOculto, cAlcohol),
    h("div", { class: "dlg-acciones" }, guardarBtn, cancelar, eliminar));

  formulario.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const sospecha = precioSospechoso(p, precio.value);
    if (sospecha && !confirm(sospecha)) { precio.focus(); return; }
    guardarBtn.disabled = true;
    const lista = (t) => t.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    const num = (el) => (el.value.trim() === "" ? null : Number(el.value));
    const cuerpo = {
      ...(esNuevo ? {} : { id: p.id, orden: p.orden }),
      nombre: nombre.value, categoria: categoria.value, descripcion: descripcion.value, unidad: unidad.value,
      paso: num(paso), minimo: num(minimo), maximo: num(maximo), precio: precio.value.trim() === "" ? null : precio.value,
      coste: costeIn.value.trim() === "" ? null : costeIn.value, merma: mermaIn.value.trim() === "" ? null : mermaIn.value, margen: margenIn.value.trim() === "" ? null : margenIn.value,
      opciones: opciones.value.split("\n").map((x) => x.trim()).filter(Boolean), alergenos: lista(alergenos.value),
      ofertas: p.ofertas ?? [], // se cambian en la pestaña «Ofertas»; aquí se conservan tal cual
      agotado: cAgotado.querySelector("input").checked, oculto: cOculto.querySelector("input").checked, alcohol: cAlcohol.querySelector("input").checked, foto: p.foto,
    };
    const r = await api("/producto", { metodo: "PUT", cuerpo });
    guardarBtn.disabled = false;
    if (!r.ok) { mostrarErrores(errores, r.errores); return; }
    const g = r.datos.producto;
    const i = productos.findIndex((x) => x.id === g.id);
    if (i >= 0) productos[i] = g; else productos.push(g);
    dlg.close();
    pintar();
    aviso(esNuevo ? `«${g.nombre}» añadido.` : "Cambios guardados.");
  });

  dlg.replaceChildren(formulario);
  dlg.addEventListener("close", () => dlg.replaceChildren(), { once: true });
  dlg.showModal();
  nombre.focus();
}

function mostrarErrores(contenedor, errores) {
  contenedor.replaceChildren(h("ul", {}, errores.map((e) => h("li", { texto: describirError(e) }))));
  contenedor.hidden = false;
  contenedor.focus();
}
