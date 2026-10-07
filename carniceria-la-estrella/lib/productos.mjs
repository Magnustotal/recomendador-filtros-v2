import { texto, numeroOpcional, entero, booleano, listaTextos, recoger, ErrorValidacion } from "./validar.mjs";
import { redondear } from "./dinero.mjs";
import { estaVigente, fechaReal, hayRangosSolapados, precioAnterior, MAX_OFERTAS_POR_PRODUCTO } from "./ofertas.mjs";

const euros = (n) => `${n.toFixed(2).replace(".", ",")} €`;

// Ofertas temporales de un producto: lista de { tipo: "precio", desde, hasta, precio } o { tipo: "cantidad", desde, hasta, lleva, paga }.
function validarOfertas(entrada, ctx, precioHabitual) {
  if (entrada == null || entrada === "") return [];
  if (!Array.isArray(entrada)) { ctx.error("ofertas", "Debe ser una lista."); return []; }
  if (entrada.length > MAX_OFERTAS_POR_PRODUCTO) { ctx.error("ofertas", `Máximo ${MAX_OFERTAS_POR_PRODUCTO} ofertas por producto (borra las ya terminadas).`); return []; }
  const salida = [];
  entrada.forEach((o, i) => {
    const campo = `ofertas[${i + 1}]`;
    if (!o || typeof o !== "object") return ctx.error(campo, "Oferta no válida.");
    const desde = fechaReal(o.desde) ? o.desde : null;
    const hasta = fechaReal(o.hasta) ? o.hasta : null;
    if (!desde || !hasta) return ctx.error(campo, "Indica la fecha de inicio y la de fin.");
    if (desde > hasta) return ctx.error(campo, "La fecha de fin no puede ser anterior a la de inicio.");
    if (o.tipo === "precio") {
      const precio = ctx.intento(() => numeroOpcional(o.precio, { campo: `${campo}.precio`, min: 0.01, max: 9999 }));
      if (precio == null) return ctx.error(campo, "Indica el precio de la oferta.");
      if (precioHabitual == null) return ctx.error(campo, "Pon primero el precio habitual del producto: la oferta se enseña tachando ese precio.");
      if (precio >= precioHabitual) return ctx.error(campo, `El precio de la oferta (${euros(precio)}) tiene que ser más barato que el habitual (${euros(precioHabitual)}).`);
      salida.push({ tipo: "precio", desde, hasta, precio });
    } else if (o.tipo === "cantidad") {
      const lleva = ctx.intento(() => entero(o.lleva, { campo: `${campo}.lleva`, min: 2, max: 10 }));
      const paga = ctx.intento(() => entero(o.paga, { campo: `${campo}.paga`, min: 1, max: 9 }));
      if (lleva == null || paga == null) return;
      if (paga >= lleva) return ctx.error(campo, "Tiene que pagar menos de lo que se lleva (por ejemplo, lleva 3 y paga 2).");
      salida.push({ tipo: "cantidad", desde, hasta, lleva, paga });
    } else ctx.error(campo, "Elige el tipo de oferta.");
  });
  const pisa = hayRangosSolapados(salida);
  if (pisa) ctx.error("ofertas", `Dos ofertas coinciden en fechas (${pisa[0].desde} a ${pisa[0].hasta} y ${pisa[1].desde} a ${pisa[1].hasta}): solo puede haber una a la vez.`);
  return salida.sort((a, b) => (a.desde < b.desde ? -1 : 1));
}

