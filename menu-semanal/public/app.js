import {
  MEALS, MEAL_LABEL, MEAL_EMOJI,
  addDays, addToSlot, cleanName, copyWeek, daysBetween, dayName, deleteDish, dishEmoji, dishStats,
  emptyState, findDishByName, firstEmptySlot, formatWhatsApp, guessEmoji, normalizeName, relativeDays,
  removeFromSlot, sanitizeState, shortDate, slotIds, suggest, todayISO, updateDish, upsertDishByName,
  weekDays, weekRangeLabel, weekStart,
} from './lib.js';
import { VERSION } from './version.js';

/* ---------- Utilidades DOM ---------- */

const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
};

function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function append(el, kid) {
  if (kid == null || kid === false) return;
  if (Array.isArray(kid)) kid.forEach((k) => append(el, k));
  else el.append(kid instanceof Node ? kid : String(kid));
}

/** h('button', { class: 'btn', onclick }, 'texto', hijo…) — siempre texto plano, nunca HTML. */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

const $ = (sel) => document.querySelector(sel);
const view = $('#view');
const dlg = $('#dlg');
const snack = $('#snack');
const fab = $('#fab');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- Almacenamiento (todo queda en el móvil) ---------- */

const KEY = 'menu-semanal:v1';

const readStorage = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeStorage = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };

function loadState() {
  const raw = readStorage(KEY);
  if (!raw) return emptyState();
  try {
    return sanitizeState(JSON.parse(raw));
  } catch {
    writeStorage(`${KEY}:corrupt`, raw); // no perder datos ilegibles
    return emptyState();
  }
}

let state = loadState();
let persistAsked = false;

function commit(next) {
  state = next;
  const ok = writeStorage(KEY, JSON.stringify(state));
  if (!ok) toast('No se pudo guardar en este dispositivo. Exporta una copia de seguridad.', { error: true });
  else if (!persistAsked) {
    persistAsked = true;
    navigator.storage?.persist?.().catch(() => {}); // pide que el navegador no borre los datos
  }
  render();
}

/* ---------- Estado de la interfaz ---------- */

const HASH_VIEWS = { '#platos': 'dishes', '#ajustes': 'settings' };
const viewFromHash = () => HASH_VIEWS[location.hash] ?? 'week';

const ui = { view: viewFromHash(), weekStart: weekStart(todayISO()), idea: 0, sort: 'old', query: '' };
let pendingFocus = null;
let installEvent = null;

const VIEWS = {
  week: { title: 'Menú semanal', eyebrow: 'Tu cocina, organizada' },
  dishes: { title: 'Tus platos', eyebrow: 'Guardados en tu móvil' },
  settings: { title: 'Ajustes', eyebrow: 'Copia de seguridad' },
};

/* ---------- Avisos ---------- */

let toastTimer;
function toast(message, { label, onClick, error = false } = {}) {
  clearTimeout(toastTimer);
  snack.className = `snack show${error ? ' error' : ''}`;
  snack.replaceChildren(
    h('span', {}, message),
    label && h('button', { type: 'button', onclick: () => { hideToast(); onClick?.(); } }, label),
  );
  toastTimer = setTimeout(hideToast, label ? 7000 : 4500);
}
function hideToast() {
  clearTimeout(toastTimer);
  snack.className = 'snack';
  snack.replaceChildren();
}

/* ---------- Diálogos ---------- */

function openDialog(node, { sheet = false } = {}) {
  dlg.className = sheet ? 'sheet' : '';
  dlg.replaceChildren(node);
  if (!dlg.open) dlg.showModal();
}
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

function confirmDialog({ title, body, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    dlg.returnValue = '';
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    openDialog(
      h('form', { class: 'dlg', method: 'dialog' },
        h('h2', { id: 'dlg-title' }, title),
        h('p', {}, body),
        h('div', { class: 'buttons' },
          h('button', { class: 'btn text', value: 'cancel' }, 'Cancelar'),
          h('button', { class: `btn ${danger ? 'danger' : ''}`, value: 'ok', autofocus: true }, confirmLabel),
        ),
      ),
    );
  });
}

