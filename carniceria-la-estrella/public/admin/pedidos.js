// Pestaña "Pedidos": lista, cambio de estado, nota interna, borrado y exportación.
import { api, textoErrores } from "./api.js";
import { h, $, euros, cantidad, fechaLarga, fechaHora, aviso, sinAcentos } from "./util.js";

const ESTADOS = [["nuevo", "Nuevo", "Nuevos"], ["confirmado", "Confirmado", "Confirmados"], ["preparado", "Preparado", "Preparados"], ["entregado", "Entregado", "Entregados"], ["cancelado", "Cancelado", "Cancelados"]];
const NOMBRE_PAGO = { efectivo: "Efectivo", tarjeta: "Tarjeta (al recoger)", bizum: "Bizum", transferencia: "Transferencia" };

let pedidos = [];
let filtro = "";
let texto = "";
let alCambiarNuevos = () => {};
let temporizador = null;

export function iniciarPedidos({ cuandoCambienNuevos }) {
  alCambiarNuevos = cuandoCambienNuevos;
  $("pedidos-buscar").addEventListener("input", (e) => { texto = sinAcentos(e.target.value.trim()); pintar(); });
  $("pedidos-actualizar").addEventListener("click", () => cargar({ avisar: true }));
}

export async function cargar({ avisar = false } = {}) {
  const r = await api("/pedidos");
  if (!r.ok) { if (avisar || !pedidos.length) aviso(textoErrores(r.errores), { error: true }); return; }
  pedidos = r.datos.pedidos.sort((a, b) => (a.numero < b.numero ? 1 : -1));
  $("pedidos-hora").textContent = `Actualizado a las ${new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date())}`;
  alCambiarNuevos(pedidos.filter((p) => p.estado === "nuevo").length);
  pintar();
  if (avisar) aviso("Pedidos actualizados.");
}

// Se refresca solo mientras la pestaña de pedidos está a la vista.
export function vigilar(activa) {
  clearInterval(temporizador);
  if (activa) temporizador = setInterval(() => { if (!document.hidden) cargar(); }, 60_000);
}

function pintarFiltros() {
  const cuenta = (e) => pedidos.filter((p) => p.estado === e).length;
  const botones = [["", `Todos (${pedidos.length})`], ...ESTADOS.map(([v, , plural]) => [v, `${plural} (${cuenta(v)})`])];
  $("pedidos-filtros").replaceChildren(...botones.map(([valor, etiqueta]) => h("button", {
    type: "button", class: "chip", "aria-pressed": String(filtro === valor), texto: etiqueta,
    onclick: () => { filtro = valor; pintar(); },
  })));
}

function pintar() {
  pintarFiltros();
  const lista = pedidos.filter((p) => (!filtro || p.estado === filtro)
    && (!texto || sinAcentos(`${p.numero} ${p.cliente.nombre} ${p.cliente.telefono} ${p.entrega.direccion} ${p.entrega.cp ?? ""}`).includes(texto)));
  $("pedidos-vacio").hidden = lista.length > 0;
  $("pedidos-vacio").textContent = pedidos.length ? "No hay pedidos con ese filtro." : "Todavía no ha entrado ningún pedido.";
  $("pedidos-lista").replaceChildren(...lista.map(tarjeta));
}

