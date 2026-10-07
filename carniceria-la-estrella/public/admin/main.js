// Panel de administración: acceso, pestañas y unión de las distintas partes.
import { api, cuandoCaduque, textoErrores } from "./api.js";
import { h, $, aviso } from "./util.js";
import { iniciarPedidos, cargar as cargarPedidos, vigilar } from "./pedidos.js";
import { iniciarProductos, cargarProductos, productosConPrecio, productosSinPrecio, orientativosPendientes, datosPrecios } from "./productos.js";
import { iniciarAjustes, cargarAjustes, enviar, ajustesBorrador, refrescarTienda, fijarCategorias } from "./ajustes.js";

const TITULO = "Panel · La Estrella";
let guardado = null; // ajustes tal y como están en el servidor
let sinGuardar = false;
let nuevos = 0;

// ---------- acceso ----------
function mostrarAcceso(mensaje) {
  $("panel").hidden = true;
  $("acceso").hidden = false;
  $("acceso-error").textContent = mensaje ?? "";
  $("acceso-error").hidden = !mensaje;
  vigilar(false);
  $("password").focus();
}

cuandoCaduque(() => mostrarAcceso("La sesión ha caducado. Vuelve a entrar."));

$("form-acceso").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const boton = $("acceso-enviar");
  boton.disabled = true;
  const r = await api("/login", { metodo: "POST", cuerpo: { password: $("password").value } });
  boton.disabled = false;
  if (!r.ok) {
    $("acceso-error").textContent = r.estado === 401 ? "Contraseña incorrecta." : textoErrores(r.errores);
    $("acceso-error").hidden = false;
    $("password").select();
    return;
  }
  $("password").value = "";
  await abrirPanel();
});

$("salir").addEventListener("click", async () => {
  if (sinGuardar && !confirm("Hay cambios sin guardar. ¿Salir igualmente?")) return;
  await api("/logout", { metodo: "POST" });
  sinGuardar = false;
  mostrarAcceso();
});

// ---------- pestañas ----------
const PESTANAS = ["pedidos", "productos", "tienda", "negocio", "estado"];
function irA(nombre, { enfocar = false } = {}) {
  for (const p of PESTANAS) {
    const boton = $(`tab-${p}`);
    const activa = p === nombre;
    boton.setAttribute("aria-selected", String(activa));
    boton.tabIndex = activa ? 0 : -1;
    $(`panel-${p}`).hidden = !activa;
    if (activa && enfocar) boton.focus();
  }
  vigilar(nombre === "pedidos");
  if (nombre === "pedidos") cargarPedidos();
  if (nombre === "estado") pintarEstado();
  history.replaceState(null, "", `#${nombre}`);
}
for (const p of PESTANAS) {
  $(`tab-${p}`).addEventListener("click", () => irA(p));
  $(`tab-${p}`).addEventListener("keydown", (e) => {
    const i = PESTANAS.indexOf(p);
    const destino = e.key === "ArrowRight" ? PESTANAS[(i + 1) % PESTANAS.length] : e.key === "ArrowLeft" ? PESTANAS[(i + PESTANAS.length - 1) % PESTANAS.length] : e.key === "Home" ? PESTANAS[0] : e.key === "End" ? PESTANAS.at(-1) : null;
    if (destino) { e.preventDefault(); irA(destino, { enfocar: true }); }
  });
}

function marcarNuevos(n) {
  nuevos = n;
  const el = $("contador-nuevos");
  el.textContent = n ? String(n) : "";
  el.hidden = !n;
  $("tab-pedidos").setAttribute("aria-label", n ? `Pedidos, ${n} nuevos` : "Pedidos");
  document.title = n ? `(${n}) ${TITULO}` : TITULO;
}

// ---------- ajustes ----------
async function guardarAjustesServidor(ajustes) {
  return api("/ajustes", { metodo: "PUT", cuerpo: ajustes });
}

iniciarAjustes({
  guardar: async (b) => {
    const r = await guardarAjustesServidor(b);
    if (r.ok) { guardado = structuredClone(r.datos.ajustes); sinGuardar = false; }
    return r;
  },
  cuandoCambie: (v) => { sinGuardar = v; $("sin-guardar").hidden = !v; },
  guardados: () => guardado,
});
for (const cual of ["tienda", "negocio"]) {
  $(`form-${cual}`).addEventListener("submit", async (ev) => { ev.preventDefault(); if (await enviar(cual)) { pintarEstado(); recargarProductos(); } });
}
window.addEventListener("beforeunload", (e) => { if (sinGuardar) { e.preventDefault(); e.returnValue = ""; } });

iniciarPedidos({ cuandoCambienNuevos: marcarNuevos });

iniciarProductos({
  redondeoActual: () => guardado?.tienda.redondeo ?? null,
  preciosCfg: () => guardado?.tienda.precios ?? { margenDefecto: 30, iva: {} },
  async guardarRedondeo(valor) {
    const base = structuredClone(guardado);
    base.tienda.redondeo = valor;
    const r = await guardarAjustesServidor(base);
    if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); return false; }
    guardado.tienda.redondeo = valor;
    ajustesBorrador().tienda.redondeo = valor; // sin tocar lo que haya a medio escribir en las otras pestañas
    refrescarTienda();
    aviso(valor ? `Los precios por kilo se redondearán a ,${valor} al guardarlos.` : "Redondeo desactivado.");
    return true;
  },
  recargar: recargarProductos,
});

