import {
  MEALS, MEAL_LABEL, MEAL_EMOJI, TAGS, TAG_IDS, LEVELS, ruleText, OFF_LABEL, WA_FORMATS, backupDue, recipeLink,
  addDays, addToSlot, cleanName, copyWeek, daysBetween, dayName, deleteDish, dishEmoji, dishStats,
  emptyState, findDishByName, firstEmptySlot, formatWhatsApp, guessEmoji, guessTags, normalizeName, relativeDays,
  removeFromSlot, sanitizeState, shortDate, slotIds, suggest, todayISO, updateDish, upsertDishByName,
  weekDays, weekRangeLabel, weekStart,
} from './lib.js';
import { VERSION } from './version.js';
import { $, h, icon, plural } from './dom.js';
import { CARTA_SCHEMA, DEFAULT_MODEL, MAX_IMAGES, askGemini, buildCartaPrompt, buildPrompt, parseCombos, parseSuggestions, serverStatus } from './ai.js';
import { createWeekTools } from './week-tools.js';
import { createExtras } from './extras.js';
import { PdfError, detectMenuDates, extractPdfText, hasWeekdayNames } from './menu-pdf.js';

const view = $('#view');
const dlg = $('#dlg');
const snack = $('#snack');
const fab = $('#fab');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

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

const HASH_VIEWS = { '#platos': 'dishes', '#estadisticas': 'stats', '#ajustes': 'settings' };
const viewFromHash = () => HASH_VIEWS[location.hash] ?? 'week';

const ui = { view: viewFromHash(), weekStart: weekStart(todayISO()), idea: 0, sort: 'old', query: '', filter: 'all', statsSpan: 90 };
let pendingFocus = null;
let installEvent = null;

const VIEWS = {
  week: { title: 'Menú semanal', eyebrow: 'Tu cocina, organizada' },
  dishes: { title: 'Tus platos', eyebrow: 'Guardados en tu móvil' },
  stats: { title: 'Estadísticas', eyebrow: 'Lo que más cocinas' },
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
    h('div', { class: 'extra' },
      offset !== 0 && h('button', { class: 'btn text small', type: 'button', 'data-fk': 'today', onclick: () => goWeek(0) }, 'Ir a hoy'),
      canCopy && h('button', { class: 'btn tonal small', type: 'button', onclick: repeatPreviousWeek }, 'Repetir semana anterior'),
      h('button', { class: 'btn tonal small', type: 'button', 'data-fk': 'balance', onclick: openBalance }, '🥗 Cenas según la guardería'),
      h('button', { class: 'btn tonal small', type: 'button', onclick: () => tools.openTemplates() }, '📋 Plantillas'),
      h('button', { class: 'btn tonal small', type: 'button', onclick: () => tools.openMonth() }, '🗓️ Mes'),
    ),
  );

  return h('div', { class: 'view-enter' }, extras.banners(), bar, tools.balanceStrip(), ideaCard(days, today), h('div', { class: 'days' }, days.map((d) => dayCard(d, today))));
}

const weekHasPlan = (start) => weekDays(start).some((d) => state.plan[d]);

function ideaCard(days, today) {
  const slot = firstEmptySlot(days, state.plan, today, state.days);
  if (!slot) return null;
  const ideas = suggest(state.dishes, state.plan, today, { meal: slot.meal, minDays: 14, limit: 5, cooldown: 3 });
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
  const meta = state.days[date] ?? {};
  return h('article', { class: `day${isToday ? ' today' : ''}${meta.off ? ' off' : ''}`, 'data-date': date, 'aria-label': `${dayName(date)} ${shortDate(date)}` },
    h('header', { class: 'day-head' },
      h('h2', {}, dayName(date)),
      h('span', { class: 'date' }, shortDate(date)),
      isToday && h('span', { class: 'badge' }, 'Hoy'),
      h('button', { class: 'icon-btn day-more', type: 'button', 'data-fk': `day:${date}`, 'aria-label': `Detalles de ${dayName(date).toLowerCase()} ${shortDate(date)}: nota, fuera de casa y comensales`, onclick: () => tools.openDayEditor(date) }, icon('more')),
    ),
    (meta.off || meta.note) && h('p', { class: 'day-meta' },
      meta.off && h('span', { class: 'tag-off' }, `🚫 ${OFF_LABEL[meta.off]}`),
      meta.note && h('span', {}, `📝 ${meta.note}`),
    ),
    MEALS.map((meal) => slotBlock(date, meal)),
  );
}

