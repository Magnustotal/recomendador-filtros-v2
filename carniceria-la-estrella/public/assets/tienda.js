// Tienda online: catálogo, carrito, formulario y envío del pedido.
// El navegador solo manda lo que el cliente quiere (ids, opciones, cantidades);
// los precios y los totales que se ven aquí son orientativos: los decide el servidor.
import { importeLinea, aCentimos, formatoEuro, formatoCantidad, cantidadValida } from "/assets/compartido/dinero.js";
import { ahoraEnMadrid, diaSemanaDeFecha, sumarDias, aMinutos, franjaDentroDeHorario } from "/assets/compartido/horario.js";

const CLAVE_CARRITO = "ls_pedido_v1";
const $ = (id) => document.getElementById(id);

const el = {
  estado: $("estado"), anuncios: $("anuncios"), notaPrecios: $("nota-precios"), cerrada: $("tienda-cerrada"), aviso: $("aviso-tienda"), app: $("app"),
  buscar: $("buscar"), chips: $("chips"), sinResultados: $("sin-resultados"), productos: $("productos"),
  pedido: $("pedido"), vacio: $("carrito-vacio"), form: $("formulario"), lineas: $("lineas"), totales: $("totales"),
  errores: $("errores"), nombre: $("nombre"), telefono: $("telefono"),
  entrega: $("opciones-entrega"), campoDireccion: $("campo-direccion"), direccion: $("direccion"), cp: $("cp"), ayudaZona: $("ayuda-zona"),
  dia: $("dia"), franja: $("franja"), pago: $("opciones-pago"), comentarios: $("comentarios"),
  campoEdad: $("campo-edad"), edad: $("mayor-edad"), web: $("web"),
  enviar: $("enviar"), vaciar: $("vaciar"), confirmacion: $("confirmacion"),
};

let cat = null; // respuesta de /api/catalogo
let porId = new Map();
let carrito = []; // [{ id, opcion, nota, cantidad }]
let enviando = false;

// ---------- utilidades ----------
function crear(tag, atributos = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v == null) continue;
    if (k === "class") n.className = v;
    else if (k === "texto") n.textContent = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos) if (h != null) n.append(h);
  return n;
}
const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const euros = (cent) => formatoEuro(cent / 100);
const pasoDe = (p) => p.paso ?? (p.unidad === "kg" ? 250 : 1);
const minimoDe = (p) => p.minimo ?? pasoDe(p);
const maximoDe = (p) => p.maximo ?? (p.unidad === "kg" ? 25000 : 50);
const etiquetaPrecio = (p) => (p.precio == null ? null : `${formatoEuro(p.precio)}/${p.unidad === "kg" ? "kg" : "ud"}`);

// Mensajes de estado: la carga y los fallos van en #estado; los avisos puntuales
// (añadido, quitado…) van a una región viva oculta para lectores de pantalla.
function mostrarEstado(texto) {
  el.estado.hidden = false;
  el.estado.textContent = texto;
}
// Icono de categoría (SVG como máscara: toma el color del texto). Los archivos están en /assets/iconos/<id>.svg
const icono = (id, clase = "") => crear("span", { class: `icono ${clase}`.trim(), "aria-hidden": "true", style: `--ico:url(/assets/iconos/${id}.svg)` });

function anunciar(texto) {
  el.anuncios.textContent = "";
  setTimeout(() => { el.anuncios.textContent = texto; }, 50);
}

// ---------- carrito (localStorage, opcional) ----------
function guardarCarrito() {
  try { localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito)); } catch { /* sin almacenamiento: el carrito vive solo en esta visita */ }
}
function cargarCarrito() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CLAVE_CARRITO) ?? "[]");
    if (!Array.isArray(bruto)) return [];
    return bruto.filter((l) => {
      const p = porId.get(l?.id);
      return p && !p.agotado && typeof l.cantidad === "number" && cantidadValida(p, l.cantidad)
        && (!l.opcion || p.opciones.includes(l.opcion));
    }).map((l) => ({ id: l.id, opcion: l.opcion || "", nota: typeof l.nota === "string" ? l.nota.slice(0, 140) : "", cantidad: l.cantidad }));
  } catch { return []; }
}

function buscarLinea(id, opcion) { return carrito.find((l) => l.id === id && l.opcion === opcion); }

