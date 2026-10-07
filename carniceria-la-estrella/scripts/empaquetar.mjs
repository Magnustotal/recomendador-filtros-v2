// Convierte plantillas y datos por defecto en módulos JS, para que las funciones de Netlify
// no dependan de leer archivos en tiempo de ejecución (más robusto al empaquetarlas).
//   node scripts/empaquetar.mjs            -> escribe lib/*.generado.mjs
//   node scripts/empaquetar.mjs --comprobar -> falla si lo generado no está al día
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";

const raiz = new URL("../", import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, raiz), "utf8");

const datos = {
  ajustes: JSON.parse(leer("data/ajustes.default.json")),
  categorias: JSON.parse(leer("data/categorias.json")),
  productos: JSON.parse(leer("data/productos.default.json")),
  precios: JSON.parse(leer("data/precios-orientativos.json")),
};
const plantillas = {};
for (const f of readdirSync(new URL("templates/", raiz)).sort()) plantillas[f] = leer(`templates/${f}`);

const cabecera = "// ARCHIVO GENERADO por scripts/empaquetar.mjs. No editar a mano.\n";
const salidas = {
  "lib/datos.generado.mjs": `${cabecera}export const ajustesPorDefecto = ${JSON.stringify(datos.ajustes, null, 2)};\nexport const categorias = ${JSON.stringify(datos.categorias, null, 2)};\nexport const productosPorDefecto = ${JSON.stringify(datos.productos)};\nexport const preciosOrientativos = ${JSON.stringify(datos.precios)};\n`,
  "lib/plantillas.generado.mjs": `${cabecera}export const plantillas = ${JSON.stringify(plantillas, null, 1)};\n`,
};

// Módulos que usan a la vez el servidor y el navegador (una sola fuente de verdad, con pruebas).
for (const nombre of ["dinero", "horario", "precios"]) {
  // En el navegador los módulos se importan como .js, no .mjs
  salidas[`public/assets/compartido/${nombre}.js`] = `// COPIA de lib/${nombre}.mjs generada por scripts/empaquetar.mjs. No editar a mano.\n${leer(`lib/${nombre}.mjs`).replace(/from "\.\/(\w+)\.mjs"/g, 'from "./$1.js"')}`;
}

const comprobar = process.argv.includes("--comprobar");
let desfasado = false;
for (const [ruta, contenido] of Object.entries(salidas)) {
  if (comprobar) {
    if (!existsSync(new URL(ruta, raiz)) || leer(ruta) !== contenido) { console.error(`DESFASADO: ${ruta}. Ejecuta: node scripts/empaquetar.mjs`); desfasado = true; }
  } else { mkdirSync(new URL("./", new URL(ruta, raiz)), { recursive: true }); writeFileSync(new URL(ruta, raiz), contenido); }
}
if (comprobar) process.exit(desfasado ? 1 : 0);
console.log("Generado:", Object.keys(salidas).join(", "), `(${Object.keys(plantillas).length} plantillas)`);
