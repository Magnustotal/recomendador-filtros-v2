import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addToSlot, applyTemplate, backupDue, buildICS, decodeShare, deleteDish, deleteTemplate, emptyState, encodeShare, firstEmptySlot,
  formatWhatsApp, frozenReminders, guessTags, monthMatrix, moveDish, periodStats, recipeLink, ruleStatus, ruleText, sanitizeState,
  saveTemplate, setDayMeta, slotIds, suggest, updateDish, upsertDishByName, weekTagCounts,
} from '../public/lib.js';

const MON = '2026-09-28'; // lunes
const build = () => {
  let s = emptyState();
  const ids = {};
  for (const [k, name] of [['p', 'Merluza a la plancha'], ['c', 'Pollo asado'], ['l', 'Lentejas estofadas'], ['m', 'Macarrones con tomate']]) {
    const r = upsertDishByName(s, name, { id: k, today: '2026-01-01' });
    s = r.state; ids[k] = r.id;
  }
  return s;
};

test('guessTags deduce grupos por el nombre, sin tildes', () => {
  assert.deepEqual(guessTags('Merluza a la plancha'), ['pescado']);
  assert.deepEqual(guessTags('Lentejas con arroz'), ['legumbre', 'pasta-arroz']);
  assert.deepEqual(guessTags('Tortilla de patatas'), ['huevo']);
  assert.deepEqual(guessTags('Cosa rara'), []);
});

test('platos antiguos (sin etiquetas) se migran con etiquetas deducidas; los nuevos campos se validan', () => {
  const s = sanitizeState({ dishes: { a: { name: 'merluza', meals: [], createdAt: '2026-01-01' }, b: { name: 'X', tags: ['pescado', 'nope'], minutes: 9999, level: 'zzz', recipe: ' https://x.es/r ', favorite: 'yes', frozen: true } } });
  assert.deepEqual(s.dishes.a.tags, ['pescado']);
  assert.deepEqual(s.dishes.b.tags, ['pescado']);
  assert.equal(s.dishes.b.minutes, 0);
  assert.equal(s.dishes.b.level, '');
  assert.equal(s.dishes.b.favorite, false);
  assert.equal(s.dishes.b.frozen, true);
  assert.equal(recipeLink(s.dishes.b.recipe), 'https://x.es/r');
  assert.equal(recipeLink('javascript:alert(1)'), '');
  assert.equal(recipeLink('https://x.es/ con espacios'), '');
});

test('updateDish valida cada campo editado y conserva fecha y comidas', () => {
  const s = build();
  const next = updateDish(s, 'p', { name: ' merluza al horno ', minutes: 25, level: 'media', tags: ['pescado', 'verdura', 'xx'], favorite: true });
  assert.equal(next.dishes.p.name, 'Merluza al horno');
  assert.equal(next.dishes.p.minutes, 25);
  assert.deepEqual(next.dishes.p.tags, ['pescado', 'verdura']);
  assert.equal(next.dishes.p.createdAt, '2026-01-01');
  assert.equal(updateDish(s, 'zzz', { name: 'x' }), s);
});

test('notas, «fuera de casa» y comensales por día: se guardan, se limpian y se quitan al vaciarse', () => {
  let s = setDayMeta(build(), '2026-09-29', { note: '  Cumple de Ana  ', off: 'festivo', diners: { dinner: 4, lunch: 99 } });
  assert.deepEqual(s.days['2026-09-29'], { note: 'Cumple de Ana', off: 'festivo', diners: { dinner: 4 } });
  s = setDayMeta(s, '2026-09-29', { note: '', off: '', diners: {} });
  assert.equal(s.days['2026-09-29'], undefined);
  assert.deepEqual(sanitizeState({ days: { 'no-fecha': { note: 'x' }, '2026-09-29': { off: 'raro' } } }).days, {});
});

test('un día «fuera de casa» no se sugiere como primer hueco vacío', () => {
  const s = setDayMeta(build(), MON, { off: 'fuera' });
  const days = [MON, '2026-09-29'];
  assert.deepEqual(firstEmptySlot(days, s.plan, MON, s.days), { date: '2026-09-29', meal: 'lunch' });
  assert.deepEqual(firstEmptySlot(days, s.plan, MON), { date: MON, meal: 'lunch' });
});

