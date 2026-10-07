// API del panel de administración. Todo menos el acceso exige sesión; todo lo que modifica
// datos exige además mismo origen y la cabecera propia del panel (defensa frente a CSRF).
import { json, error, leerJson, leerBytes, ErrorHttp, esHttps, tipoImagen } from "./http.mjs";
import {
  configuracionAuth, compararPassword, crearSesion, verificarSesion, leerCookie, cookieSesion, cookieBorrar,
  NOMBRE_COOKIE, peticionDeMismoOrigen, evaluarIntentos, registrarFallo, huellaIp,
} from "./auth.mjs";
import { validarAjustes } from "./ajustes.mjs";
import { validarProducto, aplicarRedondeoATodos } from "./productos.mjs";
import { categorias } from "./datos.generado.mjs";
import { randomUUID } from "node:crypto";

const IDS_CATEGORIA = categorias.map((c) => c.id);
const ESTADOS_PEDIDO = ["nuevo", "confirmado", "preparado", "entregado", "cancelado"];
const MAX_FOTO = 700 * 1024;

export async function manejarAdmin(req, deps) {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/api\/admin/, "") || "/";
  const metodo = req.method;
  const auth = configuracionAuth(deps.env);
  const seguro = esHttps(req);

  try {
    if (!auth.ok) return error(503, "El panel no está configurado: " + auth.problemas.join(" "));

    // ---- acceso ----
    if (ruta === "/login" && metodo === "POST") return await acceder(req, deps, auth, seguro);
    if (ruta === "/logout" && metodo === "POST") {
      if (!peticionDeMismoOrigen(req)) return error(403, "Petición no permitida.");
      return json(200, { ok: true }, { "Set-Cookie": cookieBorrar({ seguro }) });
    }

    const sesionOk = verificarSesion(leerCookie(req.headers.get("cookie"), NOMBRE_COOKIE), auth.secreto, deps.ahora());
    if (!sesionOk) return error(401, "Sesión no iniciada o caducada.");
    if (metodo !== "GET" && metodo !== "HEAD" && !peticionDeMismoOrigen(req)) return error(403, "Petición no permitida.");

    if (ruta === "/yo" && metodo === "GET") return json(200, { ok: true });

    if (ruta === "/datos" && metodo === "GET") {
      const [ajustes, productos] = await Promise.all([deps.almacen.leerAjustes(), deps.almacen.leerProductos()]);
      return json(200, { ok: true, ajustes, productos, categorias });
    }

    if (ruta === "/ajustes" && metodo === "PUT") {
      const v = validarAjustes(await leerJson(req));
      if (!v.ok) return json(400, { ok: false, errores: v.errores });
      await deps.almacen.guardarAjustes(v.valor);
      await deps.purgar(["paginas", "catalogo"]);
      return json(200, { ok: true, ajustes: v.valor });
    }

    if (ruta === "/producto" && metodo === "PUT") {
      const entrada = await leerJson(req);
      const ajustes = await deps.almacen.leerAjustes();
      const v = validarProducto(entrada, { categorias: IDS_CATEGORIA, redondeo: ajustes.tienda.redondeo });
      if (!v.ok) return json(400, { ok: false, errores: v.errores });
      let guardado, fotoAnterior = null;
      await deps.almacen.actualizarProductos((lista) => {
        const i = lista.findIndex((p) => p.id === v.valor.id);
        const esNuevo = typeof entrada.id !== "string" || !entrada.id; // sin id previo: se crea desde el nombre
        if (esNuevo && i >= 0) throw new ErrorHttp(409, "Ya existe un producto con ese nombre.");
        if (i >= 0) { fotoAnterior = lista[i].foto; guardado = { ...v.valor, orden: v.valor.orden || lista[i].orden }; lista[i] = guardado; }
        else { const maxOrden = lista.reduce((m, p) => Math.max(m, p.orden), 0); guardado = { ...v.valor, orden: maxOrden + 1 }; lista.push(guardado); }
        return lista;
      });
      if (fotoAnterior && fotoAnterior !== guardado.foto) await deps.almacen.borrarFoto(fotoAnterior); // foto sustituida o quitada
      await deps.purgar(["catalogo"]);
      return json(200, { ok: true, producto: guardado });
    }

    if (ruta === "/producto" && metodo === "DELETE") {
      const id = url.searchParams.get("id") ?? "";
      let foto = null, existia = false;
      await deps.almacen.actualizarProductos((lista) => {
        const i = lista.findIndex((p) => p.id === id);
        if (i < 0) return lista;
        existia = true; foto = lista[i].foto; lista.splice(i, 1); return lista;
      });
      if (!existia) return error(404, "Producto no encontrado.");
      if (foto) await deps.almacen.borrarFoto(foto);
      await deps.purgar(["catalogo"]);
      return json(200, { ok: true });
    }

    if (ruta === "/redondeo" && metodo === "POST") {
      const { final } = await leerJson(req);
      if (final !== 90 && final !== 95) return error(400, "El final debe ser 90 o 95.");
      let tocados = 0;
      await deps.almacen.actualizarProductos((lista) => { const nueva = aplicarRedondeoATodos(lista, final); tocados = nueva.filter((p, i) => p.precio !== lista[i].precio).length; return nueva; });
      await deps.purgar(["catalogo"]);
      return json(200, { ok: true, tocados });
    }

    if (ruta === "/foto" && metodo === "POST") {
      const bytes = await leerBytes(req, MAX_FOTO);
      const tipo = tipoImagen(bytes);
      if (!tipo) return error(415, "Solo se admiten fotos JPG, PNG o WebP.");
      const id = randomUUID();
      await deps.almacen.guardarFoto(id, bytes, tipo);
      return json(201, { ok: true, id });
    }

    if (ruta === "/pedidos" && metodo === "GET") return json(200, { ok: true, pedidos: await deps.almacen.listarPedidos(500) });

    if (ruta === "/pedidos.csv" && metodo === "GET") {
      return new Response(csvPedidos(await deps.almacen.listarPedidos(5000)), { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pedidos.csv"', "Cache-Control": "no-store" } });
    }

    if (ruta === "/pedido" && metodo === "PATCH") {
      const { numero, estado, notaInterna } = await leerJson(req);
      if (typeof numero !== "string" || !/^LE-\d{4}-\d{4}$/.test(numero)) return error(400, "Número de pedido no válido.");
      const cambios = {};
      if (estado !== undefined) { if (!ESTADOS_PEDIDO.includes(estado)) return error(400, "Estado no válido."); cambios.estado = estado; }
      if (notaInterna !== undefined) { if (typeof notaInterna !== "string" || notaInterna.length > 500) return error(400, "Nota demasiado larga."); cambios.notaInterna = notaInterna; }
      try { return json(200, { ok: true, pedido: await deps.almacen.actualizarPedido(numero, cambios) }); } catch (e) { if (/no encontrado/i.test(e.message)) return error(404, "Pedido no encontrado."); throw e; }
    }

    if (ruta === "/pedido" && metodo === "DELETE") {
      const numero = url.searchParams.get("numero") ?? "";
      if (!/^LE-\d{4}-\d{4}$/.test(numero)) return error(400, "Número de pedido no válido.");
      await deps.almacen.borrarPedido(numero);
      return json(200, { ok: true });
    }

    if (ruta === "/diagnostico" && metodo === "GET") return json(200, { ok: true, ...(await diagnostico(deps)) });

    return error(404, "No existe.");
  } catch (e) {
    if (e instanceof ErrorHttp) return error(e.estado, e.message);
    console.error("Error en el panel:", e);
    return error(500, "Error interno. Inténtalo de nuevo.");
  }
}

async function acceder(req, deps, auth, seguro) {
  if (!peticionDeMismoOrigen(req)) return error(403, "Petición no permitida.");
  const huella = huellaIp(deps.ip);
  const ahora = deps.ahora();
  const estado = await deps.almacen.leerIntentos(huella);
  const ev = evaluarIntentos(estado, ahora);
  if (ev.bloqueado) return error(429, `Demasiados intentos. Espera ${Math.ceil(ev.segundos / 60)} minutos.`, { "Retry-After": String(ev.segundos) });
  const { password } = await leerJson(req, 2048);
  if (!compararPassword(password, auth.password)) {
    await deps.almacen.guardarIntentos(huella, registrarFallo(estado, ahora));
    return error(401, "Contraseña incorrecta.");
  }
  if (estado) await deps.almacen.borrarIntentos(huella);
  return json(200, { ok: true }, { "Set-Cookie": cookieSesion(crearSesion(auth.secreto, ahora), { seguro }) });
}

function celdaCsv(v) {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // evita fórmulas al abrir en una hoja de cálculo
  return `"${t.replace(/"/g, '""')}"`;
}
const euros = (c) => (c / 100).toFixed(2).replace(".", ","); // coma decimal: se abre bien en Excel en español
export function csvPedidos(pedidos) {
  const cab = ["numero", "creado", "estado", "cliente", "telefono", "entrega", "dia", "franja", "direccion", "pago", "subtotal_eur", "envio_eur", "total_eur", "por_consultar", "lineas", "comentarios", "nota_interna"];
  const filas = pedidos.map((p) => [
    p.numero, p.creado, p.estado, p.cliente.nombre, p.cliente.telefono, p.entrega.tipo, p.entrega.dia, p.entrega.franja, p.entrega.direccion, p.pago,
    euros(p.subtotalCent), euros(p.envioCent), euros(p.totalCent), p.consultar,
    p.lineas.map((l) => `${l.nombre} ${l.cantidad}${l.unidad === "kg" ? " g" : " ud"}${l.opcion ? ` (${l.opcion})` : ""}${l.nota ? ` [${l.nota}]` : ""}`).join(" | "),
    p.comentarios, p.notaInterna,
  ]);
  return "﻿" + [cab, ...filas].map((f) => f.map(celdaCsv).join(";")).join("\r\n") + "\r\n";
}

async function diagnostico(deps) {
  const auth = configuracionAuth(deps.env);
  const r = { configuracion: auth.ok ? "correcta" : auth.problemas, escrituraLectura: "pendiente" };
  try {
    const sonda = `sonda-${Date.now()}`;
    await deps.almacen.guardarIntentos(sonda, { n: 0, desde: 0 });
    const leida = await deps.almacen.leerIntentos(sonda);
    await deps.almacen.borrarIntentos(sonda);
    r.escrituraLectura = leida?.n === 0 ? "correcta (lee lo que acaba de escribir)" : "FALLA: no lee lo que acaba de escribir";
  } catch (e) { r.escrituraLectura = `FALLA: ${e.message}`; }
  try {
    const p = await deps.almacen.probarEscrituraExclusiva();
    r.numerosUnicos = p.ganadores === 1
      ? `correcta (de ${p.intentos} escrituras simultáneas solo 1 ganó)`
      : `FALLA: ${p.ganadores} de ${p.intentos} escrituras simultáneas ganaron. Dos pedidos a la vez podrían recibir el mismo número y pisarse. Avisa a quien mantiene la web.`;
    r.edicionesSimultaneas = p.conEtag ? "correcta (el almacén detecta ediciones a la vez)" : "no disponible: dos ediciones a la vez de los productos podrían pisarse";
  } catch (e) { r.numerosUnicos = `FALLA: ${e.message}`; }
  return r;
}