function dialogHead(title, sub) {
  return [
    h('div', { class: 'dlg-head' },
      h('h2', { id: 'dlg-title' }, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icon('close')),
    ),
    sub && h('p', { class: 'sub' }, sub),
  ];
}

/* ---------- Texto auxiliar ---------- */

function slotPhrase(date, meal, today) {
  const what = meal === 'lunch' ? 'al almuerzo' : 'a la cena';
  return `${what} de ${date === today ? 'hoy' : `${dayName(date).toLowerCase()}`}`;
}

function lastText(st, today) {
  if (!st) return 'Sin planificar aún';
  const parts = [];
  if (st.last) parts.push(`Última vez: ${relativeDays(daysBetween(st.last, today))}`);
  else if (st.next) parts.push('Planificado próximamente');
  if (st.count) parts.push(plural(st.count, 'vez', 'veces'));
  return parts.join(' · ') || 'Sin planificar aún';
}

/* ---------- Semana ---------- */

function renderWeek() {
  const today = todayISO();
  const days = weekDays(ui.weekStart);
  const offset = Math.round(daysBetween(weekStart(today), ui.weekStart) / 7);
  const relative = { 0: 'Esta semana', 1: 'Próxima semana', [-1]: 'Semana pasada' }[offset] ?? '';
  const prevStart = addDays(ui.weekStart, -7);
  const canCopy = weekHasPlan(prevStart) && ui.weekStart >= weekStart(today);

  const bar = h('div', { class: 'weekbar' },
    h('button', { class: 'icon-btn', type: 'button', 'data-fk': 'prev', 'aria-label': 'Semana anterior', onclick: () => goWeek(-7) }, icon('chevL')),
    h('div', { class: 'range', 'aria-live': 'polite' }, h('strong', {}, weekRangeLabel(ui.weekStart)), h('span', {}, relative || ' ')),
    h('button', { class: 'icon-btn', type: 'button', 'data-fk': 'next', 'aria-label': 'Semana siguiente', onclick: () => goWeek(7) }, icon('chevR')),
    (offset !== 0 || canCopy) && h('div', { class: 'extra' },
      offset !== 0 && h('button', { class: 'btn text small', type: 'button', 'data-fk': 'today', onclick: () => goWeek(0) }, 'Ir a hoy'),
      canCopy && h('button', { class: 'btn tonal small', type: 'button', onclick: repeatPreviousWeek }, 'Repetir semana anterior'),
    ),
  );

  return h('div', { class: 'view-enter' }, bar, ideaCard(days, today), h('div', { class: 'days' }, days.map((d) => dayCard(d, today))));
}

const weekHasPlan = (start) => weekDays(start).some((d) => state.plan[d]);

function ideaCard(days, today) {
  const slot = firstEmptySlot(days, state.plan, today);
  if (!slot) return null;
  const ideas = suggest(state.dishes, state.plan, today, { meal: slot.meal, minDays: 14, limit: 5 });
  if (!ideas.length) return null;
  const { dish, days: ago, never } = ideas[ui.idea % ideas.length];
  return h('section', { class: 'idea', 'aria-label': 'Sugerencia' },
    h('p', { class: 'kicker' }, '🍅 Hace tiempo que no lo comes'),
    h('p', { class: 'dish' }, `${dishEmoji(dish)} ${dish.name}`),
    h('p', { class: 'why' }, never ? 'Lo guardaste y aún no lo has planificado.' : `Última vez: ${relativeDays(ago)}.`),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => addIdea(slot, dish.id) }, `Añadir ${slotPhrase(slot.date, slot.meal, today)}`),
      ideas.length > 1 && h('button', { class: 'btn text', type: 'button', 'data-fk': 'idea', onclick: () => { ui.idea++; pendingFocus = 'idea'; render(); } }, 'Otra idea'),
    ),
  );
}

