// Escaparate de ofertas: tarjetas con las ofertas de producto y los regalos por compra que están activos hoy.
// Lo usan la portada y la tienda. Solo pinta: lo que se cobra lo calcula el servidor al hacer el pedido.
import { destacadas, tituloDestacadas, condicionRegalo, fechaCorta, nombreOferta } from "/assets/compartido/ofertas.js";
import { formatoEuro, formatoCantidad } from "/assets/compartido/dinero.js";

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

const unidadDe = (p) => (p.unidad === "kg" ? "kg" : "ud");

function foto(p) {
  if (p.foto) {
    const img = crear("img", { src: `/api/foto/${p.foto}`, alt: "", loading: "lazy", decoding: "async", width: "320", height: "160" });
    img.addEventListener("error", () => img.replaceWith(crear("span", { class: "of-ico", "aria-hidden": "true", style: `--ico:url(/assets/iconos/${p.categoria}.svg)` })));
    return img;
  }
  return crear("span", { class: "of-ico", "aria-hidden": "true", style: `--ico:url(/assets/iconos/${p.categoria}.svg)` });
}

function tarjetaProducto(t, ir) {
  const { p, oferta } = t;
  const base = p.unidad === "kg" ? 1000 : 1;
  const precio = t.habitual != null
    ? crear("p", { class: "of-precio" },
      crear("span", { class: "sr-only", texto: "Precio anterior " }), crear("s", { class: "precio-tachado", texto: `${formatoEuro(t.habitual)}/${unidadDe(p)}` }),
      crear("span", { class: "sr-only", texto: ". Precio de oferta " }), crear("span", { class: "precio-oferta", texto: `${formatoEuro(t.precio)}/${unidadDe(p)}` }))
    : crear("p", { class: "of-precio", texto: `${formatoEuro(t.precio)}/${unidadDe(p)}` });
  return crear("li", { class: "of-card" },
    crear("div", { class: "of-foto" }, foto(p)),
    crear("div", { class: "of-cuerpo" },
      crear("p", { class: "of-etiqueta", texto: nombreOferta(oferta) }),
      crear("h3", { class: "of-nombre", texto: p.nombre }),
      precio,
      oferta.tipo === "cantidad" ? crear("p", { class: "of-detalle", texto: `Llévate ${formatoCantidad(oferta.lleva * base, p.unidad)} y paga ${formatoCantidad(oferta.paga * base, p.unidad)}` }) : null,
      crear("p", { class: "of-hasta", texto: `Hasta el ${fechaCorta(t.hasta)}` }),
      ir.producto(p)));
}

function tarjetaRegalo(t, ir) {
  const r = t.regalo;
  return crear("li", { class: "of-card of-regalo" },
    crear("div", { class: "of-foto" }, crear("span", { class: "of-ico", "aria-hidden": "true", style: "--ico:url(/assets/iconos/regalo.svg)" })),
    crear("div", { class: "of-cuerpo" },
      crear("p", { class: "of-etiqueta", texto: "Regalo" }),
      crear("h3", { class: "of-nombre", texto: r.regalo }),
      crear("p", { class: "of-detalle", texto: condicionRegalo(r) }),
      t.hasta ? crear("p", { class: "of-hasta", texto: `Hasta el ${fechaCorta(t.hasta)}` }) : null,
      ir.regalo()));
}

/**
 * Pinta el escaparate. `cat` es la respuesta de /api/catalogo. Si no hay nada que enseñar, la sección sigue oculta.
 * enTienda: los enlaces llevan al producto dentro de la misma página; en la portada, a /tienda (o a WhatsApp si la tienda está cerrada).
 */
export function pintarDestacadas(cat, { seccion, titulo, lista, enTienda = false }) {
  const tarjetas = destacadas(cat.productos, cat.ajustes.tienda.regalos, cat.hoy);
  if (!tarjetas.length) { seccion.hidden = true; return 0; }
  const activa = cat.ajustes.tienda.activa;
  const wa = cat.ajustes.negocio.whatsapp;
  const enlace = (href, texto, extra = {}) => crear("a", { class: "btn btn-solid of-ver", href, texto, ...extra });
  const ir = {
    // El nombre accesible empieza por el texto visible del botón (WCAG 2.5.3) y añade de qué producto se trata
    producto: (p) => (enTienda ? enlace(`#p-${p.id}`, "Ir al producto", { "aria-label": `Ir al producto: ${p.nombre}` })
      : activa ? enlace(`/tienda#p-${p.id}`, "Pedir en la tienda", { "aria-label": `Pedir en la tienda: ${p.nombre}` })
        : enlace(`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, quiero aprovechar la oferta de ${p.nombre}.`)}`, "Pedir por WhatsApp", { target: "_blank", rel: "noopener", "aria-label": `Pedir por WhatsApp: ${p.nombre}` })),
    regalo: () => (enTienda ? enlace("#pedido", "Ver mi pedido")
      : activa ? enlace("/tienda", "Hacer un pedido")
        : enlace(`https://wa.me/${wa}?text=${encodeURIComponent("Hola, quiero hacer un pedido y aprovechar el regalo.")}`, "Pedir por WhatsApp", { target: "_blank", rel: "noopener" })),
  };
  titulo.textContent = tituloDestacadas(tarjetas.length);
  lista.replaceChildren(...tarjetas.map((t) => (t.clase === "regalo" ? tarjetaRegalo(t, ir) : tarjetaProducto(t, ir))));
  seccion.hidden = false;
  // Si las tarjetas no caben (móvil), la zona se desplaza y tiene que poder usarse con teclado
  const visor = lista.parentElement;
  const ajustar = () => { if (visor.scrollWidth > visor.clientWidth + 1) visor.setAttribute("tabindex", "0"); else visor.removeAttribute("tabindex"); };
  ajustar();
  addEventListener("resize", ajustar);
  return tarjetas.length;
}