test('suggest: cooldown excluye lo que se comió hace muy poco', () => {
  let s = addToSlot(build(), '2026-09-27', 'dinner', 'p');
  const names = (cd) => suggest(s.dishes, s.plan, '2026-09-28', { cooldown: cd }).map((x) => x.dish.id);
  assert.ok(names(0).includes('p'));
  assert.ok(!names(3).includes('p'));
});

test('moveDish mueve, copia y no duplica', () => {
  let s = addToSlot(build(), MON, 'lunch', 'p');
  const a = { date: MON, meal: 'lunch' };
  const b = { date: '2026-09-29', meal: 'dinner' };
  const moved = moveDish(s, a, b, 'p');
  assert.deepEqual(slotIds(moved, MON, 'lunch'), []);
  assert.deepEqual(slotIds(moved, '2026-09-29', 'dinner'), ['p']);
  const copied = moveDish(s, a, b, 'p', { copy: true });
  assert.deepEqual(slotIds(copied, MON, 'lunch'), ['p']);
  assert.deepEqual(slotIds(moveDish(copied, a, b, 'p', { copy: true }), '2026-09-29', 'dinner'), ['p']);
  assert.equal(moveDish(s, a, a, 'p'), s);
  assert.equal(moveDish(s, a, b, 'nope'), s);
});

test('plantillas: guardar la semana, aplicarla solo a huecos libres y respetar días fuera', () => {
  let s = addToSlot(addToSlot(build(), MON, 'lunch', 'l'), '2026-09-30', 'dinner', 'p');
  const saved = saveTemplate(s, 'Semana base', MON, { id: 't1' });
  assert.equal(saved.id, 't1');
  assert.deepEqual(saved.state.templates.t1.slots, { 0: { lunch: ['l'] }, 2: { dinner: ['p'] } });
  assert.equal(saveTemplate(emptyState(), 'Vacía', MON).id, null);

  let t = setDayMeta(saved.state, '2026-10-06', { off: 'fuera' });
  t = addToSlot(t, '2026-10-07', 'dinner', 'c'); // miércoles ya ocupado
  const { state: applied, copied } = applyTemplate(t, 't1', '2026-10-05');
  assert.equal(copied, 1);
  assert.deepEqual(slotIds(applied, '2026-10-05', 'lunch'), ['l']);
  assert.deepEqual(slotIds(applied, '2026-10-07', 'dinner'), ['c']);
  const again = applyTemplate(saved.state, 't1', '2026-10-05');
  assert.equal(again.copied, 2);
  assert.equal(deleteTemplate(saved.state, 't1').templates.t1, undefined);
});

test('borrar un plato lo quita también de las plantillas', () => {
  const s = addToSlot(build(), MON, 'lunch', 'l');
  const { state } = saveTemplate(s, 'Base', MON, { id: 't1' });
  assert.deepEqual(deleteDish(state, 'l').templates.t1.slots, {});
});

test('reglas de frecuencia: recuento por etiqueta y estado', () => {
  let s = build();
  s = { ...s, rules: sanitizeState({ rules: [{ tag: 'pescado', min: 2, max: 0 }, { tag: 'carne', min: 0, max: 1 }, { tag: 'pescado', min: 5 }, { tag: 'zzz', min: 1 }] }).rules };
  assert.equal(s.rules.length, 2);
  s = addToSlot(addToSlot(addToSlot(s, MON, 'lunch', 'p'), MON, 'dinner', 'c'), '2026-09-29', 'dinner', 'c');
  assert.deepEqual(weekTagCounts(s, MON), { pescado: 1, carne: 2 });
  const st = ruleStatus(s, MON);
  assert.equal(st.find((r) => r.tag === 'pescado').status, 'low');
  assert.equal(st.find((r) => r.tag === 'carne').status, 'high');
  assert.equal(ruleText({ tag: 'pescado', min: 2, max: 0 }), 'pescado: al menos 2 por semana');
  assert.equal(ruleText({ tag: 'carne', min: 0, max: 1 }), 'carne: como mucho 1 por semana');
  assert.equal(ruleText({ tag: 'verdura', min: 3, max: 3 }), 'verdura: 3 por semana');
});

test('aviso de congelados: solo los de mañana', () => {
  let s = updateDish(build(), 'p', { frozen: true });
  s = addToSlot(addToSlot(s, '2026-09-29', 'dinner', 'p'), '2026-09-30', 'dinner', 'p');
  assert.deepEqual(frozenReminders(s, MON).map((r) => [r.dish.id, r.meal]), [['p', 'dinner']]);
  assert.deepEqual(frozenReminders(s, '2026-10-05'), []);
});