function addIdea(slot, id) {
  const prev = state;
  const name = state.dishes[id].name;
  pendingFocus = `add:${slot.date}:${slot.meal}`;
  commit(addToSlot(state, slot.date, slot.meal, id));
  toast(`Añadido: ${name}`, { label: 'Deshacer', onClick: () => commit(prev) });
}

function dayCard(date, today) {
  const isToday = date === today;
  return h('article', { class: `day${isToday ? ' today' : ''}`, 'data-date': date, 'aria-label': `${dayName(date)} ${shortDate(date)}` },
    h('header', { class: 'day-head' },
      h('h2', {}, dayName(date)),
      h('span', { class: 'date' }, shortDate(date)),
      isToday && h('span', { class: 'badge' }, 'Hoy'),
    ),
    MEALS.map((meal) => slotBlock(date, meal)),
  );
}

function slotBlock(date, meal) {
  const ids = slotIds(state, date, meal).filter((id) => state.dishes[id]);
  const when = `del ${dayName(date).toLowerCase()} ${shortDate(date)}`;
  const addTo = `${meal === 'lunch' ? 'al almuerzo' : 'a la cena'} ${when}`;
  const removeFrom = `${meal === 'lunch' ? 'del almuerzo' : 'de la cena'} ${when}`;
  const openSheet = () => openAddSheet(date, meal);
  return h('section', { class: `slot ${meal}`, 'aria-label': MEAL_LABEL[meal] },
    h('div', { class: 'slot-head' },
      h('span', {}, `${MEAL_EMOJI[meal]} ${MEAL_LABEL[meal]}`),
      ids.length > 0 && h('button', { class: 'icon-btn', type: 'button', 'data-fk': `add:${date}:${meal}`, 'aria-label': `Añadir plato ${addTo}`, onclick: openSheet }, icon('plus')),
    ),
    ids.length
      ? h('ul', { class: 'items' }, ids.map((id) => {
        const dish = state.dishes[id];
        return h('li', { class: 'item' },
          h('span', {}, `${dishEmoji(dish)} ${dish.name}`),
          h('button', { class: 'x', type: 'button', 'aria-label': `Quitar ${dish.name} ${removeFrom}`, onclick: () => removeDish(date, meal, id) }, icon('close')),
        );
      }))
      : h('button', { class: 'slot-empty', type: 'button', 'data-fk': `add:${date}:${meal}`, 'aria-label': `Añadir plato ${addTo}`, onclick: openSheet }, icon('plus'), 'Añadir plato'),
  );
}

function removeDish(date, meal, id) {
  const prev = state;
  const name = state.dishes[id].name;
  pendingFocus = `add:${date}:${meal}`;
  commit(removeFromSlot(state, date, meal, id));
  toast(`Quitado: ${name}`, { label: 'Deshacer', onClick: () => commit(prev) });
}

function repeatPreviousWeek() {
  const { state: next, copied } = copyWeek(state, addDays(ui.weekStart, -7), ui.weekStart);
  if (!copied) return toast('No hay huecos libres que rellenar esta semana.');
  const prev = state;
  commit(next);
  toast(`Copiadas ${plural(copied, 'comida', 'comidas')} de la semana anterior`, { label: 'Deshacer', onClick: () => commit(prev) });
}

function goWeek(delta) {
  const target = delta === 0 ? weekStart(todayISO()) : addDays(ui.weekStart, delta);
  const dir = target < ui.weekStart ? 'prev' : 'next';
  ui.idea = 0;
  pendingFocus = delta < 0 ? 'prev' : 'next';
  transition(() => { ui.weekStart = target; render(); }, dir);
}