export function slug(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

const RE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const RE_FOTO = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

// Valida un producto que llega del panel. `categorias` = lista de ids válidos. `redondeo` = null|90|95.
export function validarProducto(entrada, { categorias, redondeo = null }) {
  return recoger((ctx) => {
    const e = entrada ?? {};
    const nombre = ctx.intento(() => texto(e.nombre, { min: 1, max: 80, campo: "nombre" }));
    let id = typeof e.id === "string" && e.id ? e.id : slug(nombre ?? "");
    if (!RE_ID.test(id)) { ctx.error("id", "Identificador no válido."); id = undefined; }
    const categoria = categorias.includes(e.categoria) ? e.categoria : (ctx.error("categoria", "Categoría no válida."), undefined);
    const unidad = e.unidad === "kg" || e.unidad === "ud" ? e.unidad : (ctx.error("unidad", "Debe ser kg o ud."), undefined);
    const descripcion = ctx.intento(() => texto(e.descripcion, { max: 160, campo: "descripcion" }));
    let paso, minimo, maximo;
    if (unidad) {
      const pasoMax = unidad === "kg" ? 5000 : 48;
      paso = ctx.intento(() => entero(e.paso ?? (unidad === "kg" ? 250 : 1), { campo: "paso", min: 1, max: pasoMax }));
      if (unidad === "kg" && paso !== undefined && paso % 50 !== 0) ctx.error("paso", "En kilos, el paso debe ser múltiplo de 50 g.");
      minimo = e.minimo == null ? null : ctx.intento(() => entero(e.minimo, { campo: "minimo", min: 1, max: unidad === "kg" ? 25000 : 500 }));
      maximo = e.maximo == null ? null : ctx.intento(() => entero(e.maximo, { campo: "maximo", min: 1, max: unidad === "kg" ? 50000 : 1000 }));
      if (paso && minimo && minimo % paso !== 0) ctx.error("minimo", "El mínimo debe ser múltiplo del paso.");
      if (minimo && maximo && minimo > maximo) ctx.error("maximo", "El máximo no puede ser menor que el mínimo.");
    }
    let precio = ctx.intento(() => numeroOpcional(e.precio, { campo: "precio", min: 0, max: 9999 }));
    // El redondeo ,90/,95 solo afecta al precio por kilo; lo que se vende por unidad se queda como se escribe.
    if (precio != null && redondeo && unidad === "kg") precio = redondear(precio, redondeo);
    // Datos privados de la calculadora de precios (nunca salen al público)
    const coste = ctx.intento(() => numeroOpcional(e.coste, { campo: "coste", min: 0, max: 9999 }));
    const merma = ctx.intento(() => numeroOpcional(e.merma, { campo: "merma", min: 0, max: 60, decimales: 1 }));
    const margen = ctx.intento(() => numeroOpcional(e.margen, { campo: "margen", min: 0, max: 300, decimales: 1 }));
    const ofertas = validarOfertas(e.ofertas, ctx, precio ?? null);
    const opciones = ctx.intento(() => listaTextos(e.opciones, { max: 12, maxLong: 40, campo: "opciones" }));
    const alergenos = ctx.intento(() => listaTextos(e.alergenos, { max: 14, maxLong: 30, campo: "alergenos" }));
    let foto = null;
    if (e.foto != null && e.foto !== "") { if (typeof e.foto === "string" && RE_FOTO.test(e.foto)) foto = e.foto; else ctx.error("foto", "Identificador de foto no válido."); }
    const orden = e.orden == null ? 0 : ctx.intento(() => entero(e.orden, { campo: "orden", min: 0, max: 100000 }));
    return {
      id, categoria, nombre, descripcion, unidad, paso, minimo: minimo ?? null, maximo: maximo ?? null, precio: precio ?? null,
      coste: coste ?? null, merma: merma ?? null, margen: margen ?? null, ofertas,
      agotado: booleano(e.agotado), oculto: booleano(e.oculto), opciones: opciones ?? [], foto, alcohol: booleano(e.alcohol), alergenos: alergenos ?? [], orden,
    };
  });
}

// Lo que ve el público: sin productos ocultos y sin campos internos.
// Solo se enseña la oferta que está activa hoy (las programadas para más adelante no se adelantan al público).
export function catalogoPublico(productos, hoy) {
  return productos
    .filter((p) => !p.oculto)
    .sort((a, b) => a.orden - b.orden)
    // el coste, el margen y el historial de precios son datos del negocio, no del cliente. De cada rebaja activa se calcula aquí el precio
    // anterior de los 30 días (el que se enseña tachado), porque el navegador no tiene el historial.
    .map(({ oculto, coste, merma, margen, ofertas, historial, ...resto }) => ({
      ...resto,
      ofertas: (ofertas ?? []).filter((o) => estaVigente(o, hoy)).map((o) => (o.tipo === "precio" ? { ...o, anterior: precioAnterior({ ...resto, historial, ofertas }, o) } : o)),
    }));
}

export function aplicarRedondeoATodos(productos, final) {
  return productos.map((p) => (p.precio == null || p.unidad !== "kg" ? p : { ...p, precio: redondear(p.precio, final) }));
}
