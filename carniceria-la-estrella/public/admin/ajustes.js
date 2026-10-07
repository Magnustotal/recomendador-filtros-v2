// Pestañas "Tienda" y "Negocio": formularios sobre una copia de los ajustes (el "borrador").
// Nada se envía hasta pulsar «Guardar»; el servidor vuelve a validarlo todo.
import { h, $, importeEs, fechaLarga, DIAS, aviso, describirError } from "./util.js";

let borrador = null;
let guardarAjustes = async () => ({ ok: false, errores: [] });
let alCambiar = () => {};
let ajustesGuardados = () => null;
let categorias = [];
export const fijarCategorias = (c) => { categorias = c; };

export function iniciarAjustes({ guardar, cuandoCambie, guardados }) {
  guardarAjustes = guardar;
  alCambiar = cuandoCambie;
  ajustesGuardados = guardados;
}

export function cargarAjustes(ajustes) {
  borrador = structuredClone(ajustes);
  pintarTienda();
  pintarNegocio();
  alCambiar(false);
}

const leer = (obj, ruta) => ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function escribir(obj, ruta, valor) {
  const trozos = ruta.split(".");
  const ultimo = trozos.pop();
  trozos.reduce((o, k) => o[k], obj)[ultimo] = valor;
  alCambiar(true);
}

// ---------- piezas ----------
function entrada(ruta, etiqueta, { tipo = "texto", ayuda, max, placeholder, area = false, id } = {}) {
  const idc = id ?? `a-${ruta.replace(/\./g, "-")}`;
  const valor = leer(borrador, ruta);
  let control;
  if (area) control = h("textarea", { id: idc, rows: "3", maxlength: max, placeholder }, valor ?? "");
  else {
    const dinero = tipo === "dinero";
    const entero = tipo === "entero";
    control = h("input", {
      id: idc, type: "text", maxlength: max, placeholder, autocomplete: "off",
      inputmode: dinero || entero || tipo === "coord" ? (entero ? "numeric" : "decimal") : undefined,
      value: dinero ? importeEs(valor) : valor ?? "",
    });
  }
  control.dataset.ruta = ruta;
  control.addEventListener("input", () => {
    const v = control.value;
    if (tipo === "entero") escribir(borrador, ruta, v.trim() === "" ? null : Number(v));
    else if (tipo === "dinero" || tipo === "coord") escribir(borrador, ruta, v.trim() === "" ? null : v);
    else escribir(borrador, ruta, v);
  });
  return h("div", { class: "campo" }, h("label", { for: idc, texto: etiqueta }), control, ayuda ? h("p", { class: "ayuda", texto: ayuda }) : null);
}

function interruptor(ruta, etiqueta, ayuda) {
  const id = `a-${ruta.replace(/\./g, "-")}`;
  const control = h("input", { id, type: "checkbox", checked: !!leer(borrador, ruta) });
  control.dataset.ruta = ruta;
  control.addEventListener("change", () => escribir(borrador, ruta, control.checked));
  return h("div", { class: "campo check" }, h("label", { for: id }, control, h("span", { texto: etiqueta })), ayuda ? h("p", { class: "ayuda", texto: ayuda }) : null);
}

function dias(ruta, etiqueta) {
  const lista = () => leer(borrador, ruta);
  const grupo = h("div", { class: "dias", role: "group", "aria-label": etiqueta });
  for (const [n, corto, largo] of DIAS) {
    const b = h("button", { type: "button", class: "dia", "aria-pressed": String(lista().includes(n)), "aria-label": largo, texto: corto });
    b.addEventListener("click", () => {
      const actual = new Set(lista());
      actual.has(n) ? actual.delete(n) : actual.add(n);
      escribir(borrador, ruta, [...actual].sort((a, b) => a - b));
      b.setAttribute("aria-pressed", String(actual.has(n)));
    });
    grupo.append(b);
  }
  return grupo;
}

