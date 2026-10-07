// Portada: escaparate «Oferta(s) de la semana». Se pinta desde /api/catalogo (que ya sabe qué hay activo hoy), no desde la
// propia página, porque la página se guarda en caché unos minutos y las ofertas empiezan y acaban por fechas.
import { pintarDestacadas } from "/assets/destacadas.js";

const seccion = document.getElementById("ofertas");
if (seccion) {
  fetch("/api/catalogo", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((cat) => { if (cat?.ok) pintarDestacadas(cat, { seccion, titulo: document.getElementById("ofertas-titulo"), lista: document.getElementById("ofertas-lista"), enTienda: false }); })
    .catch(() => { /* sin conexión o sin catálogo: la portada se ve igual, sin esta sección */ });
}