function anadir(p, opcion, cantidad) {
  const previa = buscarLinea(p.id, opcion);
  if (previa) previa.cantidad = Math.min(maximoDe(p), previa.cantidad + cantidad);
  else carrito.push({ id: p.id, opcion, nota: "", cantidad });
  guardarCarrito();
  pintarCarrito();
  anunciar(`Añadido: ${p.nombre}${opcion ? ` (${opcion})` : ""}, ${formatoCantidad(cantidad, p.unidad)}. Tu pedido tiene ${carrito.length} producto${carrito.length === 1 ? "" : "s"}.`);
}

// ---------- catálogo ----------
function pintarFila(p) {
  let cantidad = minimoDe(p);
  const salida = crear("output", { "aria-live": "off", texto: formatoCantidad(cantidad, p.unidad) });
  const menos = crear("button", { type: "button", "aria-label": `Menos ${p.nombre}`, texto: "−" });
  const mas = crear("button", { type: "button", "aria-label": `Más ${p.nombre}`, texto: "+" });
  const sincronizar = () => {
    salida.textContent = formatoCantidad(cantidad, p.unidad);
    menos.disabled = cantidad <= minimoDe(p);
    mas.disabled = cantidad + pasoDe(p) > maximoDe(p);
  };
  menos.addEventListener("click", () => { cantidad = Math.max(minimoDe(p), cantidad - pasoDe(p)); sincronizar(); });
  mas.addEventListener("click", () => { cantidad = Math.min(maximoDe(p), cantidad + pasoDe(p)); sincronizar(); });
  sincronizar();

  const precio = etiquetaPrecio(p);
  const info = crear("div", { class: "prod-info" },
    crear("h3", { texto: p.nombre }),
    p.descripcion ? crear("p", { class: "prod-desc", texto: p.descripcion }) : null,
    precio ? crear("p", { class: "prod-precio", texto: precio }) : crear("p", { class: "prod-precio" }, crear("span", { class: "consultar", texto: "Consultar precio" })),
    p.agotado ? crear("p", { class: "prod-agotado", texto: "Agotado por ahora" }) : null,
  );

  let acciones = null;
  if (!p.agotado) {
    let selector = null;
    if (p.opciones.length) {
      selector = crear("select", { "aria-label": `Cómo quieres ${p.nombre}` });
      for (const o of p.opciones) selector.append(crear("option", { value: o, texto: o }));
    }
    const boton = crear("button", { type: "button", class: "btn btn-solid btn-anadir", texto: "Añadir" });
    boton.setAttribute("aria-label", `Añadir ${p.nombre} al pedido`);
    let temporizador;
    boton.addEventListener("click", () => {
      anadir(p, selector ? selector.value : "", cantidad);
      // Confirmación visible (además del aviso para lectores de pantalla)
      boton.textContent = "✓ Añadido";
      boton.setAttribute("aria-label", `Añadido ${p.nombre} al pedido`); // el nombre accesible contiene el texto visible
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { boton.textContent = "Añadir"; boton.setAttribute("aria-label", `Añadir ${p.nombre} al pedido`); }, 1600);
    });
    acciones = crear("div", { class: "prod-acciones" }, selector, crear("div", { class: "cantidad", role: "group", "aria-label": `Cantidad de ${p.nombre}` }, menos, salida, mas), boton);
  }

  // Miniatura: la foto de la pieza si el carnicero la ha subido; si no, el icono de su categoría.
  const fila = crear("article", { class: `prod con-foto${p.agotado ? " es-agotado" : ""}`, "data-id": p.id });
  fila.append(p.foto
    ? crear("div", { class: "prod-foto" }, crear("img", { src: `/api/foto/${p.foto}`, alt: "", loading: "lazy", decoding: "async", width: "88", height: "88" }))
    : crear("div", { class: "prod-foto es-icono" }, icono(p.categoria)));
  fila.append(info);
  if (acciones) fila.append(acciones);
  return fila;
}

let bloques = []; // [{ id, seccion, filas: [{ p, nodo, texto }] }]
let filtroCategoria = "";