function franjas(ruta, etiqueta) {
  const cont = h("div", { class: "franjas" });
  const pintar = () => {
    const lista = leer(borrador, ruta);
    const desde = h("input", { type: "time", id: `${ruta}-d`, "aria-label": `${etiqueta}: desde`, value: "10:00" });
    const hasta = h("input", { type: "time", id: `${ruta}-h`, "aria-label": `${etiqueta}: hasta`, value: "12:00" });
    const anadir = h("button", { type: "button", class: "btn-sec", texto: "Añadir franja" });
    anadir.addEventListener("click", () => {
      const f = `${desde.value}-${hasta.value}`;
      if (!desde.value || !hasta.value || desde.value >= hasta.value) { aviso("La hora de fin debe ser posterior a la de inicio.", { error: true }); return; }
      if (lista.includes(f)) return;
      escribir(borrador, ruta, [...lista, f].sort());
      pintar();
    });
    cont.replaceChildren(
      h("ul", { class: "etiquetas-lista", "aria-label": etiqueta }, lista.length ? lista.map((f) => h("li", {}, f.replace("-", " a "),
        h("button", { type: "button", class: "quitar", "aria-label": `Quitar franja ${f.replace("-", " a ")}`, texto: "×", onclick: () => { escribir(borrador, ruta, lista.filter((x) => x !== f)); pintar(); } }))) : [h("li", { class: "vacio", texto: "Sin franjas" })]),
      h("div", { class: "nueva-franja" }, h("span", { texto: "De" }), desde, h("span", { texto: "a" }), hasta, anadir));
  };
  pintar();
  return cont;
}

// Códigos postales de reparto: se pueden pegar varios de golpe (separados por comas, espacios o líneas).
function codigosPostales(ruta) {
  const cont = h("div", {});
  const pintar = () => {
    const lista = leer(borrador, ruta) ?? [];
    const entradaCp = h("input", { type: "text", id: "nuevo-cp", inputmode: "numeric", autocomplete: "off", placeholder: "41008, 41009…", "aria-label": "Añadir códigos postales" });
    entradaCp.dataset.ruta = ruta;
    const anadir = h("button", { type: "button", class: "btn-sec", texto: "Añadir" });
    const incorporar = () => {
      const nuevos = entradaCp.value.split(/[\s,;]+/).filter(Boolean);
      const malos = nuevos.filter((c) => !/^\d{5}$/.test(c));
      if (malos.length) { aviso(`No es un código postal de 5 cifras: ${malos.slice(0, 3).join(", ")}`, { error: true }); return; }
      if (!nuevos.length) return;
      escribir(borrador, ruta, [...new Set([...lista, ...nuevos])].sort());
      pintar();
      $("nuevo-cp").focus();
    };
    anadir.addEventListener("click", incorporar);
    entradaCp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); incorporar(); } });
    cont.replaceChildren(
      h("ul", { class: "etiquetas-lista", "aria-label": "Códigos postales de reparto" }, lista.length ? lista.map((c) => h("li", {}, c,
        h("button", { type: "button", class: "quitar", "aria-label": `Quitar el código postal ${c}`, texto: "×", onclick: () => { escribir(borrador, ruta, lista.filter((x) => x !== c)); pintar(); } }))) : [h("li", { class: "vacio", texto: "Ninguno" })]),
      h("div", { class: "nueva-franja" }, entradaCp, anadir));
  };
  pintar();
  return cont;
}

function aviso_zona(texto) { return h("p", { class: "ayuda", texto }); }

function fecha(ruta) {
  const cont = h("div", {});
  const pintar = () => {
    const lista = leer(borrador, ruta);
    const entradaF = h("input", { type: "date", id: "f-sin-servicio", "aria-label": "Fecha sin servicio" });
    const anadir = h("button", { type: "button", class: "btn-sec", texto: "Añadir día" });
    anadir.addEventListener("click", () => {
      if (!entradaF.value || lista.includes(entradaF.value)) return;
      escribir(borrador, ruta, [...lista, entradaF.value].sort());
      pintar();
    });
    cont.replaceChildren(
      h("ul", { class: "etiquetas-lista", "aria-label": "Días sin servicio" }, lista.length ? lista.map((f) => h("li", {}, fechaLarga(f),
        h("button", { type: "button", class: "quitar", "aria-label": `Quitar ${fechaLarga(f)}`, texto: "×", onclick: () => { escribir(borrador, ruta, lista.filter((x) => x !== f)); pintar(); } }))) : [h("li", { class: "vacio", texto: "Ninguno" })]),
      h("div", { class: "nueva-franja" }, entradaF, anadir));
  };
  pintar();
  return cont;
}