function slotBlock(date, meal) {
  const ids = slotIds(state, date, meal).filter((id) => state.dishes[id]);
  const when = `del ${dayName(date).toLowerCase()} ${shortDate(date)}`;
  const addTo = `${meal === 'lunch' ? 'al almuerzo' : 'a la cena'} ${when}`;
  const diners = state.days[date]?.diners?.[meal];
  const openSheet = () => openAddSheet(date, meal);
  const section = h('section', { class: `slot ${meal}`, 'aria-label': `${MEAL_LABEL[meal]} ${when}` },
    h('div', { class: 'slot-head' },
      h('span', {}, `${MEAL_EMOJI[meal]} ${MEAL_LABEL[meal]}`, diners && h('span', { class: 'diners' }, ` · ${diners} pers.`)),
      ids.length > 0 && h('button', { class: 'icon-btn', type: 'button', 'data-fk': `add:${date}:${meal}`, 'aria-label': `Añadir plato ${addTo}`, onclick: openSheet }, icon('plus')),
    ),
    ids.length
      ? h('ul', { class: 'items' }, ids.map((id) => {
        const dish = state.dishes[id];
        const name = h('button', { class: 'item-name', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `${dish.name}: opciones (mover, copiar, editar, quitar) ${when}`, onclick: () => tools.openItemMenu(date, meal, id) },
            `${dishEmoji(dish)} ${dish.name}`, dish.frozen && ' 🧊');
        const li = h('li', { class: 'item' },
          name,
          h('button', { class: 'x', type: 'button', 'aria-label': `Quitar ${dish.name} ${meal === 'lunch' ? 'del almuerzo' : 'de la cena'} ${when}`, onclick: () => removeDish(date, meal, id) }, icon('close')),
        );
        tools.dragSource(name, li, date, meal, id);
        return li;
      }))
      : h('button', { class: 'slot-empty', type: 'button', 'data-fk': `add:${date}:${meal}`, 'aria-label': `Añadir plato ${addTo}`, onclick: openSheet }, icon('plus'), 'Añadir plato'),
  );
  tools.dropTarget(section, date, meal);
  return section;
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
      const ideas = suggest(state.dishes, state.plan, today, { meal, minDays: 7, limit: 4, cooldown: 3 }).filter((x) => !inSlot.has(x.dish.id));
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
  let format = 'full';
  const text = () => formatWhatsApp(ui.weekStart, state, { includeEmpty, format });
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
      segmented('Formato del mensaje', Object.entries(WA_FORMATS), format, (v) => { format = v; refill(); }),
      area,
      h('label', { class: 'switch' },
        h('input', { type: 'checkbox', onchange: (e) => { includeEmpty = e.target.checked; refill(); } }),
        'Incluir comidas sin planear',
      ),
      h('div', { class: 'buttons start' }, extras.exportButtons()),
      h('div', { class: 'buttons' },
        h('button', { class: 'btn tonal', type: 'button', onclick: copy }, 'Copiar'),
        navigator.share && h('button', { class: 'btn tonal', type: 'button', onclick: share }, 'Compartir…'),
        wa,
      ),
    ),
    { sheet: true },
  );
}

/* ---------- Asistente de cenas (Gemini) ---------- */

const AI_STORE = 'menu-semanal:ai'; // código de acceso y preferencias: fuera de las copias de seguridad

function loadAi() {
  let o = {};
  try { o = JSON.parse(readStorage(AI_STORE) ?? '{}') ?? {}; } catch { /* vacío */ }
  const clean = {
    accessCode: typeof o.accessCode === 'string' ? o.accessCode : '',
    model: typeof o.model === 'string' && o.model.trim() ? o.model.trim() : DEFAULT_MODEL,
    notes: typeof o.notes === 'string' ? o.notes : '',
  };
  // Versiones anteriores guardaban aquí la clave de Google: ya no debe quedarse en el móvil.
  if ('key' in o) writeStorage(AI_STORE, JSON.stringify(clean));
  return clean;
}
const saveAi = (patch) => writeStorage(AI_STORE, JSON.stringify({ ...loadAi(), ...patch }));

function aiHelp() {
  return h('div', { class: 'ai-help' },
    h('p', {}, 'Las peticiones pasan por el servidor de la app, que guarda la clave de Gemini; en este móvil no se guarda ninguna clave.'),
    h('p', {}, 'Al pedir sugerencias se envían a Google el menú o la foto, las sugerencias de cena que subas, tus notas, los nombres de las cenas ya planeadas y de tus platos guardados; en el nivel gratuito, según sus términos actuales, Google puede usarlos para mejorar sus productos. No incluyas nombres de niños.'),
  );
}