function pintarCatalogo() {
  el.productos.replaceChildren();
  bloques = [];
  for (const c of cat.categorias) {
    const lista = cat.productos.filter((p) => p.categoria === c.id);
    if (!lista.length) continue;
    const titulo = crear("h2", { class: "cat-titulo", id: `cat-${c.id}` }, icono(c.id, "en-titulo"), c.nombre);
    const cont = crear("div", { class: "prods" });
    const filas = lista.map((p) => {
      const nodo = pintarFila(p);
      cont.append(nodo);
      return { p, nodo, texto: sinAcentos(`${p.nombre} ${p.descripcion ?? ""} ${p.opciones.join(" ")} ${c.nombre}`) };
    });
    const foto = crear("div", { class: "cat-foto" },
      crear("img", { src: `/assets/photos/${c.id}-400.jpg`, srcset: `/assets/photos/${c.id}-400.jpg 400w, /assets/photos/${c.id}.jpg 800w`, sizes: "(max-width: 720px) 100vw, 240px", alt: "", loading: "lazy", decoding: "async", width: "400", height: "400" }),
      crear("span", { class: "etiqueta-foto", texto: "Foto ilustrativa" }));
    // Si la foto de la categoría no cargase, la cabecera se queda sin ella y el resto se mantiene
    foto.querySelector("img").addEventListener("error", () => foto.remove());
    const cabecera = crear("div", { class: "cat-cab" }, foto, crear("div", { class: "cat-textos" }, titulo,
      c.descripcion ? crear("p", { class: "cat-desc", texto: c.descripcion }) : null,
      lista.some((p) => p.alcohol) ? crear("p", { class: "cat-aviso-edad", texto: "Venta solo a mayores de 18 años." }) : null));
    const seccion = crear("section", { class: "cat-bloque", "aria-labelledby": `cat-${c.id}`, style: `--n:${lista.length}` }, cabecera, cont);
    el.productos.append(seccion);
    bloques.push({ id: c.id, nombre: c.nombre, seccion, filas });
  }

  el.chips.replaceChildren(
    chip("", "Todo"),
    ...bloques.map((b) => chip(b.id, b.nombre, b.id)),
  );
}

function chip(id, texto, iconoId) {
  const b = crear("button", { type: "button", class: "chip", "aria-pressed": String(id === filtroCategoria), "data-cat": id }, iconoId ? icono(iconoId) : null, texto);
  b.addEventListener("click", () => {
    filtroCategoria = id;
    for (const c of el.chips.children) c.setAttribute("aria-pressed", String(c.dataset.cat === id));
    filtrar();
    if (id) {
      irASeccion($(`cat-${id}`));
    }
  });
  return b;
}

// Las categorías lejanas no se pintan hasta acercarse (content-visibility), así que su altura real solo se
// conoce al llegar: se salta, se deja que se pinte y se corrige la posición.
function irASeccion(destino, intentos = 8) {
  destino = destino?.closest(".cat-bloque"); // se salta a la cabecera con su foto, no solo al título
  if (!destino) return;
  destino.scrollIntoView({ block: "start", behavior: "instant" });
  if (intentos > 0) requestAnimationFrame(() => {
    const arriba = destino.getBoundingClientRect().top;
    if (Math.abs(arriba - parseFloat(getComputedStyle(destino).scrollMarginTop)) > 2) irASeccion(destino, intentos - 1);
  });
}

// Con buscador activo se ve todo lo que coincide; con una categoría elegida y sin búsqueda
// se mantiene la lista completa (el chip lleva a la sección) para no esconder productos.
function filtrar() {
  const q = sinAcentos(el.buscar.value.trim());
  let visibles = 0;
  for (const b of bloques) {
    let enBloque = 0;
    for (const f of b.filas) {
      const ok = !q || q.split(/\s+/).every((w) => f.texto.includes(w));
      f.nodo.hidden = !ok;
      if (ok) enBloque++;
    }
    b.seccion.hidden = enBloque === 0;
    visibles += enBloque;
  }
  el.sinResultados.hidden = visibles > 0;
}

// ---------- carrito: pintar ----------
function totales() {
  let subtotal = 0, consultar = 0;
  for (const l of carrito) {
    const p = porId.get(l.id);
    const imp = importeLinea(p.precio, p.unidad, l.cantidad);
    if (imp == null) consultar++; else subtotal += imp;
  }
  const t = cat.ajustes.tienda;
  const tipo = tipoEntrega();
  let envio = 0, gratis = false;
  if (tipo === "reparto" && t.reparto.coste != null) {
    gratis = t.reparto.gratisDesde != null && consultar === 0 && subtotal >= aCentimos(t.reparto.gratisDesde);
    envio = gratis ? 0 : aCentimos(t.reparto.coste);
  }
  return { subtotal, consultar, envio, gratis, total: subtotal + envio };
}

