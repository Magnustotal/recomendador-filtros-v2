// Pestaña "Mercado": fuentes de precios de otras tiendas y los precios que el carnicero anota de cada una.
// Todo es de uso interno; sirve para el semáforo de Productos (mediana de las fuentes recientes).
import { api, textoErrores } from "./api.js";
import { h, $, importeEs, aviso, sinAcentos } from "./util.js";
import { TIPOS_FUENTE, FRECUENCIAS, VIGENCIA_DIAS, referenciaMercado, fuentesAtrasadas } from "/assets/compartido/mercado.js";

let mercado = { fuentes: [], precios: {}, anclas: [] };
let productos = [];
let hoy = new Date().toISOString().slice(0, 10);
let contexto = { alCambiar() {} };
let fuenteElegida = "";
let todos = false;
let borrador = new Map(); // id de producto -> texto escrito (sin guardar)

export function iniciarMercado(ctx) { contexto = ctx; }
export function cargarMercado({ mercado: m, productos: lista, hoy: h0 }) {
  if (m) mercado = structuredClone(m);
  if (lista) productos = lista;
  if (h0) hoy = h0;
  if (!mercado.fuentes.some((f) => f.id === fuenteElegida)) fuenteElegida = mercado.fuentes[0]?.id ?? "";
  borrador = new Map();
  pintar();
}
export function resumenMercado() {
  const conPrecios = Object.values(mercado.precios ?? {}).some((p) => Object.keys(p).length > 0);
  return { conPrecios, atrasadas: conPrecios ? fuentesAtrasadas(mercado, hoy) : [] };
}

const slug = (s) => sinAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
const num = (t) => { const n = Number(String(t).trim().replace(",", ".")); return String(t).trim() === "" || !Number.isFinite(n) ? null : n; };
const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

async function guardar(nuevo, mensaje) {
  const r = await api("/mercado", { metodo: "PUT", cuerpo: { fuentes: nuevo.fuentes, precios: nuevo.precios } });
  if (!r.ok) { aviso(textoErrores(r.errores), { error: true }); return false; }
  mercado = structuredClone(r.datos.mercado);
  borrador = new Map();
  if (mensaje) aviso(mensaje);
  contexto.alCambiar(mercado);
  pintar();
  return true;
}

function pintar() {
  pintarAvisos();
  pintarAnotar();
  pintarFuentes();
  pintarNueva();
}

function pintarAvisos() {
  const { conPrecios, atrasadas } = resumenMercado();
  const nodos = [];
  if (!conPrecios) nodos.push(h("p", { class: "merc-aviso", texto: "Todavía no hay precios anotados. Mientras tanto, el semáforo usa mi estimación propia (sin fuentes). Elige una tienda abajo y anota lo que ves." }));
  for (const f of atrasadas) nodos.push(h("p", { class: "merc-aviso", texto: f.dias == null ? `${f.nombre}: todavía no has anotado ningún precio.` : `${f.nombre}: llevas ${f.dias} días sin anotar precios.` }));
  $("merc-avisos").replaceChildren(...nodos);
}