function codeForm({ onSaved }) {
  const input = h('input', { class: 'field', type: 'password', name: 'codigo-acceso', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Código de acceso', placeholder: 'Código de acceso…' });
  return h('form', {
    class: 'ai-key',
    onsubmit: (e) => {
      e.preventDefault();
      const accessCode = input.value.trim();
      if (!accessCode) return toast('Escribe el código de acceso.', { error: true });
      if (!saveAi({ accessCode })) return toast('No se pudo guardar el código en este dispositivo.', { error: true });
      input.value = '';
      onSaved();
    },
  }, input, h('button', { class: 'btn tonal', type: 'submit' }, 'Guardar código'));
}

function promptCode(message) {
  openDialog(
    h('div', { class: 'dlg' },
      dialogHead('Código de acceso', message),
      codeForm({ onSaved: openBalance }),
    ),
    { sheet: true },
  );
}

/** Foto → JPEG de hasta 1600 px en base64 (menos peso, formato que Gemini acepta). */
async function fileToJpeg(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { name: file.name, mime: 'image/jpeg', data };
}

function openBalance() {
  const dateInfo = (date) => ({ date, name: dayName(date).toLowerCase(), label: shortDate(date) });
  const menu = h('textarea', { class: 'field compact', name: 'menu-guarderia', rows: '6', 'aria-label': 'Menú del mediodía de la guardería o carta', placeholder: 'Pega aquí el menú (lunes: lentejas y pollo…) o la carta de un restaurante…' });
  const dinnerBox = h('textarea', { class: 'field compact short', name: 'sugerencias-cena', rows: '3', 'aria-label': 'Sugerencias de cena del catering (opcional)', placeholder: 'Opcional: sugerencias de cena del catering (pega el texto o sube su PDF) para contrastarlas…' });
  const notes = h('input', { class: 'field', type: 'text', name: 'notas', maxlength: '300', autocomplete: 'off', 'aria-label': 'Notas (opcional)', placeholder: 'Notas: alergias, edades…', value: loadAi().notes });
  const chips = h('div', { class: 'items' });
  const status = h('p', { class: 'ai-status', role: 'status' });
  const results = h('div', { class: 'ai-results' });
  const go = h('button', { class: 'btn', type: 'submit' }, '✨ Sugerir cenas');
  const images = [];
  let controller;

  const renderChips = () => chips.replaceChildren(...images.map((im, i) => h('span', { class: 'item' },
    `🖼️ ${im.name}`,
    h('button', { class: 'x', type: 'button', 'aria-label': `Quitar ${im.name}`, onclick: () => { images.splice(i, 1); renderChips(); } }, icon('close')),
  )));
  const picker = h('input', {
    type: 'file', accept: 'image/*', multiple: true, hidden: true,
    onchange: async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      for (const file of files) {
        if (images.length >= MAX_IMAGES) { toast(`Máximo ${MAX_IMAGES} fotos`); break; }
        try { images.push(await fileToJpeg(file)); } catch { toast(`No pude leer ${file.name}. Usa una foto JPG o PNG.`, { error: true }); }
      }
      renderChips();
    },
  });

  const fail = (message) => { status.className = 'ai-status error'; status.textContent = message; };
  const info = (message) => { status.className = 'ai-status'; status.textContent = message; };

  async function loadPdf(file, target) {
    if (!file) return;
    // «sugerencias_de_cena_octubre.pdf» subido por el botón del mediodía va a su sitio
    const asDinner = target === 'dinner' || /cena|sugerencia/.test(normalizeName(file.name));
    const box = asDinner ? dinnerBox : menu;
    info('Leyendo PDF…');
    try {
      const { text, pages } = await extractPdfText(file);
      box.value = box.value.trim() ? `${box.value.trim()}\n\n${text}` : text;
      const found = detectMenuDates(`${menu.value}\n${dinnerBox.value}`, todayISO());
      const tail = found.length
        ? `: ${plural(found.length, 'día', 'días')}, del ${shortDate(found[0])} al ${shortDate(found.at(-1))}`
        : hasWeekdayNames(box.value)
          ? `. Se usará la semana visible (${weekRangeLabel(ui.weekStart)})`
          : asDinner ? '' : '. Parece una carta de restaurante: te propondré cenas equilibradas con sus platos';
      info(`PDF leído como ${asDinner ? 'sugerencias de cena' : 'menú del mediodía'} (${plural(pages, 'página', 'páginas')})${tail}. Revisa el texto y pulsa «Sugerir cenas».`);
    } catch (err) {
      fail(err instanceof PdfError ? err.message : 'No se pudo leer el PDF. Si estás sin conexión, ábrelo antes una vez con internet.');
    }
  }
  const pdfInput = (role) => h('input', {
    type: 'file', accept: 'application/pdf,.pdf', hidden: true, 'data-role': role,
    onchange: (e) => { const file = e.target.files[0]; e.target.value = ''; loadPdf(file, role); },
  });
  const pdfLunch = pdfInput('lunch');
  const pdfDinner = pdfInput('dinner');

  function renderResults(list) {
    const entries = list.map((x) => {
      const options = [{ name: x.dinner, label: 'Añadir a la cena', on: '✓ Añadida (quitar)' }];
      if (x.catering) options.push({ name: x.catering, label: 'Usar la del catering', on: '✓ Catering añadido (quitar)' });
      if (x.savedDish) options.push({ name: x.savedDish, label: `Usar «${x.savedDish}»`, on: `✓ «${x.savedDish}» añadido (quitar)` });
      return { s: x, date: x.date, options: options.map((o) => ({ ...o, id: null, pre: false })) };
    });
    const paint = (o) => {
      o.btn.textContent = o.pre ? 'Ya estaba en la cena' : o.id ? o.on : o.label;
      o.btn.disabled = o.pre;
      o.btn.setAttribute('aria-pressed', String(Boolean(o.id)));
    };
    const add = (x, o, base) => {
      const r = upsertDishByName(base, o.name); // un plato guardado se reutiliza, no se duplica
      if (slotIds(r.state, x.date, 'dinner').includes(r.id)) { o.pre = true; return r.state; }
      o.id = r.id;
      return addToSlot(r.state, x.date, 'dinner', r.id);
    };
    const toggle = (x, o) => {
      if (o.id) { commit(removeFromSlot(state, x.date, 'dinner', o.id)); o.id = null; } else commit(add(x, o, state));
      paint(o);
    };
    const addAll = () => {
      let next = state;
      for (const x of entries) { const o = x.options[0]; if (!o.id && !o.pre) next = add(x, o, next); }
      commit(next);
      entries.forEach((x) => paint(x.options[0]));
    };
    const fit = { bien: '✓ Equilibra el mediodía', mejorable: '⚠ Mejorable' };
    results.replaceChildren(
      h('div', { class: 'ai-summary' },
        h('p', {}, `${plural(entries.length, 'cena sugerida', 'cenas sugeridas')} · del ${shortDate(entries[0].date)} al ${shortDate(entries.at(-1).date)}`),
        h('button', { class: 'btn', type: 'button', onclick: addAll }, 'Añadir todas'),
      ),
      ...entries.map((x) => h('article', { class: 'ai-card' },
        h('h3', {}, `${dayName(x.date)} ${shortDate(x.date)}`),
        x.s.daycare && h('p', { class: 'meta' }, `Guardería: ${x.s.daycare}`),
        x.s.catering && h('p', { class: 'meta' }, `Catering propone: ${x.s.catering}`, fit[x.s.cateringFit] && h('span', { class: `fit ${x.s.cateringFit}` }, fit[x.s.cateringFit])),
        h('p', { class: 'dish' }, `${guessEmoji(x.s.dinner)} ${x.s.dinner}`),
        x.s.reason && h('p', { class: 'why' }, x.s.reason),
        h('div', { class: 'ai-actions' }, x.options.map((o) => {
          o.btn = h('button', { class: 'btn tonal small', type: 'button', onclick: () => toggle(x, o) });
          paint(o);
          return o.btn;
        })),
      )),
      h('p', { class: 'ai-help' }, 'Sugerencias orientativas generadas por IA; ante dudas de alimentación infantil consulta con tu pediatra.'),
    );
  }

  function renderCombos(list) {
    const week = weekDays(ui.weekStart);
    const firstFree = week.find((d) => !slotIds(state, d, 'dinner').length) ?? week[0];
    results.replaceChildren(
      ...list.map((c) => {
        const select = h('select', { class: 'field select', 'aria-label': `Día para «${c.title}»` },
          week.map((d) => h('option', { value: d, selected: d === firstFree }, `${dayName(d)} ${shortDate(d)}`)));
        const name = c.items.join(' + ');
        const btn = h('button', { class: 'btn tonal small', type: 'button' }, 'Añadir a la cena');
        btn.addEventListener('click', () => {
          const r = upsertDishByName(state, name);
          commit(addToSlot(r.state, select.value, 'dinner', r.id));
          btn.textContent = `✓ Añadida al ${dayName(select.value).toLowerCase()}`;
        });
        return h('article', { class: 'ai-card' },
          h('h3', {}, c.title),
          h('ul', { class: 'ai-items' }, c.items.map((i) => h('li', {}, `${guessEmoji(i)} ${i}`))),
          c.reason && h('p', { class: 'why' }, c.reason),
          select,
          btn,
        );
      }),
      h('p', { class: 'ai-help' }, 'Sugerencias orientativas generadas por IA a partir de la carta; ante dudas de alimentación consulta con un profesional.'),
    );
  }

  async function submit(e) {
    e.preventDefault();
    const menuText = menu.value.trim();
    const cateringText = dinnerBox.value.trim();
    if (!menuText && !images.length) return fail(cateringText ? 'Añade también el menú del mediodía de la guardería (texto, foto o PDF) para poder contrastar.' : 'Pega el menú o añade una foto.');
    const ai = loadAi();
    saveAi({ notes: notes.value });
    // Modo calendario si el texto trae «Lunes 5»...; carta si no hay días ni foto; si no, la semana visible.
    const found = detectMenuDates(`${menuText}\n${cateringText}`, todayISO());
    const carta = !found.length && !images.length && !cateringText && !hasWeekdayNames(menuText);
    // Base de datos de la familia: sus platos guardados (primero los de cena)
    const savedDishes = Object.values(state.dishes)
      .sort((a, b) => Number(b.meals.includes('dinner')) - Number(a.meals.includes('dinner')) || a.name.localeCompare(b.name, 'es'))
      .map((d) => d.name);
    const dates = (found.length ? found : weekDays(ui.weekStart)).map(dateInfo);
    const planned = Object.fromEntries(dates.map((d) => [d.date, slotIds(state, d.date, 'dinner').map((id) => state.dishes[id]?.name).filter(Boolean)]));
    controller = new AbortController();
    go.disabled = true;
    status.className = 'ai-status';
    status.textContent = 'Pensando…';
    results.replaceChildren();
    try {
      const text = await askGemini({
        accessCode: ai.accessCode, model: ai.model, images, signal: controller.signal,
        schema: carta ? CARTA_SCHEMA : undefined,
        onRetry: (n, max) => { status.textContent = `Gemini va saturado; reintentando (${n}/${max})…`; },
        onFallback: (m) => { status.textContent = `Gemini sigue saturado; probando con un modelo más ligero (${m})…`; },
        prompt: carta
          ? buildCartaPrompt({ menuText, notes: notes.value })
          : buildPrompt({ dates, menuText, hasImages: images.length > 0, notes: notes.value, planned, cateringText, savedDishes, rules: state.rules.map(ruleText) }),
      });
      if (carta) renderCombos(parseCombos(text));
      else renderResults(parseSuggestions(text, dates.map((d) => d.date), savedDishes.slice(0, 80)));
      status.textContent = '';
    } catch (err) {
      if (err.kind === 'code') promptCode(err.message);
      else if (err.kind !== 'abort') fail(err.message || 'Algo salió mal.');
    } finally {
      go.disabled = false;
    }
  }

  dlg.addEventListener('close', () => controller?.abort(), { once: true });
  openDialog(
    h('form', { class: 'dlg', onsubmit: submit },
      dialogHead('Cenas según el menú', 'Pega el menú de la guardería, súbelo en foto o en PDF (también vale la carta de un restaurante). Si tienes las sugerencias de cena del catering, añádelas y Gemini las contrasta con el mediodía y con tus platos guardados.'),
      h('p', { class: 'field-label' }, 'Menú del mediodía'),
      menu,
      h('div', { class: 'buttons start' },
        h('button', { class: 'btn outline small', type: 'button', onclick: () => pdfLunch.click() }, '📄 Menú en PDF'),
        h('button', { class: 'btn outline small', type: 'button', onclick: () => picker.click() }, '📷 Añadir foto'),
        pdfLunch, picker),
      chips,
      h('p', { class: 'field-label' }, 'Sugerencias de cena del catering (opcional)'),
      dinnerBox,
      h('div', { class: 'buttons start' },
        h('button', { class: 'btn outline small', type: 'button', onclick: () => pdfDinner.click() }, '📄 Sugerencias en PDF'),
        pdfDinner),
      notes,
      h('div', { class: 'buttons' }, go),
      status,
      results,
    ),
    { sheet: true },
  );
}

function aiCard() {
  const ai = loadAi();
  const status = h('p', { class: 'ai-status', role: 'status' });
  const model = h('input', {
    class: 'field', type: 'text', name: 'modelo', autocomplete: 'off', spellcheck: 'false', value: ai.model, 'aria-label': 'Modelo de Gemini',
    onchange: () => { saveAi({ model: model.value.trim() || DEFAULT_MODEL }); toast('Modelo guardado'); },
  });
  const test = async () => {
    const current = loadAi();
    status.className = 'ai-status';
    status.textContent = 'Probando…';
    let used = current.model;
    try {
      const text = await askGemini({
        accessCode: current.accessCode, model: current.model, prompt: 'Responde solo con la palabra OK.', structured: false,
        onRetry: (n, max) => { status.textContent = `Gemini va saturado; reintentando (${n}/${max})…`; },
        onFallback: (m) => { used = m; status.textContent = `Gemini sigue saturado; probando con ${m}…`; },
      });
      status.textContent = text ? `✅ Conexión correcta con ${used}${used === current.model ? '' : ' (el modelo elegido está saturado ahora mismo)'}.` : 'La respuesta llegó vacía.';
    } catch (err) {
      status.className = 'ai-status error';
      status.textContent = err.message;
    }
  };
  const server = h('p', { class: 'ai-status', role: 'status' }, 'Comprobando el servidor…');
  const codeSlot = h('div', {});
  serverStatus().then((st) => {
    if (!st) { server.className = 'ai-status error'; server.textContent = 'No encuentro el servidor de IA (/api/gemini). Despliega el sitio desde Git, no con el zip de Netlify Drop.'; return; }
    if (!st.configured) { server.className = 'ai-status error'; server.textContent = 'Falta la variable GEMINI_API_KEY en Netlify (con alcance «Functions»), y volver a desplegar.'; return; }
    server.textContent = `✅ Servidor listo${st.accessCode ? '. Pide código de acceso.' : '.'}`;
    if (st.accessCode) codeSlot.replaceChildren(ai.accessCode ? h('p', {}, 'Código guardado en este móvil. Escribe otro para cambiarlo.') : h('span', {}), codeForm({ onSaved: () => { render(); toast('Código guardado'); } }));
  });

  return h('section', { class: 'card' },
    h('h2', {}, '🥗 Asistente de cenas (Gemini)'),
    h('p', {}, 'Pásale el menú de la guardería (texto o foto) y te propone qué cenar para equilibrar la semana.'),
    aiHelp(),
    server,
    codeSlot,
    h('details', { class: 'ai-adv' }, h('summary', {}, 'Modelo avanzado'), model),
    h('div', { class: 'actions' },
      h('button', { class: 'btn tonal', type: 'button', onclick: test }, 'Probar conexión'),
    ),
    status,
  );
}

/* ---------- Platos ---------- */

const FILTERS = [['all', 'Todos'], ['favorite', '⭐ Favoritos'], ['quick', '⏱️ Rápidos (hasta 30 min)'], ['frozen', '🧊 Congelados'], ...TAG_IDS.map((t) => [`tag:${t}`, `${TAGS[t].emoji} ${TAGS[t].label}`])];

function matchesFilter(d, filter) {
  if (filter === 'favorite') return d.favorite;
  if (filter === 'quick') return d.minutes > 0 && d.minutes <= 30;
  if (filter === 'frozen') return d.frozen;
  if (filter.startsWith('tag:')) return d.tags.includes(filter.slice(4));
  return true;
}

function dishMeta(d) {
  const bits = [];
  if (d.minutes) bits.push(`⏱️ ${d.minutes} min`);
  if (d.level) bits.push(LEVELS[d.level]);
  if (d.frozen) bits.push('🧊 congelado');
  return bits.join(' · ');
}

function renderDishes() {
  const list = h('div', { class: 'list' });
  const search = h('input', {
    class: 'field', type: 'search', name: 'buscar', 'aria-label': 'Buscar plato', placeholder: 'Buscar plato…', value: ui.query, autocomplete: 'off',
  });
  const filter = h('select', { class: 'field', name: 'filtro', 'aria-label': 'Filtrar platos', onchange: () => { ui.filter = filter.value; fill(); } },
    FILTERS.map(([value, label]) => h('option', { value, selected: value === ui.filter ? true : null }, label)));

  function fill() {
    const today = todayISO();
    const stats = dishStats(state.plan, today);
    const q = normalizeName(ui.query);
    const rows = Object.values(state.dishes).filter((d) => (!q || normalizeName(d.name).includes(q)) && matchesFilter(d, ui.filter));
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
        Object.keys(state.dishes).length ? 'Ningún plato coincide con la búsqueda o el filtro.' : 'Aquí aparecerán los platos que añadas al menú, para repetirlos cuando quieras.',
      ));
      return;
    }
    list.replaceChildren(...rows.map((d) => {
      const link = recipeLink(d.recipe);
      return h('div', { class: 'row' },
        h('span', { class: 'emoji', 'aria-hidden': 'true' }, dishEmoji(d)),
        h('span', { class: 'grow' },
          h('span', { class: 'name' }, d.favorite && h('span', { 'aria-label': 'Favorito', role: 'img' }, '⭐ '), d.name),
          h('span', { class: 'meta' }, lastText(stats.get(d.id), today)),
          dishMeta(d) && h('span', { class: 'meta' }, dishMeta(d)),
          d.tags.length > 0 && h('span', { class: 'chips inline' }, d.tags.map((t) => h('span', { class: 'chip' }, `${TAGS[t].emoji} ${TAGS[t].label}`))),
          link && h('a', { class: 'meta link', href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Ver receta'),
        ),
        h('span', { class: 'tools' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Editar ${d.name}`, onclick: () => openDishEditor(d.id) }, icon('edit')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Eliminar ${d.name}`, onclick: () => removeSavedDish(d.id) }, icon('trash')),
        ),
      );
    }));
  }

  search.addEventListener('input', () => { ui.query = search.value; fill(); });
  fill();

  return h('div', { class: 'view-enter' },
    h('div', { class: 'toolbar' },
      search,
      h('div', {}, segmented('Ordenar por', [['old', 'Hace tiempo'], ['name', 'A–Z'], ['most', 'Más usados']], ui.sort, (v) => { ui.sort = v; fill(); })),
      filter,
      h('div', {}, h('button', { class: 'btn tonal', type: 'button', onclick: () => openDishEditor(null) }, icon('plus'), 'Guardar plato nuevo')),
    ),
    list,
  );
}

