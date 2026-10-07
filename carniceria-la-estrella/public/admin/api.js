// Llamadas al servidor. Siempre con la cabecera propia del panel (defensa frente a CSRF) y,
// si la sesión caduca, se avisa para volver a la pantalla de acceso.
let alCaducar = () => {};
export function cuandoCaduque(fn) { alCaducar = fn; }

export async function api(ruta, { metodo = "GET", cuerpo, bytes, tipo } = {}) {
  const cabeceras = { "X-Requested-With": "ls-panel" };
  let body;
  if (bytes !== undefined) { body = bytes; cabeceras["Content-Type"] = tipo; }
  else if (cuerpo !== undefined) { body = JSON.stringify(cuerpo); cabeceras["Content-Type"] = "application/json"; }
  let r;
  try { r = await fetch(`/api/admin${ruta}`, { method: metodo, headers: cabeceras, body, credentials: "same-origin" }); }
  catch { return { ok: false, estado: 0, errores: [{ campo: "", mensaje: "Sin conexión con el servidor. Comprueba internet e inténtalo de nuevo." }] }; }
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo JSON */ }
  if (r.status === 401 && ruta !== "/login" && ruta !== "/yo") alCaducar();
  if (r.ok && datos?.ok !== false) return { ok: true, estado: r.status, datos };
  return { ok: false, estado: r.status, errores: datos?.errores ?? [{ campo: "", mensaje: `Error ${r.status}.` }] };
}

export const textoErrores = (errores) => errores.map((e) => e.mensaje).join(" ");
