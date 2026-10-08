// Validación y cálculo de un pedido. TODO lo que importa (existencia de productos, precios,
// cantidades, totales, disponibilidad de día y franja) se decide aquí, en el servidor:
// el navegador del cliente solo envía lo que quiere, nunca lo que cuesta.
import { texto, telefonoEspana, fechaISO, recoger, ErrorValidacion } from "./validar.mjs";
import { cantidadValida, aCentimos, formatoCantidad, formatoEuro } from "./dinero.mjs";
import { calcularLineas, regalosDelPedido, nombreOferta, activoHoy } from "./ofertas.mjs";
import { esPorEncargo, sePuedePedir } from "./encargo.mjs";
import { diaSemanaDeFecha, sumarDias, aMinutos, franjaDentroDeHorario } from "./horario.mjs";

const MAX_LINEAS = 60;
const FORMAS_PAGO = ["efectivo", "tarjeta", "bizum", "transferencia"];

const RE_CP = /^\d{5}$/;
const limpiarCp = (v) => String(v ?? "").replace(/\s+/g, "");

// ¿Hay que localizar la dirección para saber si cae dentro del radio de reparto? Devuelve el texto a buscar o null.
export function consultaGeocodificacion(entrada, ajustes) {
  const en = entrada?.entrega ?? {};
  const rp = ajustes.tienda.reparto;
  if (en.tipo !== "reparto" || !rp.activo || rp.radioKm == null) return null;
  const cp = limpiarCp(en.cp);
  const direccion = typeof en.direccion === "string" ? en.direccion.trim() : "";
  if (!RE_CP.test(cp) || direccion.length < 8 || direccion.length > 200 || (rp.codigosPostales ?? []).includes(cp)) return null;
  return `${direccion}, ${cp} ${ajustes.negocio.localidad}, España`;
}