function openDishEditor(id) {
  const dish = id ? state.dishes[id] : null;
  const name = h('input', { class: 'field', type: 'text', name: 'nombre', maxlength: '80', required: true, value: dish?.name ?? '', autocomplete: 'off', 'aria-label': 'Nombre del plato', placeholder: 'Nombre del plato…' });
  const emoji = h('input', { class: 'field', type: 'text', name: 'emoji', maxlength: '8', value: dish?.emoji ?? '', autocomplete: 'off', 'aria-label': 'Emoji (opcional)', placeholder: `Emoji opcional (auto: ${dish ? guessEmoji(dish.name) : '🍽️'})…` });
  const minutes = h('input', { class: 'field', type: 'number', name: 'minutos', min: '1', max: '600', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Minutos de preparación', placeholder: 'Sin indicar', value: dish?.minutes ? String(dish.minutes) : '' });
  const level = h('select', { class: 'field', name: 'dificultad', 'aria-label': 'Dificultad' }, [['', 'Sin indicar'], ...Object.entries(LEVELS)].map(([v, l]) => h('option', { value: v, selected: (dish?.level ?? '') === v ? true : null }, l)));
  const recipe = h('textarea', { class: 'field compact short', name: 'receta', maxlength: '600', 'aria-label': 'Receta: enlace o notas', placeholder: 'Enlace a la receta o notas (máx. 600 caracteres)…' });
  recipe.value = dish?.recipe ?? '';
  const ingredients = h('textarea', { class: 'field compact short', name: 'ingredientes', maxlength: '600', 'aria-label': 'Ingredientes', placeholder: 'Ingredientes, separados por comas…' });
  ingredients.value = dish?.ingredients ?? '';
  const tagBoxes = TAG_IDS.map((t) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', name: 'grupo', value: t, checked: (dish ? dish.tags : guessTags(name.value)).includes(t) }),
    h('span', {}, `${TAGS[t].emoji} ${TAGS[t].label}`)));
  const fav = h('input', { type: 'checkbox', name: 'favorito', checked: dish?.favorite === true });
  const frozen = h('input', { type: 'checkbox', name: 'congelado', checked: dish?.frozen === true });
  if (!dish) {
    name.addEventListener('input', () => {
      if (tagBoxes.some((l) => l.dataset.touched)) return; // si ya los has tocado a mano, no los cambiamos
      const guess = guessTags(name.value);
      tagBoxes.forEach((l) => { l.firstChild.checked = guess.includes(l.firstChild.value); });
    });
  }
  tagBoxes.forEach((l) => l.firstChild.addEventListener('change', () => { l.dataset.touched = '1'; }));

  const save = (e) => {
    e.preventDefault();
    const clean = cleanName(name.value);
    if (!clean) return name.focus();
    if (findDishByName(state, clean, id)) return toast('Ya tienes un plato con ese nombre', { error: true });
    const patch = {
      name: clean, emoji: emoji.value, minutes: Number(minutes.value) || 0, level: level.value, recipe: recipe.value, ingredients: ingredients.value,
      tags: tagBoxes.filter((l) => l.firstChild.checked).map((l) => l.firstChild.value), favorite: fav.checked, frozen: frozen.checked,
    };
    dlg.close();
    if (id) {
      commit(updateDish(state, id, patch));
    } else {
      const { state: next, id: newDishId } = upsertDishByName(state, clean);
      commit(updateDish(next, newDishId, patch));
      toast(`Guardado: ${clean}`);
    }
  };

  openDialog(
    h('form', { class: 'dlg', onsubmit: save },
      dialogHead(id ? 'Editar plato' : 'Guardar plato'),
      name, emoji,
      h('fieldset', { class: 'groups' }, h('legend', { class: 'field-label' }, 'Grupos de alimentos (para equilibrar la semana)'), h('div', { class: 'checks' }, tagBoxes)),
      h('div', { class: 'two' },
        h('div', {}, h('label', { class: 'field-label', for: 'ed-min' }, '⏱️ Minutos'), Object.assign(minutes, { id: 'ed-min' })),
        h('div', {}, h('label', { class: 'field-label', for: 'ed-lvl' }, 'Dificultad'), Object.assign(level, { id: 'ed-lvl' })),
      ),
      h('label', { class: 'switch' }, fav, '⭐ Favorito'),
      h('label', { class: 'switch' }, frozen, '🧊 Lo tengo congelado (avisar el día antes)'),
      h('label', { class: 'field-label', for: 'ed-rec' }, 'Receta'), Object.assign(recipe, { id: 'ed-rec' }),
      h('label', { class: 'field-label', for: 'ed-ing' }, 'Ingredientes'), Object.assign(ingredients, { id: 'ed-ing' }),
      h('div', { class: 'buttons' },
        h('button', { class: 'btn text', type: 'button', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit' }, 'Guardar'),
      ),
    ),
    { sheet: true },
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
      h('p', {}, `Todo se guarda solo en este móvil: ${plural(dishCount, 'plato', 'platos')} y ${plural(dayCount, 'día planificado', 'días planificados')}. Nada se envía a ningún servidor, salvo cuando usas el asistente de cenas (más abajo).`),
      h('p', {}, 'Si borras los datos del navegador o desinstalas la app, se pierden. Haz una copia de vez en cuando.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn tonal', type: 'button', onclick: exportData }, 'Exportar copia'),
        h('button', { class: 'btn outline', type: 'button', onclick: () => fileInput.click() }, 'Importar copia'),
        fileInput,
      ),
    ),
    extras.rulesCard(),
    aiCard(),
    extras.transferCard(),
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
  extras.saveMeta({ lastBackup: todayISO() });
  if (ui.view === 'week') render();
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
  restoreState(next);
}

/** Sustituye los datos por los de una copia o un código de traspaso, pidiendo confirmación y permitiendo deshacer. */
async function restoreState(next) {
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
    body: 'Se eliminarán todos tus platos y menús de este móvil, y tus preferencias del asistente. Considera exportar una copia antes.',
    confirmLabel: 'Borrar todo',
    danger: true,
  });
  if (!ok) return;
  const prev = state;
  const prevAi = readStorage(AI_STORE);
  try { localStorage.removeItem(AI_STORE); } catch { /* sin almacenamiento */ }
  commit(emptyState());
  toast('Datos borrados', { label: 'Deshacer', onClick: () => { if (prevAi) writeStorage(AI_STORE, prevAi); commit(prev); } });
}