test('copia de seguridad: toca a los 30 días o si nunca se hizo', () => {
  assert.equal(backupDue(null, MON), true);
  assert.equal(backupDue('2026-09-01', MON), false);
  assert.equal(backupDue('2026-08-28', MON), true);
});

test('estadísticas del periodo: top, grupos y cobertura (sin contar días fuera)', () => {
  let s = build();
  s = addToSlot(addToSlot(addToSlot(s, '2026-09-27', 'lunch', 'p'), '2026-09-28', 'lunch', 'p'), '2026-09-28', 'dinner', 'c');
  s = setDayMeta(s, '2026-09-26', { off: 'fuera' });
  const st = periodStats(s, '2026-09-28', 7);
  assert.equal(st.top[0].dish.id, 'p');
  assert.equal(st.top[0].count, 2);
  assert.deepEqual(st.perTag, { pescado: 2, carne: 1 });
  assert.equal(st.total, 12); // 7 días x 2 comidas - el día fuera
  assert.equal(st.planned, 3);
  assert.equal(st.coverage, 25);
});

test('monthMatrix: semanas completas lunes-domingo que cubren el mes', () => {
  const m = monthMatrix(2026, 9); // octubre 2026: empieza en jueves
  assert.equal(m[0][0], '2026-09-28');
  assert.equal(m.at(-1).at(-1), '2026-11-01');
  assert.ok(m.every((w) => w.length === 7));
  assert.equal(monthMatrix(2027, 1).length, 4); // febrero 2027 empieza en lunes y tiene 28 días
});

test('ICS: eventos válidos, escapados, con CRLF y líneas plegadas', () => {
  let s = build();
  s = upsertDishByName(s, 'Arroz con pollo, verduras; y mucho más texto para forzar el plegado de línea larga en el calendario', { id: 'z', today: '2026-01-01' }).state;
  s = addToSlot(addToSlot(s, MON, 'lunch', 'z'), MON, 'dinner', 'p');
  const ics = buildICS(s, MON, '2026-09-29', { stamp: new Date('2026-09-28T10:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.ok(ics.includes('DTSTART:20260928T140000') && ics.includes('DTSTART:20260928T210000'));
  assert.ok(ics.includes('DTSTAMP:20260928T100000Z'));
  assert.ok(ics.includes('\\,') && ics.includes('\;'));
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal(buildICS(emptyState(), MON, MON).includes('BEGIN:VEVENT'), false);
});

test('código de traspaso: ida y vuelta, y rechaza basura', () => {
  let s = addToSlot(build(), MON, 'lunch', 'p');
  s = setDayMeta(s, MON, { note: 'Ñandú 🍲' });
  const code = encodeShare(s);
  assert.match(code, /^menu-semanal:1:[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeShare(`Aquí va:\n${code}\n¡Gracias!`), sanitizeState(s));
  assert.equal(decodeShare('hola'), null);
  assert.equal(decodeShare('menu-semanal:1:@@@'), null);
  assert.equal(decodeShare('menu-semanal:1:AAAA'), null);
});

test('WhatsApp: formatos, notas, comensales y días fuera', () => {
  let s = addToSlot(addToSlot(build(), MON, 'lunch', 'l'), MON, 'dinner', 'p');
  s = setDayMeta(s, MON, { note: 'Cumple *Ana*', diners: { dinner: 4 } });
  s = setDayMeta(s, '2026-09-29', { off: 'fuera' });
  const full = formatWhatsApp(MON, s);
  assert.ok(full.includes('🌙 *Cena:* 🐟 Merluza a la plancha (4 pers.)') && full.includes('📝 Cumple Ana'));
  assert.ok(full.includes('🚫 Comemos fuera'));
  const short = formatWhatsApp(MON, s, { format: 'short' });
  assert.ok(short.includes('*Lun 28:* ☀️ 🍲 Lentejas estofadas · 🌙 🐟 Merluza a la plancha (4 pers.) · 📝 Cumple Ana'));
  assert.ok(short.includes('*Mar 29:* Comemos fuera'));
  const dinners = formatWhatsApp(MON, s, { format: 'dinner' });
  assert.ok(dinners.includes('Cenas de la semana') && !dinners.includes('Lentejas'));
});