function transition(update, dir) {
  if (!document.startViewTransition || reduceMotion.matches) return update();
  document.documentElement.dataset.dir = dir;
  const t = document.startViewTransition(update);
  t.finished.catch(() => {}).finally(() => delete document.documentElement.dataset.dir);
}

/* ---------- Hoja para añadir plato ---------- */

function segmented(name, options, current, onChange) {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name },
    options.map(([value, label]) => h('label', {},
      h('input', { type: 'radio', name: `seg-${name}`, value, checked: value === current, onchange: () => onChange(value) }),
      h('span', {}, label),
    )),
  );
}

function openAddSheet(date, initialMeal) {
  let meal = initialMeal;
  const input = h('input', {
    class: 'field', type: 'text', name: 'plato', maxlength: '80', autocomplete: 'off', enterkeyhint: 'done',
    placeholder: 'Escribe un plato nuevo o busca…', 'aria-label': 'Nombre del plato',
  });
  const lists = h('div', { class: 'sheet-lists' });
  const scope = h('p', { class: 'sub' });

  function finish(base, id) {
    const dish = base.dishes[id];
    if (slotIds(state, date, meal).includes(id)) return toast(`${dish.name} ya está en el ${MEAL_LABEL[meal].toLowerCase()}`);
    const prev = state;
    dlg.close();
    pendingFocus = `add:${date}:${meal}`;
    commit(addToSlot(base, date, meal, id));
    toast(`Añadido: ${dish.name}`, { label: 'Deshacer', onClick: () => commit(prev) });
  }

  function createFromInput() {
    const name = cleanName(input.value);
    if (!name) return input.focus();
    const { state: base, id } = upsertDishByName(state, name);
    finish(base, id);
  }

  function dishRow(dish, stats, today, inSlot) {
    const disabled = inSlot.has(dish.id);
    return h('button', {
      class: 'row', type: 'button', 'aria-disabled': disabled ? 'true' : null,
      onclick: () => (disabled ? toast('Ya está añadido aquí') : finish(state, dish.id)),
    },
      h('span', { class: 'emoji', 'aria-hidden': 'true' }, dishEmoji(dish)),
      h('span', { class: 'grow' }, h('span', { class: 'name' }, dish.name), h('span', { class: 'meta' }, disabled ? '✓ Ya añadido' : lastText(stats.get(dish.id), today))),
    );
  }

  function section(title, rows) {
    return h('section', {}, h('h3', {}, title), h('div', { class: 'list' }, rows));
  }

  function renderLists() {
    const today = todayISO();
    const stats = dishStats(state.plan, today);
    const inSlot = new Set(slotIds(state, date, meal));
    const q = normalizeName(input.value);
    const nodes = [];

    scope.textContent = `${dayName(date)} ${shortDate(date)} · ${MEAL_LABEL[meal].toLowerCase()}`;

    if (q && !findDishByName(state, input.value)) {
      nodes.push(h('button', { class: 'btn tonal', type: 'button', onclick: createFromInput }, `＋ Crear «${cleanName(input.value)}»`));
    }
    if (!q) {
      const ideas = suggest(state.dishes, state.plan, today, { meal, minDays: 7, limit: 4 }).filter((x) => !inSlot.has(x.dish.id));
      if (ideas.length) nodes.push(section('🍅 Hace tiempo que no los comes', ideas.map((x) => dishRow(x.dish, stats, today, inSlot))));
    }
    const all = Object.values(state.dishes)
      .filter((d) => !q || normalizeName(d.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (all.length) nodes.push(section(q ? 'Coincidencias' : 'Tus platos', all.map((d) => dishRow(d, stats, today, inSlot))));
    else if (!q) nodes.push(h('p', { class: 'empty' }, 'Aún no tienes platos guardados. Escribe el primero arriba 👆'));

    lists.replaceChildren(...nodes);
  }

  input.addEventListener('input', renderLists);
  renderLists();

  openDialog(
    h('form', { class: 'dlg', onsubmit: (e) => { e.preventDefault(); createFromInput(); } },
      dialogHead('Añadir plato'),
      scope,
      segmented('Comida', [['lunch', '☀️ Almuerzo'], ['dinner', '🌙 Cena']], meal, (v) => { meal = v; renderLists(); }),
      input,
      lists,
    ),
    { sheet: true },
  );
}

/* ---------- Compartir por WhatsApp ---------- */

function openShare() {
  let includeEmpty = false;
  const text = () => formatWhatsApp(ui.weekStart, state, { includeEmpty });
  const area = h('textarea', { class: 'field', id: 'share-text', name: 'mensaje', 'aria-label': 'Mensaje de WhatsApp', spellcheck: 'false' });
  const wa = h('a', { class: 'btn', target: '_blank', rel: 'noopener noreferrer' }, '💬 Abrir WhatsApp');

  const sync = () => { wa.href = `https://wa.me/?text=${encodeURIComponent(area.value)}`; };
  const refill = () => { area.value = text(); sync(); };
  area.addEventListener('input', sync);
  refill();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(area.value);
      toast('Mensaje copiado');
    } catch {
      area.select();
      toast(document.execCommand?.('copy') ? 'Mensaje copiado' : 'Selecciona el texto y cópialo', { error: false });
    }
  };
  const share = () => navigator.share({ text: area.value }).catch(() => {});

  openDialog(
    h('div', { class: 'dlg' },
      dialogHead('Enviar menú', `Semana del ${weekRangeLabel(ui.weekStart)}. Puedes editar el texto antes de enviarlo.`),
      area,
      h('label', { class: 'switch' },
        h('input', { type: 'checkbox', onchange: (e) => { includeEmpty = e.target.checked; refill(); } }),
        'Incluir comidas sin planear',
      ),
      h('div', { class: 'buttons' },
        h('button', { class: 'btn tonal', type: 'button', onclick: copy }, 'Copiar'),
        navigator.share && h('button', { class: 'btn tonal', type: 'button', onclick: share }, 'Compartir…'),
        wa,
      ),
    ),
    { sheet: true },
  );
}

