import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoImagen, dimensionesImagen, FOTO_LADO_MINIMO, FOTO_LADO_MAXIMO } from "../lib/http.mjs";
import { escalaFinal, tipoDeArchivo, TIPOS_ADMITIDOS, LADO_MAXIMO, LADO_MINIMO, LADO_INUTIL, pesoLegible } from "../public/admin/fotos.js";
import { jpegCon, pngCon, webpLossy, webpLossless, webpExtendido } from "./ayuda/imagenes.mjs";

test("tipo de imagen por sus bytes: JPG, PNG y WebP; lo demás (GIF, SVG, HTML, BMP…) no", () => {
  assert.equal(tipoImagen(jpegCon(10, 10)), "image/jpeg");
  assert.equal(tipoImagen(pngCon(10, 10)), "image/png");
  assert.equal(tipoImagen(webpLossy(10, 10)), "image/webp");
  const txt = (t) => new TextEncoder().encode(t.padEnd(40, " "));
  for (const t of ["GIF89a" + "x".repeat(40), "<svg xmlns='http://www.w3.org/2000/svg'></svg>", "<script>alert(1)</script>", "BM" + "x".repeat(40), "%PDF-1.4"]) assert.equal(tipoImagen(txt(t)), null, t);
});

test("medidas leídas de la cabecera: PNG, JPEG (saltando otros segmentos) y los tres tipos de WebP", () => {
  assert.deepEqual(dimensionesImagen(pngCon(1234, 567)), { ancho: 1234, alto: 567 });
  assert.deepEqual(dimensionesImagen(jpegCon(4032, 3024)), { ancho: 4032, alto: 3024 });
  assert.deepEqual(dimensionesImagen(jpegCon(800, 600, { relleno: 5 })), { ancho: 800, alto: 600 });
  assert.deepEqual(dimensionesImagen(webpLossy(1000, 750)), { ancho: 1000, alto: 750 });
  assert.deepEqual(dimensionesImagen(webpLossless(1000, 750)), { ancho: 1000, alto: 750 });
  assert.deepEqual(dimensionesImagen(webpExtendido(5000, 3000)), { ancho: 5000, alto: 3000 });
});

test("medidas: cabeceras rotas, truncadas o con ceros devuelven null (nunca lanzan)", () => {
  const cortado = (a, n) => a.slice(0, n);
  assert.equal(dimensionesImagen(cortado(pngCon(10, 10), 18)), null);
  assert.equal(dimensionesImagen(cortado(jpegCon(10, 10), 12)), null);
  assert.equal(dimensionesImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), null, "JPEG sin marcador de medidas");
  assert.equal(dimensionesImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), null, "segmento con longitud imposible");
  assert.equal(dimensionesImagen(pngCon(0, 10)), null);
  assert.equal(dimensionesImagen(cortado(webpLossy(10, 10), 20)), null);
  assert.equal(dimensionesImagen(new Uint8Array(30)), null);
  assert.equal(dimensionesImagen(new Uint8Array(0), "image/png"), null);
});

test("límites del servidor: 400-1600 px por el lado largo", () => {
  assert.equal(FOTO_LADO_MINIMO, 400); assert.equal(FOTO_LADO_MAXIMO, 1600);
  assert.ok(LADO_MINIMO >= FOTO_LADO_MINIMO && LADO_MAXIMO <= FOTO_LADO_MAXIMO, "lo que genera el panel cabe en lo que acepta el servidor");
});

test("panel: escala final = reducir a 1000, ampliar a 400 y dejar en paz lo que ya está entre medias", () => {
  assert.equal(escalaFinal(4000, 3000), 0.25);          // 4000 -> 1000
  assert.equal(escalaFinal(3000, 4000), 0.25);          // vertical
  assert.equal(escalaFinal(1000, 800), 1);
  assert.equal(escalaFinal(700, 500), 1);
  assert.equal(escalaFinal(400, 300), 1);
  assert.equal(escalaFinal(200, 150), 2);               // 200 -> 400
  assert.equal(escalaFinal(150, 300), 400 / 300);       // vertical pequeña
  for (const [w, h] of [[8000, 6000], [5, 5000], [1, 1], [120, 90], [999, 1000], [401, 399]]) {
    const f = escalaFinal(w, h);
    const largo = Math.round(Math.max(w, h) * f);
    assert.ok(largo >= LADO_MINIMO && largo <= LADO_MAXIMO, `${w}x${h} -> ${largo}`);
  }
  assert.ok(LADO_INUTIL < LADO_MINIMO);
});

test("panel: tipos de archivo admitidos, también por extensión si el navegador no da el tipo", () => {
  assert.deepEqual(TIPOS_ADMITIDOS, ["image/jpeg", "image/png", "image/webp"]);
  assert.equal(tipoDeArchivo({ type: "image/jpeg", name: "a.jpg" }), "image/jpeg");
  assert.equal(tipoDeArchivo({ type: "image/webp", name: "a.webp" }), "image/webp");
  assert.equal(tipoDeArchivo({ type: "", name: "FOTO.JPEG" }), "image/jpeg");
  assert.equal(tipoDeArchivo({ type: "", name: "foto.PNG" }), "image/png");
  for (const x of [{ type: "image/gif", name: "a.gif" }, { type: "image/svg+xml", name: "a.svg" }, { type: "image/heic", name: "a.heic" }, { type: "application/pdf", name: "a.pdf" }, { type: "", name: "sin-extension" }, { type: "", name: "a.exe" }, { type: "text/html", name: "a.jpg" }]) {
    assert.equal(tipoDeArchivo(x), null, JSON.stringify(x));
  }
});

test("peso legible", () => {
  assert.equal(pesoLegible(500), "1 KB");
  assert.equal(pesoLegible(180 * 1024), "180 KB");
  assert.equal(pesoLegible(3.2 * 1048576), "3,2 MB");
});
