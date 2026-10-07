// Parte pública de la API: catálogo, fotos y pedidos.
import { json, error, leerJson, ErrorHttp, CABECERAS_SEGURIDAD } from "./http.mjs";
import { catalogoPublico } from "./productos.mjs";
import { categorias } from "./datos.generado.mjs";
import { validarPedido, enlaceWhatsApp, consultaGeocodificacion } from "./pedido.mjs";
import { distanciaKm, redondear1 } from "./geocodificar.mjs";
import { ahoraEnMadrid } from "./horario.mjs";

const CACHE_CATALOGO = "public, durable, max-age=30, stale-while-revalidate=300";

// Solo lo que necesita el navegador para pintar la tienda y el formulario.
export function ajustesPublicos(a) {
  const t = a.tienda;
  return {
    negocio: { nombre: a.negocio.nombre, telefono: a.negocio.telefono, whatsapp: a.negocio.whatsapp, calle: a.negocio.calle, cp: a.negocio.cp, localidad: a.negocio.localidad },
    horario: a.horario,
    tienda: {
      activa: t.activa, aviso: t.aviso, pedidoMinimo: t.pedidoMinimo, antelacionHoras: t.antelacionHoras, diasMaximos: t.diasMaximos, diasSinServicio: t.diasSinServicio, textoEntrega: t.textoEntrega,
      recogida: t.recogida,
      reparto: { activo: t.reparto.activo, zona: t.reparto.zona, codigosPostales: t.reparto.codigosPostales, radioKm: t.reparto.radioKm, minimo: t.reparto.minimo, coste: t.reparto.coste, gratisDesde: t.reparto.gratisDesde, dias: t.reparto.dias, franjas: t.reparto.franjas },
      pagos: { efectivo: t.pagos.efectivo, tarjetaRecogida: t.pagos.tarjetaRecogida, bizum: t.pagos.bizum, transferencia: t.pagos.transferencia },
    },
  };
}

export async function catalogo(deps) {
  const [ajustes, productos, meta] = await Promise.all([deps.almacen.leerAjustes(), deps.almacen.leerProductos(), deps.almacen.leerMeta().catch(() => ({}))]);
  const publico = catalogoPublico(productos);
  const usadas = new Set(publico.map((p) => p.categoria));
  const cuerpo = {
    ok: true,
    ajustes: ajustesPublicos(ajustes),
    hoy: ahoraEnMadrid(new Date(deps.ahora())).fecha,
    preciosActualizados: meta?.precios ? ahoraEnMadrid(new Date(meta.precios)).fecha : null,
    categorias: categorias.filter((c) => usadas.has(c.id)),
    productos: publico,
  };
  return json(200, cuerpo, { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": CACHE_CATALOGO, "Netlify-Cache-Tag": "catalogo" });
}

export async function foto(id, deps) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return error(404, "No encontrada.");
  const f = await deps.almacen.leerFoto(id);
  if (!f) return error(404, "No encontrada.");
  return new Response(f.bytes, { status: 200, headers: { "Content-Type": f.tipo, "Cache-Control": "public, max-age=31536000, immutable", "Content-Security-Policy": "default-src 'none'", ...CABECERAS_SEGURIDAD } });
}

export async function crearPedido(req, deps) {
  if (req.method !== "POST") return error(405, "Método no permitido.", { Allow: "POST" });
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return error(415, "Formato no admitido.");
  let entrada;
  try { entrada = await leerJson(req); } catch (e) { if (e instanceof ErrorHttp) return error(e.estado, e.message); throw e; }

  const [ajustes, productos] = await Promise.all([deps.almacen.leerAjustes(), deps.almacen.leerProductos()]);
  const ahora = ahoraEnMadrid(new Date(deps.ahora()));
  // Radio de reparto: solo si hace falta, se localiza la dirección (servicio externo; si falla, el pedido entra «por verificar»)
  let geo = null;
  const consulta = consultaGeocodificacion(entrada, ajustes);
  if (consulta && deps.geocodificar && ajustes.negocio.lat != null) {
    const punto = await deps.geocodificar(consulta);
    if (punto) geo = { distanciaKm: redondear1(distanciaKm(punto, { lat: ajustes.negocio.lat, lng: ajustes.negocio.lng })) };
  }
  const v = validarPedido(entrada, { productos, ajustes, ahora, geo });
  if (!v.ok) return json(400, { ok: false, errores: v.errores });

  const pedido = await deps.almacen.crearPedido(ahora.fecha, (numero) => ({
    numero, creado: new Date(deps.ahora()).toISOString(), estado: "nuevo", notaInterna: "", ...v.valor,
  }));
  const enlace = enlaceWhatsApp(pedido, pedido.numero, ajustes.negocio.whatsapp);
  return json(201, {
    ok: true, numero: pedido.numero, whatsappUrl: enlace.url, resumido: enlace.resumido,
    resumen: { lineas: pedido.lineas.length, subtotalCent: pedido.subtotalCent, envioCent: pedido.envioCent, totalCent: pedido.totalCent, consultar: pedido.consultar },
  });
}