/* ---------- Platos ---------- */

function renderDishes() {
  const list = h('div', { class: 'list' });
  const search = h('input', {
    class: 'field', type: 'search', name: 'buscar', 'aria-label': 'Buscar plato', placeholder: 'Buscar plato…', value: ui.query, autocomplete: 'off',
  });

  function fill() {
    const today = todayISO();
    const stats = dishStats(state.plan, today);
    const q = normalizeName(ui.query);
    const rows = Object.values(state.dishes).filter((d) => !q || normalizeName(d.name).includes(q));
    const age = (d) => { const s = stats.get(d.id); return daysBetween(s?.last ?? d.createdAt, today); };
    const byName = (a, b) => a.name.localeCompare(b.name, 'es');
    rows.sort({
      old: (a, b) => age(b) - age(a) || byName(a, b),
      name: byName,
      most: (a, b) => (stats.get(b.id)?.count ?? 0) - (stats.get(a.id)?.count ?? 0) || byName(a, b),
    }[ui.sort]);

    if (!rows.length) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('span', { class: 'big', 'aria-hidden': 'true' }, '🍳'),
        Object.keys(state.dishes).length ? 'Ningún plato coincide con la búsqueda.' : 'Aquí aparecerán los platos que añadas al menú, para repetirlos cuando quieras.',
      ));
      return;
    }
    list.replaceChildren(...rows.map((d) => h('div', { class: 'row' },
      h('span', { class: 'emoji', 'aria-hidden': 'true' }, dishEmoji(d)),
      h('span', { class: 'grow' }, h('span', { class: 'name' }, d.name), h('span', { class: 'meta' }, lastText(stats.get(d.id), today))),
      h('span', { class: 'tools' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Editar ${d.name}`, onclick: () => openDishEditor(d.id) }, icon('edit')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Eliminar ${d.name}`, onclick: () => removeSavedDish(d.id) }, icon('trash')),
      ),
    )));
  }

  search.addEventListener('input', () => { ui.query = search.value; fill(); });
  fill();

  return h('div', { class: 'view-enter' },
    h('div', { class: 'toolbar' },
      search,
      h('div', {}, segmented('Ordenar por', [['old', 'Hace tiempo'], ['name', 'A–Z'], ['most', 'Más usados']], ui.sort, (v) => { ui.sort = v; fill(); })),
      h('div', {}, h('button', { class: 'btn tonal', type: 'button', onclick: () => openDishEditor(null) }, icon('plus'), 'Guardar plato nuevo')),
    ),
    list,
  );
}