async function recargarProductos() {
  const r = await api("/datos");
  if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); return; }
  cargarProductos({ productos: r.datos.productos, categorias: r.datos.categorias, orientativos: r.datos.orientativos, meta: r.datos.meta });
}

// ---------- estado y lista de comprobación ----------
function comprobaciones() {
  const a = guardado;
  if (!a) return [];
  const t = a.tienda;
  const lista = [];
  const punto = (ok, texto, ir) => lista.push({ ok, texto, ir });
  punto(!!(a.negocio.razonSocial && a.negocio.nif), "Razón social y NIF rellenos (aparecen en el aviso legal y la política de privacidad).", "negocio");
  punto(!!a.seo.dominio, "Dirección de la web indicada (para el mapa del sitio y los datos de Google).", "negocio");
  punto(productosConPrecio() > 0, `Hay ${productosConPrecio()} productos con precio (${productosSinPrecio()} se verán como «Consultar»).`, "productos");
  punto(t.recogida.activa ? t.recogida.franjas.length > 0 : true, "La recogida tiene franjas horarias.", "tienda");
  punto(t.reparto.activo ? !!t.reparto.zona && t.reparto.franjas.length > 0 : true, "El reparto tiene zona y franjas horarias.", "tienda");
  punto(!t.pagos.bizum || !!t.pagos.bizumNumero, "Bizum activado con su número.", "tienda");
  punto(!t.pagos.transferencia || !!t.pagos.transferenciaDatos, "Transferencia activada con sus datos.", "tienda");
  const { fechaPrecios, fechaReferencia } = datosPrecios();
  const dias = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)); // sin negativos aunque el reloj del navegador vaya algo atrasado
  punto(fechaPrecios != null && dias(fechaPrecios) <= 7, fechaPrecios ? `Los precios se actualizaron hace ${dias(fechaPrecios)} día${dias(fechaPrecios) === 1 ? "" : "s"}${dias(fechaPrecios) > 7 ? ": conviene repasarlos (los precios cambian a menudo)" : ""}.` : "Todavía no hay fecha de actualización de precios (se pone sola al cambiar un precio, o con «Los precios están al día»).", "productos");
  punto(fechaReferencia != null && dias(`${fechaReferencia}-28`) <= 75, fechaReferencia && dias(`${fechaReferencia}-28`) > 75 ? `Los rangos de mercado del semáforo son de ${fechaReferencia}: tienen más de dos meses y no se actualizan solos.` : "Los rangos de mercado del semáforo son recientes (estimación propia, no oficial).", "productos");
  const pend = orientativosPendientes();
  punto(pend === 0, pend ? `Hay ${pend} productos con precio orientativo sin aceptar: en la tienda se ven como «Consultar» hasta que los aceptes o pongas el tuyo.` : "No quedan precios orientativos por revisar.", "productos");
  punto(t.activa, t.activa ? "La tienda está abierta a los clientes." : "La tienda está cerrada: los botones de pedir llevan a WhatsApp.", "tienda");
  return lista;
}

function pintarEstado() {
  const items = comprobaciones();
  $("lista-comprobacion").replaceChildren(...items.map((i) => h("li", { class: i.ok ? "ok" : "pendiente" },
    h("span", { class: "marca", "aria-hidden": "true", texto: i.ok ? "✓" : "!" }),
    h("span", {}, h("span", { class: "sr-only", texto: i.ok ? "Hecho: " : "Pendiente: " }), i.texto),
    i.ok ? null : h("button", { type: "button", class: "btn-sec", texto: "Revisar", onclick: () => irA(i.ir, { enfocar: true }) }))));
}

$("diagnostico").addEventListener("click", async () => {
  const boton = $("diagnostico");
  boton.disabled = true;
  const r = await api("/diagnostico");
  boton.disabled = false;
  const salida = $("diagnostico-resultado");
  salida.hidden = false;
  if (!r.ok) { salida.textContent = textoErrores(r.errores); return; }
  const { configuracion, escrituraLectura, numerosUnicos, edicionesSimultaneas } = r.datos;
  salida.replaceChildren(
    h("p", {}, h("strong", { texto: "Configuración: " }), Array.isArray(configuracion) ? configuracion.join(" ") : configuracion),
    h("p", {}, h("strong", { texto: "Guardado de datos: " }), escrituraLectura),
    h("p", {}, h("strong", { texto: "Números de pedido únicos: " }), numerosUnicos ?? "—"),
    h("p", {}, h("strong", { texto: "Ediciones a la vez: " }), edicionesSimultaneas ?? "—"));
});

// ---------- arranque ----------
async function abrirPanel() {
  const r = await api("/datos");
  if (!r.ok) { mostrarAcceso(r.estado === 401 ? undefined : textoErrores(r.errores)); return; }
  $("acceso").hidden = true;
  $("panel").hidden = false;
  guardado = structuredClone(r.datos.ajustes);
  fijarCategorias(r.datos.categorias);
  cargarAjustes(r.datos.ajustes);
  cargarProductos({ productos: r.datos.productos, categorias: r.datos.categorias, orientativos: r.datos.orientativos, meta: r.datos.meta });
  const inicial = PESTANAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "pedidos";
  if (inicial !== "pedidos") await cargarPedidos(); // para el contador de nuevos
  irA(inicial); // la pestaña de pedidos carga su lista al abrirse
}

(async () => {
  const r = await api("/yo");
  if (r.ok) await abrirPanel();
  else mostrarAcceso(r.estado === 503 ? textoErrores(r.errores) : undefined);
})();
