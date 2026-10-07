// Pestaña "Productos": lista con precio y "agotado" editables en el momento, y un editor completo.
import { api, textoErrores } from "./api.js";
import { h, $, importeEs, aviso, sinAcentos, describirError } from "./util.js";
import { prepararFoto } from "./fotos.js";

let productos = [];
let categorias = [];
let contexto = null; // { redondeoActual(), guardarRedondeo(valor), recargar() }
let busqueda = "";
let categoriaFiltro = "";

export function iniciarProductos(ctx) {
  contexto = ctx;
  $("prod-buscar").addEventListener("input", (e) => { busqueda = sinAcentos(e.target.value.trim()); pintar(); });
  $("prod-categoria").addEventListener("change", (e) => { categoriaFiltro = e.target.value; pintar(); });
  $("prod-nuevo").addEventListener("click", () => abrirEditor(null));
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

export function cargarProductos({ productos: lista, categorias: cats }) {
  productos = lista;
  categorias = cats;
  const sel = $("prod-categoria");
  const previo = sel.value;
  sel.replaceChildren(h("option", { value: "", texto: "Todas las categorías" }), ...categorias.map((c) => h("option", { value: c.id, texto: c.nombre })));
  sel.value = categorias.some((c) => c.id === previo) ? previo : "";
  categoriaFiltro = sel.value;
  $("prod-redondeo").value = contexto.redondeoActual() ?? "";
  $("prod-redondear").disabled = !contexto.redondeoActual();
  pintar();
}

export const productosSinPrecio = () => productos.filter((p) => !p.oculto && p.precio == null).length;
export const productosConPrecio = () => productos.filter((p) => p.precio != null).length;

const nombreCategoria = (id) => categorias.find((c) => c.id === id)?.nombre ?? id;
const unidadTexto = (p) => (p.unidad === "kg" ? "€/kg" : "€/ud");

function pintar() {
  const lista = productos
    .filter((p) => (!categoriaFiltro || p.categoria === categoriaFiltro)
      && (!busqueda || sinAcentos(`${p.nombre} ${nombreCategoria(p.categoria)}`).includes(busqueda)))
    .sort((a, b) => categorias.findIndex((c) => c.id === a.categoria) - categorias.findIndex((c) => c.id === b.categoria) || a.orden - b.orden);
  $("prod-contador").textContent = `${lista.length} de ${productos.length} productos · ${productosSinPrecio()} sin precio`;
  $("prod-lista").replaceChildren(...lista.map(fila));
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
  precio.addEventListener("change", async () => {
    const antes = p.precio;
    const g = await guardar(p, { precio: precio.value.trim() === "" ? null : precio.value }, { estado, alFallar: () => { precio.value = importeEs(antes); } });
    if (g) { precio.value = importeEs(g.precio); if (g.precio == null) estado.textContent = "✓ Sin precio (se verá «Consultar»)"; }
  });
  const agotado = h("input", { type: "checkbox", id: `ag-${p.id}`, checked: !!p.agotado });
  agotado.addEventListener("change", async () => {
    await guardar(p, { agotado: agotado.checked }, { estado, alFallar: () => { agotado.checked = !agotado.checked; } });
    pintarEtiquetas(fila_);
  });
  const editar = h("button", { type: "button", class: "btn-sec", texto: "Editar", "aria-label": `Editar ${p.nombre}` });
  editar.addEventListener("click", () => abrirEditor(p));
  const etiquetas = h("span", { class: "etiquetas" });
  const fila_ = h("div", { class: "prod-fila" },
    h("div", { class: "prod-nombre" }, h("strong", { texto: p.nombre }), h("small", { texto: nombreCategoria(p.categoria) }), etiquetas),
    h("label", { class: "precio" }, precio, h("span", { texto: unidadTexto(p) })),
    h("label", { class: "interruptor", for: agotado.id }, agotado, h("span", { texto: "Agotado" })),
    editar, estado);
  const pintarEtiquetas = () => {
    etiquetas.replaceChildren(...[p.oculto && "Oculto", p.agotado && "Agotado", p.foto && "Con foto", p.alcohol && "+18"].filter(Boolean).map((t) => h("span", { class: "mini", texto: t })));
  };
  pintarEtiquetas();
  return fila_;
}

// ---------- editor ----------
function abrirEditor(original) {
  const esNuevo = !original;
  const p = original ? structuredClone(original) : { nombre: "", categoria: categoriaFiltro || categorias[0].id, descripcion: "", unidad: "kg", paso: 250, minimo: null, maximo: null, precio: null, agotado: false, oculto: false, opciones: [], foto: null, alcohol: false, alergenos: [] };
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
  const archivo = h("input", { id: "f-foto", type: "file", accept: "image/*", class: "sr-only" });
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
      const blob = await prepararFoto(f);
      estadoFoto.textContent = "Subiendo la foto…";
      const r = await api("/foto", { metodo: "POST", bytes: blob, tipo: "image/jpeg" });
      if (!r.ok) throw new Error(textoErrores(r.errores));
      p.foto = r.datos.id;
      estadoFoto.textContent = "Foto subida. Pulsa «Guardar» para aplicarla al producto.";
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

  const formulario = h("form", { novalidate: true, "aria-labelledby": "dlg-titulo" },
    h("h2", { id: "dlg-titulo", texto: esNuevo ? "Nuevo producto" : "Editar producto" }),
    errores,
    campo("f-nombre", "Nombre", nombre),
    campo("f-categoria", "Categoría", categoria),
    campo("f-descripcion", "Descripción corta (opcional)", descripcion),
    h("div", { class: "fila-dos" }, campo("f-unidad", "Se vende", unidad), campo("f-precio", "Precio (€ por kg o por unidad)", precio, "Déjalo vacío para que se vea «Consultar».")),
    ayudaUnidad,
    h("div", { class: "fila-tres" }, campo("f-paso", "Paso", paso), campo("f-minimo", "Mínimo (opcional)", minimo), campo("f-maximo", "Máximo (opcional)", maximo)),
    campo("f-opciones", "Opciones al pedir (opcional)", opciones, "Por ejemplo cómo cortarlo. Si hay opciones, el cliente elige una."),
    campo("f-alergenos", "Alérgenos (opcional)", alergenos, "Separados por comas."),
    h("fieldset", { class: "campo-grupo" }, h("legend", { texto: "Foto" }), vista,
      h("div", { class: "acciones" }, h("label", { class: "btn-sec", for: "f-foto", texto: p.foto ? "Cambiar foto" : "Subir foto" }), quitar), archivo, estadoFoto),
    h("div", { class: "checks" }, cAgotado, cOculto, cAlcohol),
    h("div", { class: "dlg-acciones" }, guardarBtn, cancelar, eliminar));

  formulario.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    guardarBtn.disabled = true;
    const lista = (t) => t.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    const num = (el) => (el.value.trim() === "" ? null : Number(el.value));
    const cuerpo = {
      ...(esNuevo ? {} : { id: p.id, orden: p.orden }),
      nombre: nombre.value, categoria: categoria.value, descripcion: descripcion.value, unidad: unidad.value,
      paso: num(paso), minimo: num(minimo), maximo: num(maximo), precio: precio.value.trim() === "" ? null : precio.value,
      opciones: opciones.value.split("\n").map((x) => x.trim()).filter(Boolean), alergenos: lista(alergenos.value),
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
