import { texto, numeroOpcional, entero, booleano, hora, franja, diasSemana, fechaISO, telefonoEspana, recoger, ErrorValidacion } from "./validar.mjs";
import { aMinutos } from "./horario.mjs";

const URL_MAPS = /^https:\/\/(maps\.app\.goo\.gl|www\.google\.com\/maps|goo\.gl\/maps|maps\.google\.com)\//;

// Lista de códigos postales: acepta una lista o un texto con CP separados por comas, espacios o saltos de línea.
function codigosPostales(valor, campo) {
  if (valor == null || valor === "") return [];
  const lista = typeof valor === "string" ? valor.split(/[\s,;]+/).filter(Boolean) : valor;
  if (!Array.isArray(lista)) throw new ErrorValidacion(campo, "Debe ser una lista de códigos postales.");
  if (lista.length > 100) throw new ErrorValidacion(campo, "Máximo 100 códigos postales.");
  const salida = new Set();
  for (const cp of lista) {
    const t = typeof cp === "string" ? cp.trim() : "";
    if (!/^\d{5}$/.test(t)) throw new ErrorValidacion(campo, `«${String(cp).slice(0, 12)}» no es un código postal de 5 cifras.`);
    salida.add(t);
  }
  return [...salida].sort();
}

// Valida y normaliza los ajustes que llegan del panel. Devuelve {ok, valor} o {ok:false, errores}.
export function validarAjustes(entrada) {
  return recoger((ctx) => {
    const e = entrada ?? {};
    const n = e.negocio ?? {};
    const negocio = {
      nombre: ctx.intento(() => texto(n.nombre, { min: 1, max: 80, campo: "negocio.nombre" })),
      razonSocial: ctx.intento(() => texto(n.razonSocial, { max: 120, campo: "negocio.razonSocial" })),
      nif: ctx.intento(() => texto(n.nif, { max: 20, campo: "negocio.nif" })),
      calle: ctx.intento(() => texto(n.calle, { min: 1, max: 120, campo: "negocio.calle" })),
      cp: ctx.intento(() => { const t = texto(n.cp, { min: 1, max: 5, campo: "negocio.cp" }); if (!/^\d{5}$/.test(t)) throw new ErrorValidacion("negocio.cp", "Código postal de 5 cifras."); return t; }),
      localidad: ctx.intento(() => texto(n.localidad, { min: 1, max: 80, campo: "negocio.localidad" })),
      provincia: ctx.intento(() => texto(n.provincia, { max: 80, campo: "negocio.provincia" })),
      region: ctx.intento(() => texto(n.region, { max: 80, campo: "negocio.region" })),
      barrio: ctx.intento(() => texto(n.barrio, { max: 120, campo: "negocio.barrio" })),
      distrito: ctx.intento(() => texto(n.distrito, { max: 120, campo: "negocio.distrito" })),
      telefono: ctx.intento(() => telefonoEspana(n.telefono, "negocio.telefono")),
      whatsapp: undefined,
      lat: ctx.intento(() => numeroOpcional(n.lat, { campo: "negocio.lat", min: -90, max: 90, decimales: 7 })),
      lng: ctx.intento(() => numeroOpcional(n.lng, { campo: "negocio.lng", min: -180, max: 180, decimales: 7 })),
      mapsUrl: ctx.intento(() => { const t = texto(n.mapsUrl, { max: 300, campo: "negocio.mapsUrl" }); if (t && !URL_MAPS.test(t)) throw new ErrorValidacion("negocio.mapsUrl", "Enlace de Google Maps (https://maps.app.goo.gl/...)."); return t; }),
      notaGoogle: ctx.intento(() => texto(n.notaGoogle, { max: 5, campo: "negocio.notaGoogle" })),
      resenasGoogle: ctx.intento(() => numeroOpcional(n.resenasGoogle, { campo: "negocio.resenasGoogle", min: 0, max: 100000, decimales: 0 })),
      citaGoogle: ctx.intento(() => texto(n.citaGoogle, { max: 300, campo: "negocio.citaGoogle" })),
    };
    // WhatsApp = mismo número con prefijo de España (E.164 sin '+')
    if (negocio.telefono) negocio.whatsapp = "34" + negocio.telefono;
    if ((negocio.lat == null) !== (negocio.lng == null)) ctx.error("negocio.lat", "Indica latitud y longitud, o ninguna.");

    // horario
    let horario = [];
    if (!Array.isArray(e.horario) || e.horario.length > 14) ctx.error("horario", "Lista de tramos (máximo 14).");
    else {
      for (const [i, t] of e.horario.entries()) {
        const dias = ctx.intento(() => diasSemana(t?.dias, `horario[${i}].dias`));
        const abre = ctx.intento(() => hora(t?.abre, `horario[${i}].abre`));
        const cierra = ctx.intento(() => hora(t?.cierra, `horario[${i}].cierra`));
        if (abre && cierra && aMinutos(abre) >= aMinutos(cierra)) ctx.error(`horario[${i}]`, "La hora de cierre debe ser posterior a la de apertura.");
        if (dias && abre && cierra) horario.push({ dias, abre, cierra });
      }
    }

    const s = e.seo ?? {};
    const seo = {
      dominio: ctx.intento(() => {
        const t = texto(s.dominio, { max: 200, campo: "seo.dominio" });
        if (!t) return "";
        let u; try { u = new URL(t); } catch { throw new ErrorValidacion("seo.dominio", "Dirección completa con https:// (por ejemplo https://mitienda.es)."); }
        if (u.protocol !== "https:") throw new ErrorValidacion("seo.dominio", "Dirección completa con https:// (por ejemplo https://mitienda.es).");
        return u.origin;
      }),
      titulo: ctx.intento(() => texto(s.titulo, { min: 1, max: 90, campo: "seo.titulo" })),
      descripcion: ctx.intento(() => texto(s.descripcion, { min: 1, max: 200, campo: "seo.descripcion" })),
    };

    const t = e.tienda ?? {};
    const tienda = {
      activa: booleano(t.activa),
      aviso: ctx.intento(() => texto(t.aviso, { max: 300, campo: "tienda.aviso" })),
      pedidoMinimo: ctx.intento(() => numeroOpcional(t.pedidoMinimo, { campo: "tienda.pedidoMinimo", max: 10000 })),
      redondeo: t.redondeo === 90 || t.redondeo === 95 ? t.redondeo : null,
      antelacionHoras: ctx.intento(() => entero(t.antelacionHoras ?? 2, { campo: "tienda.antelacionHoras", max: 168 })),
      diasMaximos: ctx.intento(() => entero(t.diasMaximos ?? 14, { campo: "tienda.diasMaximos", min: 1, max: 60 })),
      diasSinServicio: ctx.intento(() => { const l = Array.isArray(t.diasSinServicio) ? t.diasSinServicio : []; if (l.length > 120) throw new ErrorValidacion("tienda.diasSinServicio", "Máximo 120 fechas."); return [...new Set(l.map((x) => fechaISO(x, "tienda.diasSinServicio")))].sort(); }) ?? [],
      recogida: undefined, reparto: undefined, pagos: undefined,
      textoEntrega: ctx.intento(() => texto(t.textoEntrega, { max: 300, campo: "tienda.textoEntrega" })),
    };
    const franjas = (lista, campo) => ctx.intento(() => { if (!Array.isArray(lista) || lista.length > 12) throw new ErrorValidacion(campo, "Lista de franjas (máximo 12)."); return [...new Set(lista.map((f) => franja(f, campo)))]; });
    const r = t.recogida ?? {};
    tienda.recogida = { activa: booleano(r.activa), dias: ctx.intento(() => diasSemana(r.dias ?? [], "tienda.recogida.dias")), franjas: franjas(r.franjas ?? [], "tienda.recogida.franjas") };
    const rp = t.reparto ?? {};
    tienda.reparto = {
      activo: booleano(rp.activo),
      zona: ctx.intento(() => texto(rp.zona, { max: 200, campo: "tienda.reparto.zona" })),
      minimo: ctx.intento(() => numeroOpcional(rp.minimo, { campo: "tienda.reparto.minimo", max: 10000 })),
      coste: ctx.intento(() => numeroOpcional(rp.coste, { campo: "tienda.reparto.coste", max: 1000 })),
      gratisDesde: ctx.intento(() => numeroOpcional(rp.gratisDesde, { campo: "tienda.reparto.gratisDesde", max: 10000 })),
      codigosPostales: ctx.intento(() => codigosPostales(rp.codigosPostales, "tienda.reparto.codigosPostales")) ?? [],
      radioKm: ctx.intento(() => numeroOpcional(rp.radioKm, { campo: "tienda.reparto.radioKm", min: 0.5, max: 100, decimales: 1 })),
      dias: ctx.intento(() => diasSemana(rp.dias ?? [], "tienda.reparto.dias")),
      franjas: franjas(rp.franjas ?? [], "tienda.reparto.franjas"),
    };
    const p = t.pagos ?? {};
    tienda.pagos = {
      efectivo: booleano(p.efectivo), tarjetaRecogida: booleano(p.tarjetaRecogida), bizum: booleano(p.bizum), transferencia: booleano(p.transferencia),
      bizumNumero: ctx.intento(() => texto(p.bizumNumero, { max: 30, campo: "tienda.pagos.bizumNumero" })),
      transferenciaDatos: ctx.intento(() => texto(p.transferenciaDatos, { max: 200, campo: "tienda.pagos.transferenciaDatos" })),
    };
    if (tienda.reparto.radioKm != null && negocio.lat == null) ctx.error("tienda.reparto.radioKm", "Para usar el radio hay que indicar la latitud y la longitud de la tienda (pestaña Negocio).");
    if (tienda.activa) {
      if (!tienda.recogida.activa && !tienda.reparto.activo) ctx.error("tienda", "Activa al menos recogida o reparto.");
      const p2 = tienda.pagos;
      if (!(p2.efectivo || p2.tarjetaRecogida || p2.bizum || p2.transferencia)) ctx.error("tienda.pagos", "Activa al menos una forma de pago.");
    }
    return { negocio, horario, seo, tienda };
  });
}