function pintarAnotar() {
  const caja = $("merc-anotar");
  if (!mercado.fuentes.length) { caja.replaceChildren(h("p", { class: "ayuda", texto: "Añade primero una fuente (abajo)." })); return; }
  const selFuente = h("select", { id: "merc-fuente" }, mercado.fuentes.map((f) => h("option", { value: f.id, texto: f.nombre, selected: f.id === fuenteElegida })));
  const fecha = h("input", { id: "merc-fecha", type: "date", value: hoy, max: hoy });
  const verTodos = h("input", { id: "merc-todos", type: "checkbox", checked: todos });
  const lista = h("div", { class: "merc-lista", id: "merc-lista" });
  const estado = h("p", { class: "ayuda", role: "status", id: "merc-estado" });
  const ids = todos ? productos.filter((p) => p.unidad === "kg" && !p.oculto).map((p) => p.id) : mercado.anclas.filter((id) => productos.some((p) => p.id === id));
  const filas = ids.map((id) => ({ p: productos.find((x) => x.id === id), id })).filter((x) => x.p);
  const actual = () => mercado.fuentes.find((f) => f.id === fuenteElegida);

  const pintarLista = () => {
    lista.replaceChildren(...filas.map(({ p, id }) => {
      const guardadoF = mercado.precios[id]?.[fuenteElegida];
      const ref = referenciaMercado(mercado.precios[id], mercado.fuentes, hoy);
      const entrada = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", id: `merc-p-${id}`, "aria-label": `Precio de ${p.nombre} en ${actual()?.nombre ?? ""}, euros por kilo`, placeholder: guardadoF ? importeEs(guardadoF.precio) : "—", value: borrador.get(id) ?? "" });
      entrada.addEventListener("input", () => borrador.set(id, entrada.value));
      return h("div", { class: "merc-fila" },
        h("label", { class: "nombre", for: entrada.id, texto: p.nombre }), entrada,
        h("p", { class: "ref", texto: [
          guardadoF ? `Anotado: ${eur(guardadoF.precio)} (${guardadoF.fecha})` : "Sin anotar en esta tienda",
          ref?.n ? `Mediana: ${eur(ref.mediana)} con ${ref.n} fuente${ref.n === 1 ? "" : "s"}${ref.descartadas ? ` (${ref.descartadas} caducada${ref.descartadas === 1 ? "" : "s"})` : ""}` : "Sin referencia vigente",
        ].join(" · ") }));
    }));
  };
  selFuente.addEventListener("change", () => { fuenteElegida = selFuente.value; borrador = new Map(); pintarLista(); });
  verTodos.addEventListener("change", () => { todos = verTodos.checked; pintarAnotar(); });

  const guardarBtn = h("button", { type: "button", class: "btn-prim", id: "merc-guardar", texto: "Guardar precios" });
  guardarBtn.addEventListener("click", async () => {
    const nuevo = structuredClone(mercado);
    let cambios = 0;
    for (const [id, texto] of borrador) {
      if (texto.trim() === "") continue; // vacío = no tocar
      const n = num(texto);
      if (n == null || n <= 0) { estado.textContent = `«${texto}» no es un precio válido (${productos.find((p) => p.id === id)?.nombre}).`; return; }
      (nuevo.precios[id] ??= {})[fuenteElegida] = { precio: n, fecha: fecha.value || hoy };
      cambios++;
    }
    if (!cambios) { estado.textContent = "No has escrito ningún precio nuevo."; return; }
    if (await guardar(nuevo, `Guardados ${cambios} precios de ${actual()?.nombre}.`)) $("merc-estado").textContent = `Guardados ${cambios} precios.`;
  });
  const quitarBtn = h("button", { type: "button", class: "btn-sec", id: "merc-quitar", texto: "Quitar todos los precios de esta tienda" });
  quitarBtn.addEventListener("click", async () => {
    if (!confirm(`¿Quitar todos los precios anotados de ${actual()?.nombre}?`)) return;
    const nuevo = structuredClone(mercado);
    for (const id of Object.keys(nuevo.precios)) { delete nuevo.precios[id][fuenteElegida]; if (!Object.keys(nuevo.precios[id]).length) delete nuevo.precios[id]; }
    await guardar(nuevo, "Precios quitados.");
  });

  caja.replaceChildren(
    h("h3", { texto: "Anotar precios" }),
    h("p", { class: "ayuda", texto: `Elige la tienda, mira su precio por kilo en su web o en el lineal y escríbelo. Lo que dejes en blanco no se toca. Dejan de contar a los ${VIGENCIA_DIAS.semanal} días (o ${VIGENCIA_DIAS.diaria} si la fuente es diaria).` }),
    h("div", { class: "barra" },
      h("div", { class: "campo" }, h("label", { for: "merc-fuente", texto: "Tienda" }), selFuente),
      h("div", { class: "campo" }, h("label", { for: "merc-fecha", texto: "Fecha del precio" }), fecha)),
    h("label", { class: "check" }, verTodos, " Mostrar todos los productos al peso (no solo los de referencia)"),
    lista, estado, h("div", { class: "acciones" }, guardarBtn, quitarBtn));
  pintarLista();
}

