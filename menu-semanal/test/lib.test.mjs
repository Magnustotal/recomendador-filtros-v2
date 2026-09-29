import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, addToSlot, copyWeek, daysBetween, deleteDish, emptyState, firstEmptySlot, formatWhatsApp, guessEmoji,
  isISO, normalizeName, relativeDays, removeFromSlot, sanitizeState, suggest, upsertDishByName, weekRangeLabel, weekStart,
} from '../public/lib.js';

// Construye un estado con platos {id: [nombre, creadoEl]}
const dishState = (defs) => {
  const s = emptyState();
  for (const [id, [name, createdAt]] of Object.entries(defs)) s.dishes[id] = { id, name, emoji: '', meals: [], createdAt };
  return s;
};

test('weekStart devuelve el lunes (domingo incluido)', () => {
  assert.equal(weekStart('2026-09-29'), '2026-09-28'); // martes
  assert.equal(weekStart('2026-09-28'), '2026-09-28'); // lunes
  assert.equal(weekStart('2026-10-04'), '2026-09-28'); // domingo
});

test('fechas: addDays cruza mes/año y daysBetween ignora el cambio de hora', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // cambio a horario de verano en Europa
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.ok(isISO('2026-02-28') && !isISO('2026-02-30') && !isISO('hola'));
});

test('weekRangeLabel', () => {
  assert.equal(weekRangeLabel('2026-09-28'), '28 sep – 4 oct');
  assert.equal(weekRangeLabel('2026-10-05'), '5–11 oct');
});

test('relativeDays', () => {
  assert.equal(relativeDays(0), 'hoy');
  assert.equal(relativeDays(1), 'ayer');
  assert.equal(relativeDays(5), 'hace 5 días');
  assert.equal(relativeDays(35), 'hace 5 semanas');
  assert.equal(relativeDays(95), 'hace 3 meses');
  assert.equal(relativeDays(800), 'hace 2 años');
});

test('normalizeName ignora tildes, mayúsculas y espacios', () => {
  assert.equal(normalizeName('  Tortilla   de PATATA '), 'tortilla de patata');
  assert.equal(normalizeName('Judías'), 'judias');
});

test('guessEmoji', () => {
  assert.equal(guessEmoji('Macarrones con tomate'), '🍝');
  assert.equal(guessEmoji('Lentejas'), '🍲');
  assert.equal(guessEmoji('Tortilla de patatas'), '🍳');
  assert.equal(guessEmoji('Papaya'), '🍽️'); // no debe confundirse con "papas"
  assert.equal(guessEmoji('Algo raro'), '🍽️');
});

test('upsertDishByName reutiliza platos con el mismo nombre normalizado', () => {
  const a = upsertDishByName(emptyState(), 'lentejas', { id: 'a', today: '2026-09-01' });
  assert.equal(a.created, true);
  assert.equal(a.state.dishes.a.name, 'Lentejas');
  const b = upsertDishByName(a.state, '  LENTEJAS ', { id: 'b' });
  assert.equal(b.created, false);
  assert.equal(b.id, 'a');
});

test('addToSlot / removeFromSlot son inmutables, sin duplicados y limpian huecos', () => {
  const s0 = dishState({ a: ['Lentejas', '2026-01-01'] });
  const s1 = addToSlot(s0, '2026-09-29', 'lunch', 'a');
  assert.deepEqual(s1.plan['2026-09-29'], { lunch: ['a'] });
  assert.deepEqual(s0.plan, {}); // no muta
  assert.deepEqual(s1.dishes.a.meals, ['lunch']);
  assert.equal(addToSlot(s1, '2026-09-29', 'lunch', 'a'), s1); // duplicado: mismo objeto
  const s2 = removeFromSlot(s1, '2026-09-29', 'lunch', 'a');
  assert.deepEqual(s2.plan, {});
});

test('deleteDish lo quita también del plan', () => {
  let s = dishState({ a: ['A', '2026-01-01'], b: ['B', '2026-01-01'] });
  s = addToSlot(addToSlot(s, '2026-09-29', 'lunch', 'a'), '2026-09-29', 'lunch', 'b');
  s = deleteDish(s, 'a');
  assert.deepEqual(s.plan['2026-09-29'], { lunch: ['b'] });
  assert.equal(s.dishes.a, undefined);
});

test('suggest: ordena por más tiempo sin comer y excluye lo ya planificado', () => {
  const today = '2026-09-29';
  let s = dishState({
    a: ['Lentejas', '2026-01-01'],
    b: ['Pizza', '2026-01-01'],
    c: ['Paella', '2026-09-20'],
    d: ['Sopa', '2026-01-01'],
  });
  s = addToSlot(s, '2026-08-01', 'lunch', 'a'); // hace 59 días
  s = addToSlot(s, '2026-09-25', 'dinner', 'b'); // hace 4 días
  s = addToSlot(s, '2026-10-02', 'lunch', 'd'); // planificado esta semana → excluido
  const res = suggest(s.dishes, s.plan, today, {});
  assert.deepEqual(res.map((r) => r.dish.id), ['a', 'c', 'b']);
  assert.equal(res[0].days, 59);
  assert.equal(res[1].never, true); // Paella: nunca planificada, cuenta desde que se guardó (9 días)
  assert.equal(res[1].days, 9);
  assert.deepEqual(suggest(s.dishes, s.plan, today, { minDays: 14 }).map((r) => r.dish.id), ['a']);
});

