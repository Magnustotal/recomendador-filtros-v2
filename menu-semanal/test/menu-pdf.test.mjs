import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PdfError, detectMenuDates, extractPdfText, hasWeekdayNames, layoutText, parseCalendarGrid, sanitizeMenuText } from '../public/menu-pdf.js';

const it = (str, x, y, w = str.length * 5.2) => ({ str, x, y, w });

// Disposición real de un calendario de catering: etiquetas de fila (1ºPLATO...) a la izquierda y
// desalineadas respecto a los platos, columnas por día y un pie legal con datos de contacto.
const WEEK2 = [
  it('2º SEMANA', 80, 450), it('LUNES 5', 192, 450, 44), it('MARTES 6', 315, 450, 48), it('MIÉRCOLES 7', 436, 450, 70), it('JUEVES 8', 575, 450, 50), it('VIERNES 9', 701, 450, 55),
  it('1ºPLATO', 92, 435), it('2ºPLATO', 92, 423),
  it('PATATAS GUISADAS CON CHOCOS', 167, 420, 140), it('POTAJE DE GARBANZOS', 308, 420, 105), it('ESPIRALES A LA BOLOÑESA', 431, 420, 125), it('ALUBIAS ESTOFADAS CON VERDURAS', 548, 420, 150), it('CREMA DE CALABAZA', 696, 420, 95),
  it('GUARNICIÓN', 84, 414), it('LOMO ADOBADO AL HORNO', 174, 414, 115), it('JAMONCITOS DE POLLO EN SALSA', 295, 414, 135), it('TORTILLA FRANCESA', 439, 414, 95), it('MERLUZA EN SALSA', 570, 414, 90), it('HAMBURGUESA DE POLLO', 690, 414, 105),
  it('PAN Y POSTRE', 83, 405), ...[179, 307, 434, 564, 693].map((x) => it('FRUTA O YOGURT Y PAN', x, 405, 100)),
];
const WEEK3 = [
  it('3º SEMANA', 80, 366), it('LUNES 12', 189, 366, 46), it('MARTES 13', 313, 366, 52), it('MIÉRCOLES 14', 433, 366, 72), it('JUEVES 15', 573, 366, 52), it('VIERNES 16', 698, 366, 58),
  it('LENTEJAS ESTOFADAS', 310, 345, 100), it('MACARRONES CON TOMATE', 429, 345, 115), it('PUCHERO CON ARROZ', 567, 345, 95), it('CREMA DE CALABACÍN', 695, 345, 100),
  it('TORTILLA DE PATATAS', 310, 339, 100), it('BACALAO AL HORNO', 569, 339, 90),
  ...[179, 307, 434, 564, 693].map((x) => it('FRUTA O YOGURT Y PAN', x, 330, 100)),
];
const FOOTER = it('Razón social: Catering Pérez, Registro Sanitario 26.015661/SE Tlf: 664700725 e-mail: info@catering.example', 96, 111, 520);

test('parseCalendarGrid: columnas por día, sin etiquetas de fila ni pie, en mayúscula inicial', () => {
  const out = parseCalendarGrid([...WEEK2, ...WEEK3, FOOTER]);
  const lines = out.split('\n');
  assert.equal(lines[0], 'Lunes 5: Patatas guisadas con chocos / Lomo adobado al horno / Fruta o yogurt y pan');
  assert.equal(lines[2], 'Miércoles 7: Espirales a la boloñesa / Tortilla francesa / Fruta o yogurt y pan');
  assert.equal(lines.length, 10);
  assert.ok(lines.some((l) => l.startsWith('Martes 13: Lentejas estofadas / Tortilla de patatas')));
  assert.ok(!/PLATO|GUARNICI|Raz|@|664/i.test(out), 'sin etiquetas ni datos de contacto');
});

test('parseCalendarGrid: un día sin platos (festivo) solo conserva lo que trae el PDF', () => {
  const out = parseCalendarGrid([...WEEK2, ...WEEK3]);
  assert.match(out, /^Lunes 12: Fruta o yogurt y pan$/m);
});

test('parseCalendarGrid: si hay texto ancho dentro de la cuadrícula (celdas fusionadas) no pierde datos: cae al orden de lectura', () => {
  const fused = [...WEEK2, it('PAN Y POSTRE FRUTA O YOGURT Y PAN FRUTA O YOGURT Y PAN FRUTA O YOGURT Y PAN', 10, 400, 830)];
  assert.equal(parseCalendarGrid(fused), '');
  assert.match(layoutText(fused), /FRUTA O YOGURT Y PAN/);
  // el pie legal (ancho, con datos de contacto) no cuenta como pérdida
  assert.notEqual(parseCalendarGrid([...WEEK2, ...WEEK3, FOOTER]), '');
});