function pintarCarrito() {
  const hay = carrito.length > 0;
  el.vacio.hidden = hay;
  el.form.hidden = !hay;
  actualizarBarra();
  if (!hay) { el.lineas.replaceChildren(); el.totales.replaceChildren(); return; }

  el.lineas.replaceChildren(...carrito.map((l, i) => pintarLinea(l, i)));
  pintarTotales();
  el.campoEdad.hidden = !carrito.some((l) => porId.get(l.id).alcohol);
  if (el.campoEdad.hidden) el.edad.checked = false;
  pintarOpcionesPago();
}

function pintarLinea(l, i) {
  const p = porId.get(l.id);
  const imp = importeLinea(p.precio, p.unidad, l.cantidad);
  const salida = crear("output", { texto: formatoCantidad(l.cantidad, p.unidad) });
  const menos = crear("button", { type: "button", "data-accion": "menos", "aria-label": `Menos ${p.nombre}`, texto: "−" });
  const mas = crear("button", { type: "button", "data-accion": "mas", "aria-label": `Más ${p.nombre}`, texto: "+" });
  menos.disabled = l.cantidad <= minimoDe(p);
  mas.disabled = l.cantidad + pasoDe(p) > maximoDe(p);
  const cambiar = (delta) => {
    l.cantidad = Math.min(maximoDe(p), Math.max(minimoDe(p), l.cantidad + delta));
    guardarCarrito();
    pintarCarrito();
    const fila = el.lineas.children[i];
    const pedido = fila?.querySelector(`[data-accion="${delta > 0 ? "mas" : "menos"}"]`);
    (pedido && !pedido.disabled ? pedido : fila?.querySelector('[data-accion="mas"]:not(:disabled), [data-accion="menos"]:not(:disabled)'))?.focus();
  };
  menos.addEventListener("click", () => cambiar(-pasoDe(p)));
  mas.addEventListener("click", () => cambiar(pasoDe(p)));

  const quitar = crear("button", { type: "button", class: "linea-quitar", texto: "Quitar" });
  quitar.setAttribute("aria-label", `Quitar ${p.nombre} del pedido`);
  quitar.addEventListener("click", () => {
    carrito.splice(i, 1);
    guardarCarrito();
    pintarCarrito();
    anunciar(`${p.nombre} quitado del pedido.`);
    (carrito.length ? el.lineas.querySelector("button") : el.pedido)?.focus();
  });

  const nota = crear("input", { type: "text", maxlength: "140", placeholder: "Nota: grosor, cómo cortarlo…", "aria-label": `Nota para ${p.nombre}`, value: l.nota });
  nota.addEventListener("input", () => { l.nota = nota.value; guardarCarrito(); });

  return crear("li", { class: "linea" },
    crear("div", { class: "linea-cab" },
      crear("div", {}, crear("p", { class: "linea-nombre", texto: p.nombre }), l.opcion ? crear("p", { class: "linea-opcion", texto: l.opcion }) : null),
      crear("span", { class: "linea-importe" }, imp == null ? crear("span", { class: "consultar", texto: "Consultar" }) : document.createTextNode(euros(imp))),
    ),
    crear("div", { class: "linea-ctrl" }, crear("div", { class: "cantidad", role: "group", "aria-label": `Cantidad de ${p.nombre}` }, menos, salida, mas), quitar),
    nota,
  );
}

function pintarTotales() {
  const t = cat.ajustes.tienda;
  const x = totales();
  const filas = [];
  const fila = (a, b, clase) => crear("p", { class: clase }, crear("span", { texto: a }), crear("span", { texto: b }));
  if (x.subtotal > 0 || x.consultar === 0) filas.push(fila("Productos", euros(x.subtotal)));
  if (tipoEntrega() === "reparto" && t.reparto.coste != null) filas.push(fila("Envío", x.gratis ? "Gratis" : euros(x.envio)));
  if (x.subtotal > 0 || x.consultar === 0) filas.push(fila("Total estimado", euros(x.total), "total"));
  if (x.consultar) filas.push(crear("p", { class: "nota", texto: `${x.consultar} producto${x.consultar === 1 ? "" : "s"} sin precio: te lo confirmamos al preparar el pedido.` }));
  if (x.consultar === 0) {
    const minimo = tipoEntrega() === "reparto" && t.reparto.minimo != null ? t.reparto.minimo : t.pedidoMinimo;
    if (minimo != null && x.subtotal < aCentimos(minimo)) filas.push(crear("p", { class: "nota", texto: `Pedido mínimo: ${formatoEuro(minimo)}.` }));
  }
  filas.push(crear("p", { class: "nota", texto: "Importe orientativo: el peso y el precio finales se confirman al prepararlo." }));
  el.totales.replaceChildren(...filas);
}