test('suggest respeta el tipo de comida', () => {
  const today = '2026-09-29';
  let s = dishState({ a: ['Lentejas', '2026-01-01'], b: ['Tortilla', '2026-01-01'] });
  s = addToSlot(s, '2026-08-01', 'lunch', 'a');
  s = addToSlot(s, '2026-08-01', 'dinner', 'b');
  assert.deepEqual(suggest(s.dishes, s.plan, today, { meal: 'dinner' }).map((r) => r.dish.id), ['b']);
});

test('firstEmptySlot busca desde hoy', () => {
  const days = ['2026-09-28', '2026-09-29', '2026-09-30'];
  let s = dishState({ a: ['A', '2026-01-01'] });
  s = addToSlot(s, '2026-09-29', 'lunch', 'a');
  assert.deepEqual(firstEmptySlot(days, s.plan, '2026-09-29'), { date: '2026-09-29', meal: 'dinner' });
  assert.equal(firstEmptySlot(days, s.plan, '2026-10-05'), null);
});

test('copyWeek solo rellena huecos vacíos', () => {
  let s = dishState({ a: ['A', '2026-01-01'], b: ['B', '2026-01-01'] });
  s = addToSlot(s, '2026-09-21', 'lunch', 'a');
  s = addToSlot(s, '2026-09-22', 'dinner', 'a');
  s = addToSlot(s, '2026-09-28', 'lunch', 'b'); // ya ocupado en la semana destino
  const { state, copied } = copyWeek(s, '2026-09-21', '2026-09-28');
  assert.equal(copied, 1);
  assert.deepEqual(state.plan['2026-09-28'], { lunch: ['b'] });
  assert.deepEqual(state.plan['2026-09-29'], { dinner: ['a'] });
});

test('sanitizeState descarta claves peligrosas y referencias rotas', () => {
  const raw = JSON.parse(`{
    "dishes": {
      "__proto__": {"name": "Malo"},
      "ok": {"name": "  sopa  ", "meals": ["lunch", "brunch"], "createdAt": "2026-01-01"},
      "x y": {"name": "id inválido"},
      "vacio": {"name": "   "}
    },
    "plan": {
      "2026-09-29": {"lunch": ["ok", "ok", "fantasma"], "dinner": []},
      "2026-13-40": {"lunch": ["ok"]},
      "__proto__": {"lunch": ["ok"]}
    }
  }`);
  const s = sanitizeState(raw);
  assert.deepEqual(Object.keys(s.dishes), ['ok']);
  assert.equal(s.dishes.ok.name, 'Sopa');
  assert.deepEqual(s.dishes.ok.meals, ['lunch']);
  assert.deepEqual(s.plan, { '2026-09-29': { lunch: ['ok'] } });
  assert.equal({}.polluted, undefined);
  assert.deepEqual(sanitizeState(null), emptyState());
  assert.deepEqual(sanitizeState('texto'), emptyState());
});

test('formatWhatsApp genera el mensaje esperado', () => {
  let s = dishState({
    a: ['Macarrones', '2026-01-01'],
    b: ['Tortilla', '2026-01-01'],
    c: ['Ensalada', '2026-01-01'],
    d: ['Pollo *asado*', '2026-01-01'],
  });
  s = addToSlot(s, '2026-09-28', 'lunch', 'a');
  s = addToSlot(s, '2026-09-28', 'dinner', 'b');
  s = addToSlot(s, '2026-09-28', 'dinner', 'c');
  s = addToSlot(s, '2026-09-30', 'lunch', 'd');
  const expected = [
    '🍽️ *Menú de la semana*\n🗓️ 28 sep – 4 oct',
    '📅 *Lunes 28 sep*\n☀️ *Almuerzo:* 🍝 Macarrones\n🌙 *Cena:* 🍳 Tortilla + 🥗 Ensalada',
    '📅 *Miércoles 30 sep*\n☀️ *Almuerzo:* 🍗 Pollo asado',
    '¡Buen provecho! 😋',
  ].join('\n\n');
  assert.equal(formatWhatsApp('2026-09-28', s), expected);
});

test('formatWhatsApp: huecos vacíos y semana vacía', () => {
  let s = dishState({ a: ['Sopa', '2026-01-01'] });
  s = addToSlot(s, '2026-09-29', 'dinner', 'a');
  const full = formatWhatsApp('2026-09-28', s, { includeEmpty: true });
  assert.match(full, /📅 \*Lunes 28 sep\*\n☀️ \*Almuerzo:\* —\n🌙 \*Cena:\* —/);
  assert.match(full, /🌙 \*Cena:\* 🍲 Sopa/);
  assert.match(formatWhatsApp('2026-10-05', s), /Aún no hay comidas planificadas/);
});