// `geo` = { distanciaKm } cuando se ha podido localizar la dirección; null si no hacía falta o no se localizó.
export function validarPedido(entrada, { productos, ajustes, ahora, geo = null }) {
  return recoger((ctx) => {
    const e = entrada ?? {};
    const t = ajustes.tienda;
    if (!t.activa) { ctx.error("tienda", "La tienda no está aceptando pedidos ahora mismo."); return null; }

    const porId = new Map(productos.map((p) => [p.id, p]));

    // ---- líneas ----
    const lineas = [];
    if (!Array.isArray(e.lineas) || e.lineas.length === 0) ctx.error("lineas", "El pedido está vacío.");
    else if (e.lineas.length > MAX_LINEAS) ctx.error("lineas", `Máximo ${MAX_LINEAS} productos por pedido.`);
    else {
      const fusion = new Map();
      for (const [i, l] of e.lineas.entries()) {
        const p = typeof l?.id === "string" ? porId.get(l.id) : undefined;
        if (!p || !activoHoy(p, ahora.fecha)) { ctx.error(`lineas[${i}]`, "Producto no disponible."); continue; }
        if (!sePuedePedir(p)) { ctx.error(`lineas[${i}]`, `${p.nombre} está agotado.`); continue; }
        const opcion = ctx.intento(() => texto(l.opcion, { max: 40, campo: `lineas[${i}].opcion` })) ?? "";
        if (opcion && !p.opciones.includes(opcion)) { ctx.error(`lineas[${i}].opcion`, `Opción no válida para ${p.nombre}.`); continue; }
        const nota = ctx.intento(() => texto(l.nota, { max: 140, campo: `lineas[${i}].nota` })) ?? "";
        const clave = `${p.id}\u0000${opcion}\u0000${nota}`;
        const previa = fusion.get(clave);
        const cantidad = (previa?.cantidad ?? 0) + (typeof l.cantidad === "number" ? l.cantidad : NaN);
        fusion.set(clave, { p, opcion, nota, cantidad });
      }
      const validas = [];
      for (const { p, opcion, nota, cantidad } of fusion.values()) {
        if (!cantidadValida(p, cantidad)) { ctx.error("lineas", `Cantidad no válida para ${p.nombre}.`); continue; }
        validas.push({ p, opcion, nota, cantidad });
      }
      // Precios y ofertas de HOY (fecha de Madrid): el servidor lo decide, el navegador solo lo enseña.
      const calculo = calcularLineas(validas.map(({ p, cantidad }) => ({ p, cantidad })), ahora.fecha);
      validas.forEach(({ p, opcion, nota, cantidad }, i) => {
        const c = calculo[i];
        lineas.push({
          id: p.id, nombre: p.nombre, unidad: p.unidad, cantidad, opcion, nota,
          precio: c.precio, precioHabitual: c.habitual, subtotalCent: c.subtotalCent, ahorroCent: c.ahorroCent,
          oferta: c.oferta ? nombreOferta(c.oferta) : "", gratis: c.gratis, alcohol: p.alcohol, porEncargo: esPorEncargo(p),
        });
      });
    }

    // ---- cliente ----
    const nombre = ctx.intento(() => texto(e.cliente?.nombre, { min: 2, max: 60, campo: "cliente.nombre" }));
    const telefono = ctx.intento(() => telefonoEspana(e.cliente?.telefono, "cliente.telefono"));

    // ---- entrega ----
    const en = e.entrega ?? {};
    const tipo = en.tipo;
    let direccion = "", cp = "", dia, franja, distanciaKm = null, zonaVerificada = true;
    if (tipo !== "recogida" && tipo !== "reparto") ctx.error("entrega.tipo", "Elige recogida o reparto.");
    else {
      const cfg = tipo === "recogida" ? t.recogida : t.reparto;
      if (!(tipo === "recogida" ? cfg.activa : cfg.activo)) ctx.error("entrega.tipo", tipo === "recogida" ? "La recogida en tienda no está disponible." : "El reparto a domicilio no está disponible.");
      else {
        if (tipo === "reparto") {
          direccion = ctx.intento(() => texto(en.direccion, { min: 8, max: 200, campo: "entrega.direccion" })) ?? "";
          cp = limpiarCp(en.cp);
          if (!RE_CP.test(cp)) { ctx.error("entrega.cp", "Código postal de 5 cifras."); cp = ""; }
          else {
            const lista = cfg.codigosPostales ?? [];
            const radio = cfg.radioKm ?? null;
            if ((lista.length || radio != null) && !lista.includes(cp)) {
              if (radio == null) ctx.error("entrega.cp", `Lo sentimos, no repartimos en el código postal ${cp}.`);
              else if (geo?.distanciaKm != null) {
                distanciaKm = geo.distanciaKm;
                if (distanciaKm > radio) ctx.error("entrega.direccion", `Esa dirección queda a unos ${String(distanciaKm).replace(".", ",")} km de la tienda y repartimos hasta ${String(radio).replace(".", ",")} km. Si crees que es un error, escríbenos por WhatsApp.`);
              } else zonaVerificada = false; // no se pudo localizar: entra el pedido y se avisa al negocio
            }
          }
        }
        dia = ctx.intento(() => fechaISO(en.dia, "entrega.dia"));
        franja = typeof en.franja === "string" && cfg.franjas.includes(en.franja) ? en.franja : (ctx.error("entrega.franja", "Elige una franja horaria de la lista."), undefined);
        if (dia) {
          const limite = sumarDias(ahora.fecha, t.diasMaximos);
          const dow = diaSemanaDeFecha(dia);
          if (dia < ahora.fecha) ctx.error("entrega.dia", "Esa fecha ya ha pasado.");
          else if (dia > limite) ctx.error("entrega.dia", `Solo se admiten pedidos para los próximos ${t.diasMaximos} días.`);
          else if (t.diasSinServicio.includes(dia)) ctx.error("entrega.dia", "Ese día no hay servicio.");
          else if (!cfg.dias.includes(dow)) ctx.error("entrega.dia", "Ese día de la semana no hay servicio.");
          else if (franja) {
            if (tipo === "recogida" && !franjaDentroDeHorario(ajustes.horario, dow, franja)) ctx.error("entrega.franja", "Esa franja está fuera del horario de la tienda ese día.");
            const inicio = aMinutos(franja.split("-")[0]);
            if (dia === ahora.fecha && inicio < ahora.minutos + t.antelacionHoras * 60) ctx.error("entrega.franja", `Pedidos con al menos ${t.antelacionHoras} h de antelación.`);
          }
        }
      }
    }

    // ---- pago ----
    const pago = e.pago;
    if (!FORMAS_PAGO.includes(pago)) ctx.error("pago", "Elige una forma de pago.");
    else if (pago === "efectivo" && !t.pagos.efectivo) ctx.error("pago", "No se acepta efectivo.");
    else if (pago === "tarjeta" && !(t.pagos.tarjetaRecogida && tipo === "recogida")) ctx.error("pago", "La tarjeta solo se acepta al recoger en tienda.");
    else if (pago === "bizum" && !t.pagos.bizum) ctx.error("pago", "No se acepta Bizum.");
    else if (pago === "transferencia" && !t.pagos.transferencia) ctx.error("pago", "No se acepta transferencia.");

    const comentarios = ctx.intento(() => texto(e.comentarios, { max: 500, multilinea: true, campo: "comentarios" })) ?? "";

    // ---- edad (vino) ----
    const mayorEdad = e.mayorEdad === true;
    if (lineas.some((l) => l.alcohol) && !mayorEdad) ctx.error("mayorEdad", "Para pedir vino debes confirmar que eres mayor de 18 años.");

    // ---- anti-spam: campo oculto que una persona no rellena ----
    if (typeof e.web === "string" && e.web.trim() !== "") ctx.error("pedido", "No se ha podido procesar el pedido.");

    // ---- totales ----
    const conPrecio = lineas.filter((l) => l.subtotalCent != null);
    const subtotalCent = conPrecio.reduce((s, l) => s + l.subtotalCent, 0);
    const consultar = lineas.length - conPrecio.length;
    const ahorroCent = lineas.reduce((s, l) => s + (l.ahorroCent ?? 0), 0);
    // Regalo por compra: se calcula sobre lo que se paga por los productos (ya con las ofertas y sin el envío)
    const regalos = regalosDelPedido(t.regalos, subtotalCent, ahora.fecha).filter((r) => r.cantidad > 0).map(({ texto, cantidad }) => ({ texto, cantidad }));
    if (consultar === 0 && lineas.length) {
      if (t.pedidoMinimo != null && subtotalCent < aCentimos(t.pedidoMinimo)) ctx.error("lineas", `El pedido mínimo es de ${formatoEuro(t.pedidoMinimo)}.`);
      if (tipo === "reparto" && t.reparto.minimo != null && subtotalCent < aCentimos(t.reparto.minimo)) ctx.error("lineas", `El pedido mínimo para reparto es de ${formatoEuro(t.reparto.minimo)}.`);
    }
    let envioCent = 0;
    if (tipo === "reparto" && t.reparto.coste != null) {
      const gratis = t.reparto.gratisDesde != null && consultar === 0 && subtotalCent >= aCentimos(t.reparto.gratisDesde);
      envioCent = gratis ? 0 : aCentimos(t.reparto.coste);
    }

    return {
      cliente: { nombre, telefono },
      entrega: { tipo, direccion, cp, dia, franja, distanciaKm, zonaVerificada },
      pago, comentarios, mayorEdad,
      lineas: lineas.map(({ alcohol, ...l }) => l),
      subtotalCent, ahorroCent, regalos, consultar, envioCent, totalCent: subtotalCent + envioCent,
      porEncargo: lineas.filter((l) => l.porEncargo).length,
    };
  });
}