function actualizarBarra() {
  const enlace = document.querySelector(".mobile-action-bar a:last-child");
  if (!enlace) return;
  const n = carrito.length;
  const texto = n ? `Mi pedido (${n})` : "Mi pedido";
  for (const nodo of [...enlace.childNodes]) if (nodo.nodeType === 3 && nodo.textContent.trim()) nodo.textContent = `\n    ${texto}\n  `;
}

// ---------- entrega, día, franja, pago ----------
function configEntrega(tipo) {
  const t = cat.ajustes.tienda;
  return tipo === "recogida" ? (t.recogida.activa ? t.recogida : null) : (t.reparto.activo ? t.reparto : null);
}
function tipoEntrega() {
  return marcado("entrega")?.value ?? "";
}
function marcado(nombre) {
  return el.form.querySelector(`input[name="${nombre}"]:checked`);
}

// Texto de la zona de reparto a partir de lo configurado en el panel (texto libre, códigos postales y/o radio).
function descripcionZona(rp) {
  const cps = rp.codigosPostales ?? [];
  const km = rp.radioKm == null ? null : String(rp.radioKm).replace(".", ",");
  const partes = [];
  if (rp.zona) partes.push(`${rp.zona}.`);
  if (cps.length && km) partes.push(`Repartimos en los códigos postales ${cps.join(", ")} y hasta ${km} km de la tienda.`);
  else if (cps.length) partes.push(`Repartimos solo en los códigos postales ${cps.join(", ")}.`);
  else if (km) partes.push(`Repartimos hasta ${km} km de la tienda.`);
  return partes.join(" ");
}

function pintarOpcionesEntrega() {
  const t = cat.ajustes.tienda;
  const previo = tipoEntrega();
  const opciones = [];
  const opcion = (valor, titulo, detalle) => {
    const input = crear("input", { type: "radio", name: "entrega", value: valor });
    input.addEventListener("change", alCambiarEntrega);
    return crear("label", { class: "opcion" }, input, crear("span", {}, crear("span", { class: "opcion-texto", texto: titulo }), detalle ? crear("small", { texto: detalle }) : null));
  };
  if (t.recogida.activa) opciones.push(opcion("recogida", "Recoger en tienda", `${cat.ajustes.negocio.calle}, ${cat.ajustes.negocio.localidad}`));
  if (t.reparto.activo) {
    const partes = [];
    const zona = descripcionZona(t.reparto).replace(/\.$/, "");
    if (zona) partes.push(zona);
    if (t.reparto.coste != null) partes.push(t.reparto.coste === 0 ? "envío gratis" : `envío ${formatoEuro(t.reparto.coste)}`);
    if (t.reparto.gratisDesde != null) partes.push(`gratis desde ${formatoEuro(t.reparto.gratisDesde)}`);
    if (t.reparto.minimo != null) partes.push(`mínimo ${formatoEuro(t.reparto.minimo)}`);
    opciones.push(opcion("reparto", "Reparto a domicilio", partes.join(" · ")));
  }
  el.entrega.replaceChildren(...opciones);
  const marcar = opciones.length === 1 ? opciones[0] : [...el.entrega.children].find((o) => o.querySelector("input").value === previo);
  if (marcar) marcar.querySelector("input").checked = true;
  alCambiarEntrega();
}

function alCambiarEntrega() {
  const tipo = tipoEntrega();
  el.campoDireccion.hidden = tipo !== "reparto";
  el.direccion.required = tipo === "reparto";
  const t = cat.ajustes.tienda;
  el.ayudaZona.textContent = descripcionZona(t.reparto);
  el.cp.required = tipo === "reparto";
  pintarDias();
  pintarOpcionesPago();
  if (carrito.length) pintarTotales();
}

function franjasDelDia(tipo, fecha) {
  const t = cat.ajustes.tienda;
  const cfg = configEntrega(tipo);
  if (!cfg) return [];
  const dow = diaSemanaDeFecha(fecha);
  if (!cfg.dias.includes(dow) || t.diasSinServicio.includes(fecha)) return [];
  const ahora = ahoraEnMadrid();
  return cfg.franjas.filter((f) => {
    if (tipo === "recogida" && !franjaDentroDeHorario(cat.ajustes.horario, dow, f)) return false;
    if (fecha === ahora.fecha && aMinutos(f.split("-")[0]) < ahora.minutos + t.antelacionHoras * 60) return false;
    return true;
  });
}

