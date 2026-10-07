// Páginas HTML con los datos del negocio: plantillas + ajustes -> HTML (con SEO, datos
// estructurados, horario y mapa generados desde el panel).
import { textosLegales } from "./legal.mjs";
import { createHash } from "node:crypto";
import { plantillas } from "./plantillas.generado.mjs";
import { categorias } from "./datos.generado.mjs";
import { filasHorario, especificacionJsonLd } from "./horario.mjs";

export function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function jsonParaScript(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function telefonoEspaciado(t) { return t.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4"); }

export function resumenHorario(horario) {
  return filasHorario(horario).map((f) => `${f.etiqueta}: ${f.cerrado ? "cerrado" : f.texto}`).join("; ");
}

// Preguntas frecuentes: una sola fuente para el HTML y para los datos estructurados.
export function preguntasFrecuentes(ajustes) {
  const n = ajustes.negocio;
  const tel = telefonoEspaciado(n.telefono);
  const p = [
    ["¿Puedo pagar con tarjeta?", "Sí, aceptamos tarjeta y efectivo."],
    ["¿Tenéis WhatsApp para pedidos?", `Sí, puedes escribirnos al mismo número de teléfono, ${tel}, para dejarnos tu encargo.`],
  ];
  if (ajustes.tienda.activa) {
    const entrega = [ajustes.tienda.recogida.activa && "recogida en tienda", ajustes.tienda.reparto.activo && "reparto a domicilio"].filter(Boolean).join(" o ");
    p.push(["¿Puedo hacer el pedido por internet?", `Sí, desde la tienda online: eliges los productos y la cantidad, y el pedido nos llega por WhatsApp. Puedes elegir ${entrega}. El pago se hace al recoger o recibir el pedido.`]);
  }
  p.push(
    ["¿Cortáis la carne al gusto?", "Sí. Dinos cómo la necesitas (gruesa, fina, en tacos, para guisar…) y te la preparamos en el momento."],
    ["¿Hacéis pedidos para barbacoas o celebraciones?", "Sí. Para encargos grandes te recomendamos avisar con unos días de margen para tenerlo todo listo."],
    ["¿Tenéis charcutería e ibéricos?", "Sí: embutidos y curados en general, y en ibérico tenemos carnes, jamones, paletillas, embutidos y quesos."],
    ["¿Tenéis elaborados para cocinar en casa?", "Sí: hamburguesas, salchichas, pinchitos, San Jacobos, flamenquines y demás elaborados de la casa; pregúntanos por lo que tenemos ese día."],
    ["¿Qué días abrís?", `Este es nuestro horario: ${resumenHorario(ajustes.horario)}. El horario completo está más abajo, en "Visítanos".`],
    ["¿Dónde estáis exactamente?", `En ${n.calle}, en el barrio de ${n.barrio}, ${n.distrito}, ${n.localidad}.`],
  );
  return p;
}

function faqHtml(preguntas) {
  return preguntas.map(([q, a]) => `        <details class="faq-item reveal">\n          <summary>${escapar(q)}</summary>\n          <p>${escapar(a)}</p>\n        </details>`).join("\n");
}

function jsonLdNegocio(ajustes, base) {
  const n = ajustes.negocio;
  const productos = categorias.map((c) => ({ "@type": "Offer", itemOffered: { "@type": "Product", name: c.id === "caza" ? "Caza (de temporada)" : c.nombre } }));
  const servicios = ["Cortes al gusto y encargos por WhatsApp", "Pedidos para barbacoas y eventos", "Pedidos para bares y restaurantes"]
    .map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } }));
  if (ajustes.tienda.activa) servicios.unshift({ "@type": "Offer", itemOffered: { "@type": "Service", name: "Tienda online con recogida y reparto" } });
  const o = {
    "@context": "https://schema.org",
    "@type": "GroceryStore",
    name: n.nombre,
    description: ajustes.seo.descripcion,
    image: `${base}/assets/og-image.png`,
    url: `${base}/`,
    telephone: `+34${n.telefono}`,
    address: { "@type": "PostalAddress", streetAddress: n.calle, addressLocality: n.localidad, addressRegion: n.region, postalCode: n.cp, addressCountry: "ES" },
    areaServed: { "@type": "AdministrativeArea", name: `${n.distrito}, ${n.localidad}` },
    ...(n.lat != null && n.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: n.lat, longitude: n.lng } } : {}),
    ...(n.mapsUrl ? { hasMap: n.mapsUrl } : {}),
    currenciesAccepted: "EUR",
    openingHoursSpecification: especificacionJsonLd(ajustes.horario),
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Qué encontrarás", itemListElement: [...productos, ...servicios] },
  };
  return o;
}

function jsonLdFaq(preguntas) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: preguntas.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

function tablaHorario(horario) {
  return filasHorario(horario).map((f) => `                <tr${f.cerrado ? ' class="closed"' : ""}><td>${escapar(f.etiqueta)}</td><td>${escapar(f.texto)}</td></tr>`).join("\n");
}

export function base(ajustes, origen = "") {
  return (ajustes.seo.dominio || origen || "").replace(/\/$/, "");
}