function tarjeta(p) {
  const en = p.entrega;
  const telefono = p.cliente.telefono;
  const estado = h("select", { id: `estado-${p.numero}`, "aria-label": `Estado del pedido ${p.numero}` },
    ...ESTADOS.map(([v, t]) => h("option", { value: v, texto: t, selected: v === p.estado })));
  estado.addEventListener("change", async () => {
    const r = await api("/pedido", { metodo: "PATCH", cuerpo: { numero: p.numero, estado: estado.value } });
    if (!r.ok) { estado.value = p.estado; aviso(textoErrores(r.errores), { error: true }); return; }
    p.estado = r.datos.pedido.estado;
    aviso(`Pedido ${p.numero}: ${ESTADOS.find(([v]) => v === p.estado)[1].toLowerCase()}.`);
    alCambiarNuevos(pedidos.filter((x) => x.estado === "nuevo").length);
    pintar();
  });

  const nota = h("textarea", { id: `nota-${p.numero}`, rows: "2", maxlength: "500", placeholder: "Nota interna (solo la ves tú)" }, p.notaInterna ?? "");
  nota.addEventListener("change", async () => {
    const r = await api("/pedido", { metodo: "PATCH", cuerpo: { numero: p.numero, notaInterna: nota.value } });
    if (r.ok) { p.notaInterna = nota.value; aviso("Nota guardada."); } else aviso(textoErrores(r.errores), { error: true });
  });

  const borrar = h("button", { type: "button", class: "btn-peligro", texto: "Eliminar pedido" });
  borrar.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar el pedido ${p.numero} de ${p.cliente.nombre}? No se puede deshacer.`)) return;
    const r = await api(`/pedido?numero=${encodeURIComponent(p.numero)}`, { metodo: "DELETE" });
    if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); return; }
    pedidos = pedidos.filter((x) => x.numero !== p.numero);
    alCambiarNuevos(pedidos.filter((x) => x.estado === "nuevo").length);
    pintar();
    aviso(`Pedido ${p.numero} eliminado.`);
  });

  const lineas = p.lineas.map((l) => h("li", {},
    h("span", {}, h("strong", { texto: l.nombre }), ` · ${cantidad(l.cantidad, l.unidad)}`, l.opcion ? ` · ${l.opcion}` : "", l.nota ? h("em", { texto: ` — «${l.nota}»` }) : null),
    h("span", { class: "importe", texto: l.subtotalCent == null ? "Consultar" : euros(l.subtotalCent) })));

  const totales = [`Productos ${euros(p.subtotalCent)}`];
  if (p.envioCent) totales.push(`Envío ${euros(p.envioCent)}`);
  totales.push(`Total ${euros(p.totalCent)}`);

  return h("article", { class: `pedido estado-${p.estado}`, "aria-labelledby": `t-${p.numero}` },
    h("header", { class: "pedido-cab" },
      h("h3", { id: `t-${p.numero}`, texto: p.numero }),
      h("span", { class: `etiqueta e-${p.estado}`, texto: ESTADOS.find(([v]) => v === p.estado)?.[1] ?? p.estado }),
      h("span", { class: "pedido-fecha", texto: fechaHora(p.creado) })),
    h("p", { class: "pedido-cliente" }, h("strong", { texto: p.cliente.nombre }), " · ",
      h("a", { href: `tel:+34${telefono}`, texto: telefono.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4") }), " · ",
      h("a", { href: `https://wa.me/34${telefono}`, target: "_blank", rel: "noopener", texto: "WhatsApp" })),
    h("p", { class: "pedido-entrega" }, h("strong", { texto: en.tipo === "recogida" ? "Recogida en tienda" : "Reparto a domicilio" }),
      ` · ${fechaLarga(en.dia)} · ${en.franja.replace("-", " a ")}`, en.direccion ? h("br") : null, en.direccion ? `📍 ${en.direccion}${en.cp ? ` · ${en.cp}` : ""}` : null,
      en.distanciaKm != null ? ` · a ${String(en.distanciaKm).replace(".", ",")} km de la tienda` : null,
      en.tipo === "reparto" && en.zonaVerificada === false ? h("span", { class: "pendiente", texto: " · ⚠ Dirección por verificar: no se pudo comprobar si está dentro de tu radio de reparto" }) : null),
    h("ul", { class: "pedido-lineas" }, lineas),
    h("p", { class: "pedido-total" }, totales.join(" · "), p.consultar ? h("span", { class: "pendiente", texto: ` · ${p.consultar} producto${p.consultar === 1 ? "" : "s"} por consultar` }) : null),
    h("p", { class: "pedido-pago", texto: `Pago: ${NOMBRE_PAGO[p.pago] ?? p.pago}${p.mayorEdad ? " · Mayor de 18 confirmado" : ""}` }),
    p.comentarios ? h("p", { class: "pedido-comentarios" }, h("strong", { texto: "Comentarios del cliente: " }), p.comentarios) : null,
    h("div", { class: "pedido-acciones" },
      h("div", { class: "campo" }, h("label", { for: estado.id, texto: "Estado" }), estado),
      h("div", { class: "campo" }, h("label", { for: nota.id, texto: "Nota interna" }), nota),
      borrar));
}