export function numeroPedido(fecha, secuencia) {
  const [a, m] = fecha.split("-");
  return `LE-${a.slice(2)}${m}-${String(secuencia).padStart(4, "0")}`;
}

function etiquetaDia(fechaISOstr) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(fechaISOstr + "T12:00:00Z"));
}

const NOMBRE_PAGO = { efectivo: "Efectivo", tarjeta: "Tarjeta (al recoger)", bizum: "Bizum", transferencia: "Transferencia" };
const telefonoBonito = (t) => (/^\d{9}$/.test(t) ? `${t.slice(0, 3)} ${t.slice(3, 5)} ${t.slice(5, 7)} ${t.slice(7)}` : t);
const MAX_LINEAS_RESUMEN = 6;
const corto = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/**
 * Mensaje de WhatsApp del pedido hecho en la web. Va pensado para reconocerse de un vistazo entre los mensajes del día: cabecera «PEDIDO WEB»
 * con el número, una línea por dato con su icono, los productos en lista y un pie que dice de dónde viene. Un pedido que alguien escribe a
 * mano no tiene nada de esto. Usa el formato de WhatsApp (*negrita*).
 */
export function mensajeWhatsApp(pedido, numero, { completo = true, minimo = false, negocio = "Carnicería La Estrella" } = {}) {
  const l = [];
  const en = pedido.entrega;
  l.push(`👋 Hola, soy ${pedido.cliente.nombre}. Este es mi pedido hecho desde la web:`, "");
  l.push(`🛒 *PEDIDO WEB · ${numero}*`, "━━━━━━━━━━━━━━━━━━");
  l.push(`👤 *Cliente:* ${pedido.cliente.nombre}`);
  l.push(`📞 *Teléfono:* ${telefonoBonito(pedido.cliente.telefono)}`);
  l.push(en.tipo === "recogida" ? "🏪 *Recogida en tienda*" : "🚚 *Reparto a domicilio*");
  l.push(`📅 ${etiquetaDia(en.dia)}`, `🕐 ${en.franja}`);
  if (en.tipo === "reparto") l.push(`📍 ${en.direccion}${en.cp ? ` (${en.cp})` : ""}`);
  l.push(`💳 *Pago:* ${NOMBRE_PAGO[pedido.pago]}`, "");

  l.push("🥩 *Productos*");
  const lineas = minimo ? [] : completo ? pedido.lineas : pedido.lineas.slice(0, MAX_LINEAS_RESUMEN);
  for (const x of lineas) {
    const extra = completo ? [x.opcion, x.nota].filter(Boolean).join("; ") : corto([x.opcion, x.nota].filter(Boolean).join("; "), 30);
    const importe = x.subtotalCent == null ? "precio por confirmar" : formatoEuro(x.subtotalCent / 100);
    l.push(`▪️ ${formatoCantidad(x.cantidad, x.unidad)} · *${x.nombre}*${extra ? ` (${extra})` : ""} · ${importe}`);
    if (x.oferta) l.push(`   🏷️ ${x.oferta}${x.gratis ? `: ${formatoCantidad(x.gratis, x.unidad)} gratis` : x.precioHabitual != null ? `: ${formatoEuro(x.precio)}/${x.unidad === "kg" ? "kg" : "ud"} en vez de ${formatoEuro(x.precioHabitual)}` : ""}`);
    if (x.porEncargo) l.push("   📦 *POR ENCARGO* · precio orientativo, a confirmar antes de encargarlo");
  }
  if (!completo && pedido.lineas.length > lineas.length) l.push(`▪️ …${lineas.length ? "y " : ""}${pedido.lineas.length - lineas.length} producto${pedido.lineas.length - lineas.length === 1 ? "" : "s"}${lineas.length ? " más" : ""} (detalle completo con el número ${numero})`);
  l.push("");

  if (pedido.ahorroCent > 0) l.push(`💰 *Ahorro por ofertas:* ${formatoEuro(pedido.ahorroCent / 100)}`);
  for (const r of pedido.regalos ?? []) l.push(`🎁 *Regalo por compra:* ${r.cantidad > 1 ? `${r.cantidad} × ` : ""}${r.texto}`);
  if (pedido.subtotalCent > 0 || pedido.consultar === 0) {
    const total = formatoEuro(pedido.totalCent / 100);
    l.push(`🧾 *Total estimado: ${total}*${pedido.envioCent ? ` (incluye ${formatoEuro(pedido.envioCent / 100)} de envío)` : ""}${pedido.consultar ? ` + ${pedido.consultar} producto${pedido.consultar === 1 ? "" : "s"} por confirmar` : ""}`);
  } else l.push("🧾 *Precios por confirmar*");
  if (pedido.mayorEdad) l.push("🔞 Confirmo que soy mayor de 18 años");
  if (pedido.comentarios) l.push(`📝 *Comentarios:* ${completo ? pedido.comentarios : corto(pedido.comentarios, 100)}`);
  l.push("", "⚖️ El peso y el precio definitivos se confirman al preparar el pedido.");
  if (pedido.porEncargo > 0) l.push(`📦 ${pedido.porEncargo === 1 ? "El producto por encargo" : "Los productos por encargo"}: me confirmáis el precio antes de hacer el encargo.`);
  l.push("━━━━━━━━━━━━━━━━━━", `✅ Enviado desde la web de ${negocio}`);
  return l.join("\n");
}

// Enlace de WhatsApp. Si el texto codificado es muy largo se acorta (el pedido completo queda guardado con su número).
// 2400 caracteres es un límite prudente que me he puesto yo: no he podido comprobar cuánto admite wa.me de verdad. Los emojis ocupan
// unos 12 caracteres cada uno al codificarse, por eso un pedido de cuatro o cinco productos ya pasa de 1800.
export function enlaceWhatsApp(pedido, numero, whatsapp, maximo = 2400, negocio = undefined) {
  const url = (texto) => `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`;
  const textoCompleto = mensajeWhatsApp(pedido, numero, { completo: true, negocio });
  const completo = url(textoCompleto);
  if (completo.length <= maximo) return { url: completo, resumido: false };
  // Primero se resume la lista y, si aun así no cabe, se deja solo la cabecera y los totales
  const textoResumen = mensajeWhatsApp(pedido, numero, { completo: false, negocio });
  const resumen = url(textoResumen);
  if (resumen.length <= maximo) return { url: resumen, resumido: textoResumen !== textoCompleto };
  return { url: url(mensajeWhatsApp(pedido, numero, { completo: false, minimo: true, negocio })), resumido: true };
}