/* ---------- Render principal ---------- */

let animateNext = true; // la entrada animada solo al abrir la app o cambiar de pantalla, no al añadir un plato

function render() {
  const fk = pendingFocus ?? document.activeElement?.dataset?.fk;
  pendingFocus = null;
  const node = { week: renderWeek, dishes: renderDishes, stats: () => extras.renderStats(), settings: renderSettings }[ui.view]();
  if (!animateNext) node.classList.remove('view-enter');
  animateNext = false;
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
  animateNext = true;
  render();
  window.scrollTo(0, 0);
}

/* ---------- Arranque ---------- */

const ctx = {
  state: () => state, ui, commit, toast, openDialog, dialogHead, segmented, exportData, readStorage, writeStorage, openDishEditor,
  restore: restoreState, rerender: render, close: () => dlg.close(),
  setFocus: (key) => { pendingFocus = key; },
  goToDate: (date) => { ui.weekStart = weekStart(date); ui.idea = 0; render(); window.scrollTo(0, 0); },
};
const tools = createWeekTools(ctx);
const extras = createExtras(ctx);

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
  // El SW nuevo toma el control solo (skipWaiting + clients.claim): avisamos para que el cambio no pase desapercibido.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let notified = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || notified) return;
    notified = true;
    toast('Hay una versión nueva de la app.', { label: 'Recargar', onClick: () => location.reload() });
  });
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