function horario() {
  const cont = h("div", { class: "horario" });
  const pintar = () => {
    const filas = borrador.horario.map((t, i) => {
      const abre = h("input", { type: "time", "aria-label": `Tramo ${i + 1}: abre`, value: t.abre });
      const cierra = h("input", { type: "time", "aria-label": `Tramo ${i + 1}: cierra`, value: t.cierra });
      abre.addEventListener("input", () => { t.abre = abre.value; alCambiar(true); });
      cierra.addEventListener("input", () => { t.cierra = cierra.value; alCambiar(true); });
      const grupo = h("div", { class: "dias", role: "group", "aria-label": `Tramo ${i + 1}: días` });
      for (const [n, corto, largo] of DIAS) {
        const b = h("button", { type: "button", class: "dia", "aria-pressed": String(t.dias.includes(n)), "aria-label": largo, texto: corto });
        b.addEventListener("click", () => {
          const s = new Set(t.dias); s.has(n) ? s.delete(n) : s.add(n);
          t.dias = [...s].sort((a, b) => a - b); b.setAttribute("aria-pressed", String(s.has(n))); alCambiar(true);
        });
        grupo.append(b);
      }
      return h("div", { class: "tramo" }, h("p", { class: "tramo-titulo", texto: `Tramo ${i + 1}` }), grupo,
        h("div", { class: "nueva-franja" }, h("span", { texto: "Abre" }), abre, h("span", { texto: "Cierra" }), cierra,
          h("button", { type: "button", class: "btn-peligro", texto: "Quitar tramo", "aria-label": `Quitar tramo ${i + 1}`, onclick: () => { borrador.horario.splice(i, 1); alCambiar(true); pintar(); } })));
    });
    cont.replaceChildren(...filas, h("button", { type: "button", class: "btn-sec", texto: "Añadir tramo", onclick: () => { borrador.horario.push({ dias: [1, 2, 3, 4, 5], abre: "09:00", cierra: "14:00" }); alCambiar(true); pintar(); } }));
  };
  pintar();
  return cont;
}

function grupo(titulo, ...hijos) {
  return h("fieldset", { class: "campo-grupo" }, h("legend", { texto: titulo }), ...hijos);
}

function selectRedondeo() {
  const id = "a-tienda-redondeo";
  const sel = h("select", { id }, h("option", { value: "", texto: "Sin redondeo" }), h("option", { value: "90", texto: "Terminar en ,90" }), h("option", { value: "95", texto: "Terminar en ,95" }));
  sel.value = borrador.tienda.redondeo ? String(borrador.tienda.redondeo) : "";
  sel.dataset.ruta = "tienda.redondeo";
  sel.addEventListener("change", () => escribir(borrador, "tienda.redondeo", sel.value ? Number(sel.value) : null));
  return h("div", { class: "campo" }, h("label", { for: id, texto: "Redondeo del precio por kilo" }), sel,
    h("p", { class: "ayuda", texto: "Al guardar un precio por kilo se sube al siguiente que termine así (14,31 → 14,90). No afecta a lo que se vende por unidades." }));
}