function pintarFuentes() {
  $("merc-fuentes").replaceChildren(...mercado.fuentes.map((f) => {
    const frecuencia = h("select", { "aria-label": `Frecuencia de ${f.nombre}` }, Object.entries(FRECUENCIAS).map(([k, v]) => h("option", { value: k, texto: v, selected: k === f.frecuencia })));
    frecuencia.addEventListener("change", async () => {
      const nuevo = structuredClone(mercado);
      nuevo.fuentes.find((x) => x.id === f.id).frecuencia = frecuencia.value;
      await guardar(nuevo, `${f.nombre}: frecuencia ${FRECUENCIAS[frecuencia.value].toLowerCase()}.`);
    });
    const n = Object.values(mercado.precios).filter((p) => p[f.id]).length;
    const quitar = h("button", { type: "button", class: "btn-sec", texto: "Quitar", "aria-label": `Quitar la fuente ${f.nombre}` });
    quitar.addEventListener("click", async () => {
      if (!confirm(`¿Quitar la fuente ${f.nombre} y sus ${n} precios anotados?`)) return;
      const nuevo = structuredClone(mercado);
      nuevo.fuentes = nuevo.fuentes.filter((x) => x.id !== f.id);
      for (const id of Object.keys(nuevo.precios)) { delete nuevo.precios[id][f.id]; if (!Object.keys(nuevo.precios[id]).length) delete nuevo.precios[id]; }
      await guardar(nuevo, `Fuente ${f.nombre} quitada.`);
    });
    return h("div", { class: "merc-fuente" },
      h("span", { class: "nombre", texto: f.nombre }),
      h("span", { class: "ayuda", texto: `${TIPOS_FUENTE[f.tipo]} · ${n} precio${n === 1 ? "" : "s"}` }),
      f.url ? h("a", { href: f.url, target: "_blank", rel: "noopener noreferrer", texto: "Abrir web" }) : null,
      frecuencia, quitar);
  }));
}

function pintarNueva() {
  const nombre = h("input", { id: "merc-n-nombre", type: "text", maxlength: "60", autocomplete: "off" });
  const tipo = h("select", { id: "merc-n-tipo" }, Object.entries(TIPOS_FUENTE).map(([k, v]) => h("option", { value: k, texto: v, selected: k === "carniceria_online" })));
  const frec = h("select", { id: "merc-n-frec" }, Object.entries(FRECUENCIAS).map(([k, v]) => h("option", { value: k, texto: v, selected: k === "semanal" })));
  const url = h("input", { id: "merc-n-url", type: "url", maxlength: "200", placeholder: "https://…", autocomplete: "off" });
  const campo = (id, texto, el) => h("div", { class: "campo" }, h("label", { for: id, texto }), el);
  const boton = h("button", { type: "submit", class: "btn-sec", texto: "Añadir fuente" });
  $("merc-nueva").onsubmit = async (ev) => {
    ev.preventDefault();
    const base = slug(nombre.value);
    if (!base) { aviso("Escribe el nombre de la tienda.", { error: true }); nombre.focus(); return; }
    let id = base, i = 2;
    while (mercado.fuentes.some((f) => f.id === id)) id = `${base.slice(0, 27)}-${i++}`;
    const nuevo = structuredClone(mercado);
    nuevo.fuentes.push({ id, nombre: nombre.value.trim(), tipo: tipo.value, frecuencia: frec.value, url: url.value.trim(), nota: "" });
    if (await guardar(nuevo, `Fuente ${nombre.value.trim()} añadida.`)) { fuenteElegida = id; pintar(); }
  };
  $("merc-nueva").replaceChildren(
    h("h3", { texto: "Añadir una fuente" }),
    h("p", { class: "ayuda", texto: "Por ejemplo una carnicería online o la tienda de un mayorista. Comprueba antes sus condiciones de uso: aquí solo anotas a mano lo que ves publicado." }),
    campo("merc-n-nombre", "Nombre", nombre), campo("merc-n-tipo", "Tipo", tipo), campo("merc-n-frec", "Cada cuánto la repasas", frec), campo("merc-n-url", "Dirección web (opcional)", url), boton);
}