const nombreDia = (fecha) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${fecha}T12:00:00Z`));

function pintarDias() {
  const tipo = tipoEntrega();
  const previo = el.dia.value;
  el.dia.replaceChildren();
  if (!tipo) {
    el.dia.append(crear("option", { value: "", texto: "Primero elige recogida o reparto" }));
    el.dia.disabled = true;
    pintarFranjas();
    return;
  }
  const hoy = ahoraEnMadrid().fecha;
  const opciones = [];
  for (let n = 0; n <= cat.ajustes.tienda.diasMaximos; n++) {
    const fecha = sumarDias(hoy, n);
    if (!franjasDelDia(tipo, fecha).length) continue;
    const prefijo = n === 0 ? "Hoy, " : n === 1 ? "Mañana, " : "";
    opciones.push(crear("option", { value: fecha, texto: prefijo + nombreDia(fecha) }));
  }
  el.dia.disabled = opciones.length === 0;
  if (!opciones.length) el.dia.append(crear("option", { value: "", texto: "No hay días disponibles" }));
  else el.dia.append(crear("option", { value: "", texto: "Elige un día" }), ...opciones);
  if (previo && opciones.some((o) => o.value === previo)) el.dia.value = previo;
  pintarFranjas();
}

function pintarFranjas() {
  const tipo = tipoEntrega();
  const previo = el.franja.value;
  el.franja.replaceChildren();
  const fechas = el.dia.value;
  if (!tipo || !fechas) {
    el.franja.append(crear("option", { value: "", texto: "Primero elige el día" }));
    el.franja.disabled = true;
    return;
  }
  const lista = franjasDelDia(tipo, fechas);
  el.franja.disabled = false;
  el.franja.append(crear("option", { value: "", texto: "Elige una franja" }), ...lista.map((f) => crear("option", { value: f, texto: f.replace("-", " a ") })));
  if (previo && lista.includes(previo)) el.franja.value = previo;
}

function pintarOpcionesPago() {
  const t = cat.ajustes.tienda;
  const tipo = tipoEntrega();
  const previo = marcado("pago")?.value;
  const lista = [];
  if (t.pagos.efectivo) lista.push(["efectivo", "Efectivo", tipo === "reparto" ? "al recibir el pedido" : "al recoger"]);
  if (t.pagos.tarjetaRecogida && tipo === "recogida") lista.push(["tarjeta", "Tarjeta", "al recoger en tienda"]);
  if (t.pagos.bizum) lista.push(["bizum", "Bizum", "te enviamos los datos por WhatsApp"]);
  if (t.pagos.transferencia) lista.push(["transferencia", "Transferencia", "te enviamos los datos por WhatsApp"]);
  el.pago.replaceChildren(...lista.map(([valor, titulo, detalle]) => crear("label", { class: "opcion" },
    crear("input", { type: "radio", name: "pago", value: valor }),
    crear("span", {}, crear("span", { class: "opcion-texto", texto: titulo }), crear("small", { texto: detalle })))));
  const marcar = el.pago.querySelector(`input[value="${previo}"]`);
  if (marcar) marcar.checked = true;
}

// ---------- errores ----------
const CAMPOS = {
  "cliente.nombre": ["nombre", "error-nombre"], "cliente.telefono": ["telefono", "error-telefono"],
  "entrega.direccion": ["direccion", "error-direccion"], "entrega.cp": ["cp", "error-cp"], "entrega.dia": ["dia", "error-dia"], "entrega.franja": ["franja", "error-franja"],
  "entrega.tipo": ["opciones-entrega", null], pago: ["opciones-pago", "error-pago"], mayorEdad: ["mayor-edad", "error-mayorEdad"],
};

function limpiarErrores() {
  el.errores.hidden = true;
  el.errores.replaceChildren();
  for (const p of el.form.querySelectorAll(".campo-error")) { p.hidden = true; p.textContent = ""; }
  for (const c of el.form.querySelectorAll("[aria-invalid]")) c.removeAttribute("aria-invalid");
  for (const c of el.form.querySelectorAll("[aria-describedby^='error-']")) c.removeAttribute("aria-describedby");
}

function mostrarErrores(errores) {
  limpiarErrores();
  const resumen = crear("ul");
  let primero = null;
  for (const e of errores) {
    const [idCampo, idError] = CAMPOS[e.campo] ?? [];
    resumen.append(crear("li", { texto: e.mensaje }));
    if (!idCampo) continue;
    const campo = $(idCampo);
    const msg = idError ? $(idError) : null;
    if (msg) { msg.textContent = e.mensaje; msg.hidden = false; }
    if (campo && campo.tagName !== "DIV") {
      campo.setAttribute("aria-invalid", "true");
      if (msg) campo.setAttribute("aria-describedby", idError);
    }
    primero ??= campo;
  }
  el.errores.append(crear("p", { texto: errores.length === 1 ? "Revisa este punto:" : "Revisa estos puntos:" }), resumen);
  el.errores.hidden = false;
  el.errores.focus();
  el.errores.scrollIntoView({ block: "nearest" });
  return primero;
}

// Comprobación previa en el navegador (el servidor vuelve a comprobarlo todo).
function validarLocal() {
  const e = [];
  if (el.nombre.value.trim().length < 2) e.push({ campo: "cliente.nombre", mensaje: "Escribe tu nombre." });
  const tel = el.telefono.value.replace(/[\s.\-()]/g, "");
  if (!/^(?:\+34|0034)?[6789]\d{8}$/.test(tel)) e.push({ campo: "cliente.telefono", mensaje: "Teléfono español de 9 cifras." });
  const tipo = tipoEntrega();
  if (!tipo) e.push({ campo: "entrega.tipo", mensaje: "Elige recogida o reparto." });
  if (tipo === "reparto" && el.direccion.value.trim().length < 8) e.push({ campo: "entrega.direccion", mensaje: "Escribe la dirección de entrega completa." });
  if (tipo === "reparto") {
    const cp = el.cp.value.replace(/\s+/g, "");
    const rp = cat.ajustes.tienda.reparto;
    const lista = rp.codigosPostales ?? [];
    if (!/^\d{5}$/.test(cp)) e.push({ campo: "entrega.cp", mensaje: "Escribe tu código postal (5 cifras)." });
    else if (lista.length && rp.radioKm == null && !lista.includes(cp)) e.push({ campo: "entrega.cp", mensaje: `Lo sentimos, no repartimos en el código postal ${cp}.` });
  }
  if (!el.dia.value) e.push({ campo: "entrega.dia", mensaje: "Elige un día." });
  if (!el.franja.value) e.push({ campo: "entrega.franja", mensaje: "Elige una franja horaria." });
  if (!marcado("pago")) e.push({ campo: "pago", mensaje: "Elige cómo vas a pagar." });
  if (!el.campoEdad.hidden && !el.edad.checked) e.push({ campo: "mayorEdad", mensaje: "Para pedir vino confirma que eres mayor de 18 años." });
  return e;
}

// ---------- envío ----------
function cuerpoPedido() {
  const tipo = tipoEntrega();
  return {
    lineas: carrito.map((l) => ({ id: l.id, opcion: l.opcion, nota: l.nota.trim(), cantidad: l.cantidad })),
    cliente: { nombre: el.nombre.value.trim(), telefono: el.telefono.value.trim() },
    entrega: { tipo, direccion: tipo === "reparto" ? el.direccion.value.trim() : "", cp: tipo === "reparto" ? el.cp.value.replace(/\s+/g, "") : "", dia: el.dia.value, franja: el.franja.value },
    pago: marcado("pago")?.value ?? "",
    comentarios: el.comentarios.value.trim(),
    mayorEdad: el.edad.checked,
    web: el.web.value,
  };
}

async function enviarPedido(ev) {
  ev.preventDefault();
  if (enviando) return;
  const local = validarLocal();
  if (local.length) { mostrarErrores(local); return; }
  limpiarErrores();
  enviando = true;
  el.enviar.disabled = true;
  el.enviar.textContent = "Enviando…";
  try {
    const r = await fetch("/api/pedido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpoPedido()) });
    let datos = null;
    try { datos = await r.json(); } catch { /* respuesta sin JSON */ }
    if (r.ok && datos?.ok) { confirmar(datos); return; }
    if (r.status === 429) mostrarErrores([{ campo: "", mensaje: "Demasiados intentos seguidos. Espera un minuto y vuelve a probar." }]);
    else if (datos?.errores?.length) mostrarErrores(datos.errores);
    else mostrarErrores([{ campo: "", mensaje: "No se ha podido enviar el pedido. Inténtalo de nuevo o escríbenos por WhatsApp." }]);
  } catch {
    mostrarErrores([{ campo: "", mensaje: navigator.onLine ? "No se ha podido contactar con la tienda. Inténtalo de nuevo en un momento." : "Sin conexión: tu pedido sigue guardado. Envíalo cuando vuelvas a tener red." }]);
  } finally {
    enviando = false;
    el.enviar.disabled = false;
    el.enviar.textContent = "Enviar pedido";
  }
}

function confirmar(datos) {
  carrito = [];
  guardarCarrito();
  el.form.reset();
  limpiarErrores();
  el.form.hidden = true;
  el.vacio.hidden = true;
  actualizarBarra();
  const wa = crear("a", { class: "btn btn-green", href: datos.whatsappUrl, target: "_blank", rel: "noopener", texto: "Enviar el pedido por WhatsApp" });
  const otro = crear("button", { type: "button", class: "btn btn-outline-ink", texto: "Hacer otro pedido" });
  otro.addEventListener("click", () => {
    el.confirmacion.hidden = true;
    el.confirmacion.replaceChildren();
    pintarCarrito();
    pintarOpcionesEntrega();
    el.buscar.focus();
    window.scrollTo({ top: $("tienda-online").offsetTop, behavior: "auto" });
  });
  el.confirmacion.replaceChildren(
    crear("h3", { texto: "Pedido guardado" }),
    crear("p", {}, crear("span", { class: "numero", texto: datos.numero })),
    crear("p", { texto: "Último paso: pulsa el botón y envíanos el mensaje por WhatsApp para que lo veamos. Hasta que lo envíes, el pedido no está confirmado." }),
    ...(datos.resumido ? [crear("p", { texto: "El mensaje va resumido porque el pedido es muy largo; con el número lo tenemos completo." })] : []),
    wa, otro,
  );
  el.confirmacion.hidden = false;
  el.confirmacion.focus();
  el.pedido.scrollIntoView({ block: "start" });
}

// ---------- arranque ----------
async function iniciar() {
  let datos;
  try {
    const r = await fetch("/api/catalogo", { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(String(r.status));
    datos = await r.json();
  } catch {
    mostrarEstado("No hemos podido cargar los productos. Recarga la página o pídenos el pedido por WhatsApp.");
    return;
  }
  cat = datos;
  const t = cat.ajustes.tienda;
  if (!t.activa) { el.estado.hidden = true; el.cerrada.hidden = false; return; }
  if (!t.recogida.activa && !t.reparto.activo) { el.estado.hidden = true; el.cerrada.hidden = false; return; }

  porId = new Map(cat.productos.map((p) => [p.id, p]));
  carrito = cargarCarrito();
  el.estado.hidden = true;
  el.estado.textContent = "";
  const fecha = cat.preciosActualizados
    ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${cat.preciosActualizados}T12:00:00Z`))
    : null;
  el.notaPrecios.textContent = `${fecha ? `Precios actualizados por última vez el ${fecha}. ` : ""}Los precios pueden variar a diario; procuramos mantenerlos lo más al día posible.`;
  el.notaPrecios.hidden = false;
  if (t.aviso) { el.aviso.textContent = t.aviso; el.aviso.hidden = false; }
  el.app.hidden = false;

  pintarCatalogo();
  pintarOpcionesEntrega();
  pintarCarrito();

  el.buscar.addEventListener("input", filtrar);
  el.dia.addEventListener("change", pintarFranjas);
  el.form.addEventListener("submit", enviarPedido);
  el.form.addEventListener("input", (e) => { if (e.target.hasAttribute?.("aria-invalid")) { e.target.removeAttribute("aria-invalid"); } });
  el.vaciar.addEventListener("click", () => {
    if (!confirm("¿Vaciar el pedido?")) return;
    carrito = [];
    guardarCarrito();
    pintarCarrito();
    anunciar("Pedido vaciado.");
    el.buscar.focus();
  });
  if (location.hash.startsWith("#cat-")) irASeccion($(location.hash.slice(1)));
}

// En móvil el botón «volver arriba» tapaba el formulario del pedido: se oculta mientras ese panel está a la vista (solo CSS en pantallas pequeñas).
if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => document.body.classList.toggle("sobre-pedido", e.isIntersecting), { threshold: 0.1 }).observe(el.pedido);

iniciar();
