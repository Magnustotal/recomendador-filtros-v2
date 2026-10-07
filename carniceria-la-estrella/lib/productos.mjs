import { texto, numeroOpcional, entero, booleano, listaTextos, recoger, ErrorValidacion } from "./validar.mjs";
import { redondear } from "./dinero.mjs";

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
    const opciones = ctx.intento(() => listaTextos(e.opciones, { max: 12, maxLong: 40, campo: "opciones" }));
    const alergenos = ctx.intento(() => listaTextos(e.alergenos, { max: 14, maxLong: 30, campo: "alergenos" }));
    let foto = null;
    if (e.foto != null && e.foto !== "") { if (typeof e.foto === "string" && RE_FOTO.test(e.foto)) foto = e.foto; else ctx.error("foto", "Identificador de foto no válido."); }
    const orden = e.orden == null ? 0 : ctx.intento(() => entero(e.orden, { campo: "orden", min: 0, max: 100000 }));
    return {
      id, categoria, nombre, descripcion, unidad, paso, minimo: minimo ?? null, maximo: maximo ?? null, precio: precio ?? null,
      agotado: booleano(e.agotado), oculto: booleano(e.oculto), opciones: opciones ?? [], foto, alcohol: booleano(e.alcohol), alergenos: alergenos ?? [], orden,
    };
  });
}

// Lo que ve el público: sin productos ocultos y sin campos internos.
export function catalogoPublico(productos) {
  return productos
    .filter((p) => !p.oculto)
    .sort((a, b) => a.orden - b.orden)
    .map(({ oculto, ...resto }) => resto);
}

export function aplicarRedondeoATodos(productos, final) {
  return productos.map((p) => (p.precio == null || p.unidad !== "kg" ? p : { ...p, precio: redondear(p.precio, final) }));
}