// ---------- pestaña Tienda ----------
function pintarTienda() {
  const f = $("form-tienda");
  f.replaceChildren(
    grupo("Estado de la tienda",
      interruptor("tienda.activa", "Tienda abierta: los clientes pueden hacer pedidos online", "Con la tienda cerrada, la web sigue funcionando y los botones de pedir llevan a WhatsApp."),
      entrada("tienda.aviso", "Aviso en la tienda (opcional)", { area: true, max: 300, ayuda: "Se muestra arriba de la tienda. Por ejemplo: «Esta semana no hay reparto el viernes»." })),
    grupo("Pedidos",
      entrada("tienda.pedidoMinimo", "Pedido mínimo (€, opcional)", { tipo: "dinero", ayuda: "Solo se exige cuando todos los productos del pedido tienen precio." }),
      selectRedondeo(),
      entrada("tienda.antelacionHoras", "Antelación mínima (horas)", { tipo: "entero", ayuda: "Para pedidos del mismo día: horas que necesitas para prepararlos." }),
      entrada("tienda.diasMaximos", "Hasta cuántos días vista se puede pedir", { tipo: "entero" }),
      h("div", { class: "campo" }, h("p", { class: "etiqueta-grupo", texto: "Días sin servicio (festivos, vacaciones)" }), fecha("tienda.diasSinServicio"))),
    grupo("Recogida en tienda",
      interruptor("tienda.recogida.activa", "Ofrecer recogida en tienda"),
      h("div", { class: "campo" }, h("p", { class: "etiqueta-grupo", texto: "Días de recogida" }), dias("tienda.recogida.dias", "Días de recogida")),
      h("div", { class: "campo" }, h("p", { class: "etiqueta-grupo", texto: "Franjas de recogida" }), franjas("tienda.recogida.franjas", "Franjas de recogida"),
        aviso_zona("Las franjas de recogida deben caer dentro del horario de la tienda de ese día; las que no, no se ofrecen."))),
    grupo("Reparto a domicilio",
      interruptor("tienda.reparto.activo", "Ofrecer reparto a domicilio"),
      entrada("tienda.reparto.zona", "Descripción de la zona (opcional)", { max: 200, ayuda: "Texto libre que ve el cliente, por ejemplo «La Barzola, Los Príncipes y alrededores»." }),
      h("div", { class: "campo" }, h("p", { class: "etiqueta-grupo", texto: "Códigos postales donde repartes" }), codigosPostales("tienda.reparto.codigosPostales"),
        aviso_zona("Puedes pegar varios a la vez. Si pones solo códigos postales, el cliente tiene que escribir uno de la lista para poder pedir reparto.")),
      entrada("tienda.reparto.radioKm", "Radio de reparto desde la tienda (km, opcional)", { tipo: "coord", placeholder: "Ej. 3", ayuda: "Distancia en línea recta desde las coordenadas de la tienda (pestaña Negocio). Si pones también códigos postales, vale cualquiera de las dos cosas: los de la lista entran siempre y el resto se comprueba por distancia. Para medirla se localiza la dirección del cliente con OpenStreetMap; si no la encuentra, el pedido entra marcado «dirección por verificar» para que lo mires tú." }),
      entrada("tienda.reparto.minimo", "Pedido mínimo para reparto (€, opcional)", { tipo: "dinero" }),
      entrada("tienda.reparto.coste", "Coste del envío (€, vacío = sin coste)", { tipo: "dinero" }),
      entrada("tienda.reparto.gratisDesde", "Envío gratis a partir de (€, opcional)", { tipo: "dinero" }),
      h("div", { class: "campo" }, h("p", { class: "etiqueta-grupo", texto: "Días de reparto" }), dias("tienda.reparto.dias", "Días de reparto")),
      h("div", { class: "campo" }, h("p", { class: "etiqueta-grupo", texto: "Franjas de reparto" }), franjas("tienda.reparto.franjas", "Franjas de reparto")),
      entrada("tienda.textoEntrega", "Texto sobre el reparto (opcional)", { area: true, max: 300 })),
    grupo("Precios y márgenes",
      aviso_zona("Datos para la calculadora y el semáforo del precio (pestaña Productos). Solo los ves tú."),
      entrada("tienda.precios.margenDefecto", "Recargo habitual sobre el coste (%)", { tipo: "coord", ayuda: "Lo que sueles poner encima de lo que te cuesta. Por ejemplo, 30 = un 30 % sobre el coste. Cada producto puede tener el suyo." }),
      h("details", { class: "ayuda-desplegable" }, h("summary", { texto: "IVA por categoría (%)" }),
        aviso_zona("Son tipos de partida que he puesto yo (carne y casi todo, 10 %; huevos, 4 %; vino, 21 %). Confírmalos con tu gestoría y cámbialos si no coinciden."),
        h("div", { class: "rejilla-iva" }, categorias.map((c) => entrada(`tienda.precios.iva.${c.id}`, c.nombre, { tipo: "coord" }))))),
    grupo("Formas de pago (siempre al recoger o recibir; la web no cobra)",
      interruptor("tienda.pagos.efectivo", "Efectivo"),
      interruptor("tienda.pagos.tarjetaRecogida", "Tarjeta (solo al recoger en tienda)"),
      interruptor("tienda.pagos.bizum", "Bizum"),
      entrada("tienda.pagos.bizumNumero", "Número de Bizum", { max: 30, ayuda: "Solo lo ves tú; se lo das al cliente por WhatsApp al confirmar." }),
      interruptor("tienda.pagos.transferencia", "Transferencia bancaria"),
      entrada("tienda.pagos.transferenciaDatos", "Datos para la transferencia", { max: 200, ayuda: "IBAN y titular. Solo lo ves tú." })),
    botonesGuardar("tienda"));
}