function openDishEditor(id) {
  const dish = id ? state.dishes[id] : null;
  const name = h('input', { class: 'field', type: 'text', name: 'nombre', maxlength: '80', required: true, value: dish?.name ?? '', autocomplete: 'off', 'aria-label': 'Nombre del plato', placeholder: 'Nombre del plato…' });
  const emoji = h('input', { class: 'field', type: 'text', name: 'emoji', maxlength: '8', value: dish?.emoji ?? '', autocomplete: 'off', 'aria-label': 'Emoji (opcional)', placeholder: `Emoji opcional (auto: ${dish ? guessEmoji(dish.name) : '🍽️'})…` });

  const save = (e) => {
    e.preventDefault();
    const clean = cleanName(name.value);
    if (!clean) return name.focus();
    if (findDishByName(state, clean, id)) return toast('Ya tienes un plato con ese nombre', { error: true });
    dlg.close();
    if (id) {
      commit(updateDish(state, id, { name: clean, emoji: emoji.value }));
    } else {
      const { state: next, id: newDishId } = upsertDishByName(state, clean);
      commit(emoji.value.trim() ? updateDish(next, newDishId, { name: clean, emoji: emoji.value }) : next);
      toast(`Guardado: ${clean}`);
    }
  };

  openDialog(
    h('form', { class: 'dlg', onsubmit: save },
      dialogHead(id ? 'Editar plato' : 'Guardar plato'),
      name, emoji,
      h('div', { class: 'buttons' },
        h('button', { class: 'btn text', type: 'button', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit' }, 'Guardar'),
      ),
    ),
  );
  name.focus();
}

async function removeSavedDish(id) {
  const dish = state.dishes[id];
  const planned = Object.values(state.plan).some((day) => MEALS.some((m) => day[m]?.includes(id)));
  const ok = await confirmDialog({
    title: `¿Eliminar «${dish.name}»?`,
    body: planned ?'También se quitará de los días del menú donde aparece.' : 'Se quitará de tus platos guardados.',
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!ok) return;
  const prev = state;
  commit(deleteDish(state, id));
  toast(`Eliminado: ${dish.name}`, { label: 'Deshacer', onClick: () => commit(prev) });
}

/* ---------- Ajustes ---------- */

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function renderSettings() {
  const dishCount = Object.keys(state.dishes).length;
  const dayCount = Object.keys(state.plan).length;
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: importFile });

  return h('div', { class: 'view-enter' },
    h('section', { class: 'card' },
      h('h2', {}, 'Tus datos'),
      h('p', {}, `Todo se guarda solo en este móvil: ${plural(dishCount, 'plato', 'platos')} y ${plural(dayCount, 'día planificado', 'días planificados')}. Nada se envía a ningún servidor.`),
      h('p', {}, 'Si borras los datos del navegador o desinstalas la app, se pierden. Haz una copia de vez en cuando.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn tonal', type: 'button', onclick: exportData }, 'Exportar copia'),
        h('button', { class: 'btn outline', type: 'button', onclick: () => fileInput.click() }, 'Importar copia'),
        fileInput,
      ),
    ),
    !isStandalone() && h('section', { class: 'card' },
      h('h2', {}, 'Instalar en el móvil'),
      h('p', {}, 'Instálala para abrirla como una app y usarla sin conexión. En iPhone o iPad: botón Compartir → «Añadir a pantalla de inicio».'),
      installEvent && h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: install }, 'Instalar app')),
    ),
    h('section', { class: 'card' },
      h('h2', {}, 'Zona delicada'),
      h('div', { class: 'actions' }, h('button', { class: 'btn danger', type: 'button', onclick: resetAll }, 'Borrar todos los datos')),
    ),
    h('p', { class: 'version' }, `Menú semanal · versión ${VERSION}`),
  );
}