test('parseCalendarGrid: un pie legal estrecho (cabe en una columna) no se pega al día ni borra su línea', () => {
  const narrowFooter = it('Razón social: Catering Pérez. Tlf: 664700725 e-mail: a@b.es', 150, 395, 100);
  const out = parseCalendarGrid([...WEEK2, ...WEEK3, narrowFooter]);
  assert.match(out, /^Lunes 12: Fruta o yogurt y pan$/m);
  assert.ok(!/Raz|664|@/.test(out));
});

test('parseCalendarGrid: devuelve vacío si no es una cuadrícula', () => {
  assert.equal(parseCalendarGrid([it('CARTA', 100, 700), it('Lubina 18', 100, 680)]), '');
  assert.equal(parseCalendarGrid([it('LUNES 5', 100, 500), it('MARTES 6', 200, 500)]), '');
});

test('layoutText: filas por altura y columnas separadas por barra', () => {
  const out = layoutText([it('Entrantes', 50, 700), it('Ensalada', 50, 680, 40), it('9 €', 300, 680.5, 20), it('Lubina', 50, 660, 30)]);
  assert.equal(out, 'Entrantes\nEnsalada | 9 €\nLubina');
});

test('sanitizeMenuText: no borra una línea de menú solo por mencionar «razón social» a mitad de línea', () => {
  assert.equal(sanitizeMenuText('Lunes 12: Festivo / Razón social: X S.L.'), 'Lunes 12: Festivo / Razón social: X S.L.');
});

test('sanitizeMenuText: quita correos, teléfonos, webs y pies legales', () => {
  const out = sanitizeMenuText('Lunes 5: Lentejas\nRazón social: X S.L., Registro Sanitario 26.01\nContacto: a.b@dominio.es www.catering.es +34 664 700 725\nMartes 6: Pollo');
  assert.equal(out, 'Lunes 5: Lentejas\nContacto:\nMartes 6: Pollo');
});

test('detectMenuDates: deduce el mes por día de la semana + número (octubre de 2026)', () => {
  const text = 'Lunes 5: a\nMartes 6: b\nViernes 9: c\nLunes 12: d\nViernes 30: e';
  assert.deepEqual(detectMenuDates(text, '2026-10-02'), ['2026-10-05', '2026-10-06', '2026-10-09', '2026-10-12', '2026-10-30']);
  // visto desde finales de septiembre, también resuelve octubre
  assert.deepEqual(detectMenuDates(text, '2026-09-28'), ['2026-10-05', '2026-10-06', '2026-10-09', '2026-10-12', '2026-10-30']);
});

test('detectMenuDates: sin números o con combinaciones imposibles no devuelve nada', () => {
  assert.deepEqual(detectMenuDates('Lunes: lentejas\nMartes: pollo', '2026-10-02'), []);
  assert.deepEqual(detectMenuDates('Lunes 31: x', '2026-11-10'), []); // el 31 de dic/ene no cae en lunes en esos meses
  assert.deepEqual(detectMenuDates('', '2026-10-02'), []);
});

test('detectMenuDates: menú que cruza de mes', () => {
  assert.deepEqual(detectMenuDates('Jueves 29: a\nViernes 30: b\nLunes 2: c', '2026-10-20'), ['2026-10-29', '2026-10-30', '2026-11-02']);
});

test('hasWeekdayNames distingue menús semanales de una carta', () => {
  assert.equal(hasWeekdayNames('Miércoles: sopa'), true);
  assert.equal(hasWeekdayNames('Ensalada César 9 €\nLubina a la plancha'), false);
});

test('extractPdfText rechaza archivos que no son PDF o son demasiado grandes', async () => {
  const fake = (bytes, size = bytes.length) => ({ size, arrayBuffer: async () => bytes.buffer });
  await assert.rejects(extractPdfText(fake(new TextEncoder().encode('hola, esto no es un pdf'))), (e) => e instanceof PdfError && e.kind === 'format');
  await assert.rejects(extractPdfText(fake(new Uint8Array(2), 20 * 1024 * 1024)), (e) => e.kind === 'big');
});