// ---------- pestaña Negocio ----------
function pintarNegocio() {
  const f = $("form-negocio");
  f.replaceChildren(
    grupo("Datos del negocio",
      entrada("negocio.nombre", "Nombre comercial", { max: 80 }),
      entrada("negocio.razonSocial", "Razón social (para los textos legales)", { max: 120, ayuda: "Nombre legal del titular. Aparece en el aviso legal y la política de privacidad." }),
      entrada("negocio.nif", "NIF / CIF", { max: 20 }),
      entrada("negocio.email", "Correo electrónico", { max: 120, ayuda: "Aparece en el aviso legal y en la información sobre devoluciones: la ley lo pide a quien vende a distancia." }),
      entrada("negocio.telefono", "Teléfono (también es el WhatsApp)", { max: 20, ayuda: "9 cifras, de España." })),
    grupo("Dirección y mapa",
      entrada("negocio.calle", "Calle y número", { max: 120 }),
      entrada("negocio.cp", "Código postal", { max: 5 }),
      entrada("negocio.localidad", "Localidad", { max: 80 }),
      entrada("negocio.provincia", "Provincia", { max: 80 }),
      entrada("negocio.region", "Comunidad autónoma", { max: 80 }),
      entrada("negocio.barrio", "Barrio", { max: 120 }),
      entrada("negocio.distrito", "Distrito", { max: 120 }),
      entrada("negocio.lat", "Latitud del mapa", { tipo: "coord", ayuda: "En Google Maps: clic derecho sobre el local y se copian las coordenadas (37.4119071)." }),
      entrada("negocio.lng", "Longitud del mapa", { tipo: "coord", ayuda: "Por ejemplo -5.9763565." }),
      entrada("negocio.mapsUrl", "Enlace de Google Maps", { max: 300, ayuda: "El que da «Compartir» en Google Maps (https://maps.app.goo.gl/…)." })),
    grupo("Horario de la tienda",
      aviso_zona("Aparece en la web, en Google (datos estructurados) y limita las franjas de recogida."), horario()),
    grupo("Opiniones de Google (opcional)",
      entrada("negocio.notaGoogle", "Nota media", { max: 5, ayuda: "Ejemplo: 4,9" }),
      entrada("negocio.resenasGoogle", "Número de reseñas", { tipo: "entero" }),
      entrada("negocio.citaGoogle", "Reseña destacada", { area: true, max: 300 })),
    grupo("Posicionamiento (SEO)",
      entrada("seo.dominio", "Dirección de la web", { max: 200, ayuda: "Con https://, sin barra final. Por ejemplo https://mitienda.es. Se usa en el mapa del sitio y en los datos para Google." }),
      entrada("seo.titulo", "Título para Google (máx. 90)", { max: 90, ayuda: "Lo ideal son unos 60 caracteres." }),
      entrada("seo.descripcion", "Descripción para Google (máx. 200)", { area: true, max: 200, ayuda: "Lo ideal son unos 155 caracteres." })),
    botonesGuardar("negocio"));
}

function botonesGuardar(cual) {
  const errores = h("div", { class: "errores", id: `errores-${cual}`, role: "alert", tabindex: "-1", hidden: true });
  const boton = h("button", { type: "submit", class: "btn-prim", texto: "Guardar cambios" });
  const descartar = h("button", { type: "button", class: "btn-sec", texto: "Descartar", onclick: () => { if (confirm("¿Descartar los cambios sin guardar?")) cargarAjustes(ajustesGuardados()); } });
  return h("div", { class: "barra-guardar" }, errores, h("div", { class: "acciones" }, boton, descartar));
}

// Los formularios se envían desde main.js (para unir las dos pestañas en un solo guardado).
export async function enviar(cual) {
  const cont = $(`errores-${cual}`);
  const boton = $(`form-${cual}`).querySelector("button[type=submit]");
  boton.disabled = true;
  const r = await guardarAjustes(borrador);
  boton.disabled = false;
  document.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
  if (r.ok) { cont.hidden = true; cargarAjustes(r.datos.ajustes); aviso("Cambios guardados. La web se actualiza en unos segundos."); return true; }
  cont.replaceChildren(h("p", { texto: "No se ha podido guardar:" }), h("ul", {}, r.errores.map((e) => h("li", { texto: describirError(e) }))));
  cont.hidden = false;
  for (const e of r.errores) document.querySelectorAll(`[data-ruta="${e.campo}"]`).forEach((n) => n.setAttribute("aria-invalid", "true"));
  cont.focus();
  return false;
}

export const ajustesBorrador = () => borrador;

export const refrescarTienda = () => pintarTienda();