async function install() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  render();
}

function exportData() {
  const payload = { app: 'menu-semanal', exportedAt: new Date().toISOString(), ...state };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: `menu-semanal-${todayISO()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 5_000_000) return toast('El archivo es demasiado grande.', { error: true });
  let next;
  try {
    next = sanitizeState(JSON.parse(await file.text()));
  } catch {
    return toast('No se pudo leer el archivo.', { error: true });
  }
  const dishes = Object.keys(next.dishes).length;
  const days = Object.keys(next.plan).length;
  if (!dishes && !days) return toast('La copia está vacía o no es válida.', { error: true });
  const ok = await confirmDialog({
    title: '¿Restaurar copia?',
    body: `Se reemplazarán tus datos actuales por ${plural(dishes, 'plato', 'platos')} y ${plural(days, 'día', 'días')} de la copia.`,
    confirmLabel: 'Restaurar',
  });
  if (!ok) return;
  const prev = state;
  commit(next);
  toast('Copia restaurada', { label: 'Deshacer', onClick: () => commit(prev) });
}

async function resetAll() {
  const ok = await confirmDialog({
    title: '¿Borrar todo?',
    body: 'Se eliminarán todos tus platos y menús de este móvil. Considera exportar una copia antes.',
    confirmLabel: 'Borrar todo',
    danger: true,
  });
  if (!ok) return;
  const prev = state;
  commit(emptyState());
  toast('Datos borrados', { label: 'Deshacer', onClick: () => commit(prev) });
}

/* ---------- Render principal ---------- */

function render() {
  const fk = pendingFocus ?? document.activeElement?.dataset?.fk;
  pendingFocus = null;
  const node = { week: renderWeek, dishes: renderDishes, settings: renderSettings }[ui.view]();
  view.replaceChildren(node);

  $('#title').textContent = VIEWS[ui.view].title;
  $('#eyebrow').textContent = VIEWS[ui.view].eyebrow;
  fab.hidden = ui.view !== 'week';
  document.querySelectorAll('.nav-item').forEach((b) => {
    if (b.dataset.view === ui.view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  if (fk) view.querySelector(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
}

function onRoute() {
  const next = viewFromHash();
  if (next === ui.view) return;
  ui.view = next;
  ui.query = '';
  render();
  window.scrollTo(0, 0);
}

/* ---------- Arranque ---------- */

addEventListener('hashchange', onRoute);
fab.addEventListener('click', openShare);

addEventListener('storage', (e) => { if (e.key === KEY) { state = loadState(); render(); } });
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (ui.view === 'settings') render(); });
addEventListener('appinstalled', () => { installEvent = null; if (ui.view === 'settings') render(); });

render();
// window.scrollTo (y no scrollIntoView) para no mover el punto de partida del Tab.
const todayCard = document.querySelector('.day.today');
if (todayCard) window.scrollTo(0, todayCard.getBoundingClientRect().top + scrollY - 12);

// Atajo de la PWA: ./?action=share abre directamente el mensaje de WhatsApp.
if (new URLSearchParams(location.search).get('action') === 'share') {
  history.replaceState(null, '', location.pathname + location.hash);
  if (ui.view === 'week') openShare();
}

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