export function contexto(ajustes, { origen = "", ahora = new Date() } = {}) {
  const n = ajustes.negocio;
  const dir = `${n.calle}, ${n.cp} ${n.localidad}`;
  const wa = (texto) => `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(texto)}`;
  const preguntas = preguntasFrecuentes(ajustes);
  const dominio = base(ajustes, origen);
  const activa = ajustes.tienda.activa;
  return {
    anio: new Intl.DateTimeFormat("es-ES", { year: "numeric", timeZone: "Europe/Madrid" }).format(ahora),
    negocio: {
      ...n,
      telefonoE164: `+34${n.telefono}`,
      telefonoEspaciado: telefonoEspaciado(n.telefono),
      telefonoNbsp: telefonoEspaciado(n.telefono).replace(/ /g, "&nbsp;"),
      direccionCompleta: dir,
      eyebrow: `${n.barrio.replace(/\s*\(.*\)\s*/, "")} · ${n.distrito} · ${n.localidad}`,
      waPedido: wa(`¡Hola! Quiero hacer un pedido en ${n.nombre}.`),
      waContacto: wa(`¡Hola! Os escribo desde la web de ${n.nombre}.`),
      waHosteleria: wa("¡Hola! Tengo un bar o restaurante y quiero consultar un pedido para mi negocio."),
      mapaSrc: n.lat != null && n.lng != null ? `https://www.google.com/maps?q=${n.lat},${n.lng}&z=17&output=embed` : `https://www.google.com/maps?q=${encodeURIComponent(dir)}&z=17&output=embed`,
      nota: n.notaGoogle,
    },
    seo: { ...ajustes.seo, dominio, canonica: `${dominio}/` },
    tienda: {
      activa,
      enlacePedir: activa ? "/tienda" : wa(`¡Hola! Quiero hacer un pedido en ${n.nombre}.`),
      etiquetaPedir: activa ? "Hacer pedido online" : "Pedir por WhatsApp",
      etiquetaCorta: activa ? "Pedir" : "Pedir",
      externo: activa ? "" : ' target="_blank" rel="noopener"',
      aviso: ajustes.tienda.aviso,
      catalogoExtra: activa
        ? "Cordero y cabrito, avíos del puchero, especias, salsas, vinos y mucho más. En la tienda online están todos los productos, con sus cortes, y puedes hacer el pedido para recoger o recibir en casa."
        : "También tenemos cordero y cabrito, avíos del puchero, especias, salsas y vinos. Pregúntanos por ellos por WhatsApp o en la tienda.",
    },
    horario: { filasHtml: tablaHorario(ajustes.horario) },
    faq: { html: faqHtml(preguntas) },
    jsonld: { negocio: jsonParaScript(jsonLdNegocio(ajustes, dominio)), faq: jsonParaScript(jsonLdFaq(preguntas)) },
    css: { base: plantillas["base.css"] },
    legal: textosLegales(ajustes, escapar),
    categorias: { json: jsonParaScript(categorias) },
  };
}

function valorDe(ctx, ruta) {
  return ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}

const RE_TOKEN = /\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)(?:\|(url))?\s*\}\}/g;

export function aplicarPlantilla(texto, ctx, { estricto = true } = {}) {
  return texto.replace(RE_TOKEN, (_, rawRuta, ruta, modo) => {
    const r = rawRuta ?? ruta;
    const v = valorDe(ctx, r);
    if (v === undefined || v === null) { if (estricto) throw new Error(`Falta el dato "${r}" para la plantilla`); return ""; }
    if (rawRuta) return String(v);
    if (modo === "url") return encodeURIComponent(String(v));
    return escapar(v);
  });
}

// Datos que cambian según la página que usa las piezas comunes (cabecera, pie y barra móvil).
function datosDePagina(nombre, ctx) {
  if (nombre === "tienda.html") {
    return { p: "/", inicio: "/", enlacePedir: "#pedido", externo: "", etiquetaPedir: "Ver mi pedido", etiquetaCorta: "Mi pedido" };
  }
  return { p: "", inicio: "#inicio", enlacePedir: ctx.tienda.enlacePedir, externo: ctx.tienda.externo, etiquetaPedir: ctx.tienda.etiquetaPedir, etiquetaCorta: "Pedir" };
}

export function renderizarPagina(nombre, ajustes, opciones = {}) {
  const plantilla = plantillas[nombre];
  if (plantilla === undefined) throw new Error(`Plantilla desconocida: ${nombre}`);
  const ctx = contexto(ajustes, opciones);
  ctx.pagina = datosDePagina(nombre, ctx);
  ctx.parcial = {
    cabecera: aplicarPlantilla(plantillas["parcial-cabecera.html"], ctx),
    pie: aplicarPlantilla(plantillas["parcial-pie.html"], ctx),
    barra: aplicarPlantilla(plantillas["parcial-barra.html"], ctx),
  };
  return aplicarPlantilla(plantilla, ctx);
}

// Política de seguridad de contenido: los dos scripts en línea de la página se permiten por su huella.
export function cspParaHtml(html) {
  const huellas = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    if (/type=["']application\/ld\+json["']/.test(m[1])) continue;
    huellas.push(`'sha256-${createHash("sha256").update(m[2]).digest("base64")}'`);
  }
  return [
    "default-src 'self'", `script-src 'self' ${huellas.join(" ")}`.trim(), "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    "frame-src https://www.google.com", "connect-src 'self'", "form-action 'self'", "frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'",
  ].join("; ");
}
