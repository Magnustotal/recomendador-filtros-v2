// Lógica pura de Menú Semanal: fechas, estado, sugerencias y formato de WhatsApp.
// No toca el DOM ni localStorage, para poder probarla con `node --test`.

export const MEALS = ['lunch', 'dinner'];
export const MEAL_LABEL = { lunch: 'Almuerzo', dinner: 'Cena' };
export const MEAL_EMOJI = { lunch: '☀️', dinner: '🌙' };

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- Fechas (siempre 'YYYY-MM-DD' en hora local) ---------- */

const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isISO(s) {
  return typeof s === 'string' && ISO_RE.test(s) && toISO(parseISO(s)) === s;
}

export const todayISO = () => toISO(new Date());

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Lunes de la semana que contiene la fecha. */
export function weekStart(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

export const weekDays = (startISO) => Array.from({ length: 7 }, (_, i) => addDays(startISO, i));

/** Días de `a` a `b` (b - a), inmune a cambios de hora. */
export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

export const dayName = (iso) => DAYS[parseISO(iso).getDay()];

export function shortDate(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function weekRangeLabel(startISO) {
  const endISO = addDays(startISO, 6);
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  return s.getMonth() === e.getMonth()
    ? `${s.getDate()}–${e.getDate()} ${MONTHS[e.getMonth()]}`
    : `${shortDate(startISO)} – ${shortDate(endISO)}`;
}

export function relativeDays(days) {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 14) return `hace ${days} días`;
  if (days < 60) return `hace ${Math.round(days / 7)} semanas`;
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'hace 1 año' : `hace ${years} años`;
}

/* ---------- Nombres y emojis ---------- */

export function normalizeName(s) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanName(s) {
  const t = s.replace(/\s+/g, ' ').trim().slice(0, 80);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

// Cada regla se compara contra el nombre normalizado (sin tildes) y solo al inicio de palabra.
const EMOJI_RULES = [
  ['pizza', '🍕'],
  ['hamburgues|burger', '🍔'],
  ['perrito|hot ?dog', '🌭'],
  ['taco|burrito|fajita|quesadilla', '🌮'],
  ['wrap|kebab|shawarma', '🌯'],
  ['sushi|maki|poke', '🍣'],
  ['pasta|macarron|espagueti|spaghetti|tallarin|fideo|lasana|lasagna|raviol|canelon|noqui|carbonara|bolonesa', '🍝'],
  ['paella|arroz|risotto|rissoto', '🍚'],
  ['ensalada', '🥗'],
  ['sopa|caldo|crema de|puchero|cocido|lenteja|garbanzo|alubia|judia|fabada|potaje|guiso|estofado|gazpacho|salmorejo|curry', '🍲'],
  ['tortilla|huevo|revuelto', '🍳'],
  ['pollo|pavo|alita|muslo', '🍗'],
  ['pescado|merluza|salmon|bacalao|atun|lubina|dorada|trucha|sardina|gamba|marisco|calamar|pulpo|mejillon', '🐟'],
  ['carne|ternera|cerdo|cordero|filete|chuleta|solomillo|albondiga|costilla|lomo|bistec|entrecot', '🥩'],
  ['bocadillo|bocata|sandwich|tostada', '🥪'],
  ['verdura|brocoli|calabac|espinaca|acelga|berenjena|coliflor|menestra', '🥦'],
  ['patatas?\\b|papas?\\b', '🥔'],
  ['empanada|empanadilla|croqueta', '🥟'],
  ['fruta', '🍎'],
  ['queso', '🧀'],
].map(([src, emoji]) => [new RegExp(`\\b(?:${src})`), emoji]);

export function guessEmoji(name) {
  const n = normalizeName(name);
  for (const [re, emoji] of EMOJI_RULES) if (re.test(n)) return emoji;
  return '🍽️';
}

export const dishEmoji = (dish) => dish.emoji || guessEmoji(dish.name);

/* ---------- Etiquetas ---------- */

export const TAGS = {
  pescado: { label: 'Pescado', emoji: '🐟' },
  carne: { label: 'Carne', emoji: '🥩' },
  legumbre: { label: 'Legumbre', emoji: '🫘' },
  verdura: { label: 'Verdura', emoji: '🥦' },
  huevo: { label: 'Huevo', emoji: '🍳' },
  'pasta-arroz': { label: 'Pasta o arroz', emoji: '🍝' },
  domingo: { label: 'De domingo', emoji: '🎉' },
};
export const TAG_IDS = Object.keys(TAGS);
export const LEVELS = { facil: 'Fácil', media: 'Media', dificil: 'Elaborada' };

// Deducción por nombre (misma idea que los emojis): solo se usa al crear un plato o al migrar datos antiguos.
const TAG_RULES = [
  ['pescado', 'pescado|merluza|salmon|bacalao|atun|lubina|dorada|trucha|sardina|gamba|marisco|calamar|pulpo|mejillon|rape|lenguado|boqueron'],
  ['carne', 'pollo|pavo|carne|ternera|cerdo|cordero|filete|chuleta|solomillo|albondiga|costilla|lomo|bistec|entrecot|hamburgues|jamon|salchicha|conejo'],
  ['legumbre', 'lenteja|garbanzo|alubia|judia|fabada|potaje|cocido|habas'],
  ['verdura', 'verdura|ensalada|brocoli|calabac|espinaca|acelga|berenjena|coliflor|menestra|crema de|pisto|guisante|champi'],
  ['huevo', 'huevo|tortilla|revuelto'],
  ['pasta-arroz', 'pasta|macarron|espagueti|spaghetti|tallarin|fideo|lasana|lasagna|raviol|canelon|noqui|arroz|paella|risotto|rissoto'],
].map(([tag, src]) => [tag, new RegExp(`\\b(?:${src})`)]);

export function guessTags(name) {
  const n = normalizeName(name);
  return TAG_RULES.filter(([, re]) => re.test(n)).map(([tag]) => tag);
}

/* ---------- Estado ---------- */

export const emptyState = () => ({ version: 1, dishes: {}, plan: {}, days: {}, templates: {}, rules: [] });

const OFF_KINDS = ['fuera', 'festivo'];
const clampInt = (v, min, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : 0;
};
const safeUrl = (v) => {
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href.slice(0, 300) : ''; } catch { return ''; }
};
/** Receta: un enlace http(s) o unas notas de texto (máx. 600). */
export function cleanRecipe(v) {
  const t = typeof v === 'string' ? v.trim().slice(0, 600) : '';
  return t;
}
export const recipeLink = (recipe) => (/^https?:\/\/\S+$/.test(recipe) ? safeUrl(recipe) : '');

const validId = (id) => typeof id === 'string' && /^[\w-]{1,64}$/.test(id) && !RESERVED.has(id);

/** Valida y normaliza cualquier dato externo (localStorage o importación). */
export function sanitizeState(raw) {
  const out = emptyState();
  if (!raw || typeof raw !== 'object') return out;

  const dishes = raw.dishes && typeof raw.dishes === 'object' ? raw.dishes : {};
  for (const [id, d] of Object.entries(dishes)) {
    if (!validId(id) || !d || typeof d.name !== 'string') continue;
    const name = cleanName(d.name);
    if (!name) continue;
    out.dishes[id] = {
      id,
      name,
      emoji: typeof d.emoji === 'string' ? d.emoji.trim().slice(0, 8) : '',
      meals: Array.isArray(d.meals) ? [...new Set(d.meals.filter((m) => MEALS.includes(m)))] : [],
      createdAt: isISO(d.createdAt) ? d.createdAt : todayISO(),
      tags: Array.isArray(d.tags) ? [...new Set(d.tags.filter((t) => TAG_IDS.includes(t)))] : guessTags(name),
      favorite: d.favorite === true,
      frozen: d.frozen === true,
      minutes: clampInt(d.minutes, 1, 600),
      level: Object.hasOwn(LEVELS, d.level) ? d.level : '',
      recipe: cleanRecipe(d.recipe),
      ingredients: typeof d.ingredients === 'string' ? d.ingredients.trim().slice(0, 600) : '',
    };
  }

  const plan = raw.plan && typeof raw.plan === 'object' ? raw.plan : {};
  for (const [date, slots] of Object.entries(plan)) {
    if (!isISO(date) || !slots || typeof slots !== 'object') continue;
    const day = {};
    for (const meal of MEALS) {
      if (!Array.isArray(slots[meal])) continue;
      const ids = [...new Set(slots[meal].filter((id) => typeof id === 'string' && Object.hasOwn(out.dishes, id)))];
      if (ids.length) day[meal] = ids;
    }
    if (Object.keys(day).length) out.plan[date] = day;
  }

  const days = raw.days && typeof raw.days === 'object' ? raw.days : {};
  for (const [date, m] of Object.entries(days)) {
    if (!isISO(date) || !m || typeof m !== 'object') continue;
    const meta = {};
    const note = typeof m.note === 'string' ? m.note.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    if (note) meta.note = note;
    if (OFF_KINDS.includes(m.off)) meta.off = m.off;
    const diners = {};
    for (const meal of MEALS) { const n = clampInt(m.diners?.[meal], 1, 20); if (n) diners[meal] = n; }
    if (Object.keys(diners).length) meta.diners = diners;
    if (Object.keys(meta).length) out.days[date] = meta;
  }

  const templates = raw.templates && typeof raw.templates === 'object' ? raw.templates : {};
  for (const [id, t] of Object.entries(templates).slice(0, 20)) {
    if (!validId(id) || !t || typeof t.name !== 'string') continue;
    const name = t.name.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) continue;
    const slots = {};
    for (let i = 0; i < 7; i++) {
      const day = {};
      for (const meal of MEALS) {
        const ids = Array.isArray(t.slots?.[i]?.[meal]) ? [...new Set(t.slots[i][meal].filter((x) => typeof x === 'string' && Object.hasOwn(out.dishes, x)))] : [];
        if (ids.length) day[meal] = ids;
      }
      if (Object.keys(day).length) slots[i] = day;
    }
    out.templates[id] = { id, name, slots };
  }

  if (Array.isArray(raw.rules)) {
    for (const r of raw.rules.slice(0, 10)) {
      if (!r || !TAG_IDS.includes(r.tag) || out.rules.some((x) => x.tag === r.tag)) continue;
      const min = clampInt(r.min, 0, 14);
      const max = clampInt(r.max, 0, 14);
      if (min || max) out.rules.push({ tag: r.tag, min, max });
    }
  }
  return out;
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const slotIds = (state, date, meal) => state.plan[date]?.[meal] ?? [];

function setSlot(plan, date, meal, ids) {
  const day = { ...(plan[date] ?? {}) };
  if (ids.length) day[meal] = ids;
  else delete day[meal];
  const next = { ...plan };
  if (Object.keys(day).length) next[date] = day;
  else delete next[date];
  return next;
}

/** Devuelve el id de un plato existente con ese nombre o crea uno nuevo. */
export function upsertDishByName(state, name, { id = newId(), today = todayISO() } = {}) {
  const clean = cleanName(name);
  const found = findDishByName(state, clean);
  if (found) return { state, id: found.id, created: false };
  const dish = { id, name: clean, emoji: '', meals: [], createdAt: today, tags: guessTags(clean), favorite: false, frozen: false, minutes: 0, level: '', recipe: '', ingredients: '' };
  return { state: { ...state, dishes: { ...state.dishes, [id]: dish } }, id, created: true };
}

export function addToSlot(state, date, meal, id) {
  const current = slotIds(state, date, meal);
  if (current.includes(id) || !state.dishes[id]) return state;
  const dish = state.dishes[id];
  const dishes = dish.meals.includes(meal)
    ? state.dishes
    : { ...state.dishes, [id]: { ...dish, meals: [...dish.meals, meal] } };
  return { ...state, dishes, plan: setSlot(state.plan, date, meal, [...current, id]) };
}

export function removeFromSlot(state, date, meal, id) {
  const current = slotIds(state, date, meal);
  if (!current.includes(id)) return state;
  return { ...state, plan: setSlot(state.plan, date, meal, current.filter((x) => x !== id)) };
}

export function updateDish(state, id, patch) {
  const dish = state.dishes[id];
  if (!dish) return state;
  // Pasa por sanitizeState: así cualquier campo editado queda validado igual que al importar.
  const merged = { ...dish, ...patch, name: cleanName(patch.name ?? dish.name) || dish.name, emoji: (patch.emoji ?? dish.emoji ?? '').trim().slice(0, 8) };
  const clean = sanitizeState({ dishes: { [id]: merged } }).dishes[id];
  return clean ? { ...state, dishes: { ...state.dishes, [id]: { ...clean, createdAt: dish.createdAt, meals: dish.meals } } } : state;
}

export function findDishByName(state, name, exceptId = null) {
  const key = normalizeName(name);
  return Object.values(state.dishes).find((d) => d.id !== exceptId && normalizeName(d.name) === key) ?? null;
}

export function deleteDish(state, id) {
  const dishes = { ...state.dishes };
  delete dishes[id];
  let plan = state.plan;
  for (const [date, slots] of Object.entries(state.plan)) {
    for (const meal of MEALS) {
      if (slots[meal]?.includes(id)) plan = setSlot(plan, date, meal, slots[meal].filter((x) => x !== id));
    }
  }
  const templates = Object.fromEntries(Object.entries(state.templates ?? {}).map(([k, t]) => [k, { ...t, slots: Object.fromEntries(Object.entries(t.slots).map(([i, d]) => [i, Object.fromEntries(Object.entries(d).map(([m, ids]) => [m, ids.filter((x) => x !== id)]).filter(([, ids]) => ids.length))]).filter(([, d]) => Object.keys(d).length)) }]));
  return { ...state, dishes, plan, templates };
}

/** Copia una semana sobre otra, solo en los huecos vacíos. */
export function copyWeek(state, fromStart, toStart) {
  let plan = state.plan;
  let copied = 0;
  for (let i = 0; i < 7; i++) {
    const from = addDays(fromStart, i);
    const to = addDays(toStart, i);
    for (const meal of MEALS) {
      const src = state.plan[from]?.[meal];
      if (src?.length && !plan[to]?.[meal]?.length) {
        plan = setSlot(plan, to, meal, [...src]);
        copied++;
      }
    }
  }
  return { state: copied ? { ...state, plan } : state, copied };
}

/* ---------- Estadísticas y sugerencias ---------- */

/** Por plato: veces comido, última vez (<= hoy) y próxima vez planificada (> hoy). */
export function dishStats(plan, today) {
  const stats = new Map();
  for (const [date, slots] of Object.entries(plan)) {
    for (const meal of MEALS) {
      for (const id of slots[meal] ?? []) {
        const s = stats.get(id) ?? { count: 0, last: null, next: null };
        if (date <= today) {
          s.count++;
          if (!s.last || date > s.last) s.last = date;
        } else if (!s.next || date < s.next) {
          s.next = date;
        }
        stats.set(id, s);
      }
    }
  }
  return stats;
}

/**
 * Platos guardados ordenados por "hace más tiempo que no los comes".
 * Un plato guardado pero nunca planificado cuenta desde el día que se guardó.
 * Se excluyen los que ya están planificados dentro de `horizon` días.
 */
export function suggest(dishes, plan, today, { meal = null, limit = 5, minDays = 0, horizon = 7, cooldown = 0 } = {}) {
  const stats = dishStats(plan, today);
  const horizonEnd = addDays(today, horizon);
  const out = [];
  for (const dish of Object.values(dishes)) {
    const s = stats.get(dish.id);
    if (s?.next && s.next <= horizonEnd) continue;
    if (meal && dish.meals.length && !dish.meals.includes(meal)) continue;
    const days = daysBetween(s?.last ?? dish.createdAt, today);
    if (days < minDays) continue;
    if (s?.last && daysBetween(s.last, today) < cooldown) continue; // acaba de comerse
    out.push({ dish, days, never: !s?.last });
  }
  out.sort((a, b) => b.days - a.days || a.dish.name.localeCompare(b.dish.name, 'es'));
  return out.slice(0, limit);
}

/** Primer hueco vacío desde hoy dentro de los días dados. */
export function firstEmptySlot(days, plan, today, meta = {}) {
  for (const date of days) {
    if (date < today || meta[date]?.off) continue;
    for (const meal of MEALS) if (!plan[date]?.[meal]?.length) return { date, meal };
  }
  return null;
}

/* ---------- Días: notas, «fuera de casa» y comensales ---------- */

export const OFF_LABEL = { fuera: 'Comemos fuera', festivo: 'Festivo' };

export function setDayMeta(state, date, patch) {
  const next = sanitizeState({ ...state, days: { ...state.days, [date]: { ...(state.days[date] ?? {}), ...patch } } });
  const days = { ...state.days };
  if (next.days[date]) days[date] = next.days[date];
  else delete days[date];
  return { ...state, days };
}

/* ---------- Mover o copiar platos ---------- */

/** Mueve (o copia) un plato de un hueco a otro. Devuelve el mismo estado si no cambia nada. */
export function moveDish(state, from, to, id, { copy = false } = {}) {
  if (!state.dishes[id] || !slotIds(state, from.date, from.meal).includes(id)) return state;
  if (from.date === to.date && from.meal === to.meal) return state;
  if (slotIds(state, to.date, to.meal).includes(id)) return copy ? state : removeFromSlot(state, from.date, from.meal, id);
  const added = addToSlot(state, to.date, to.meal, id);
  return copy ? added : removeFromSlot(added, from.date, from.meal, id);
}

/* ---------- Plantillas de semana ---------- */

export function saveTemplate(state, name, weekStartISO, { id = newId() } = {}) {
  const slots = {};
  weekDays(weekStartISO).forEach((date, i) => {
    const day = {};
    for (const meal of MEALS) if (slotIds(state, date, meal).length) day[meal] = [...slotIds(state, date, meal)];
    if (Object.keys(day).length) slots[i] = day;
  });
  const clean = sanitizeState({ ...state, templates: { ...state.templates, [id]: { id, name, slots } } });
  if (!clean.templates[id] || !Object.keys(slots).length) return { state, id: null };
  return { state: { ...state, templates: { ...state.templates, [id]: clean.templates[id] } }, id };
}

/** Aplica la plantilla solo a los huecos vacíos (y no en días «fuera de casa»). */
export function applyTemplate(state, id, weekStartISO) {
  const t = state.templates[id];
  if (!t) return { state, copied: 0 };
  let plan = state.plan;
  let copied = 0;
  weekDays(weekStartISO).forEach((date, i) => {
    if (state.days[date]?.off) return;
    for (const meal of MEALS) {
      const ids = (t.slots[i]?.[meal] ?? []).filter((x) => state.dishes[x]);
      if (ids.length && !plan[date]?.[meal]?.length) { plan = setSlot(plan, date, meal, ids); copied++; }
    }
  });
  return { state: copied ? { ...state, plan } : state, copied };
}

export function deleteTemplate(state, id) {
  const templates = { ...state.templates };
  delete templates[id];
  return { ...state, templates };
}

/* ---------- Equilibrio por grupos y reglas de frecuencia ---------- */

/** Veces que aparece cada etiqueta en la semana (un plato con varias etiquetas suma en cada una). */
export function weekTagCounts(state, weekStartISO) {
  const counts = {};
  for (const date of weekDays(weekStartISO)) {
    for (const meal of MEALS) {
      for (const id of slotIds(state, date, meal)) {
        for (const tag of state.dishes[id]?.tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/** Estado de cada regla en la semana: 'ok', 'low' (faltan) o 'high' (te pasas). */
export function ruleStatus(state, weekStartISO) {
  const counts = weekTagCounts(state, weekStartISO);
  return state.rules.map((r) => {
    const count = counts[r.tag] ?? 0;
    return { ...r, count, status: r.min && count < r.min ? 'low' : r.max && count > r.max ? 'high' : 'ok' };
  });
}

export function ruleText(r) {
  const name = TAGS[r.tag].label.toLowerCase();
  if (r.min && r.max) return r.min === r.max ? `${name}: ${r.min} por semana` : `${name}: de ${r.min} a ${r.max} por semana`;
  if (r.min) return `${name}: al menos ${r.min} por semana`;
  return `${name}: como mucho ${r.max} por semana`;
}

/* ---------- Avisos ---------- */

/** Platos congelados previstos para mañana (para sacarlos hoy). */
export function frozenReminders(state, today) {
  const tomorrow = addDays(today, 1);
  const out = [];
  for (const meal of MEALS) {
    for (const id of slotIds(state, tomorrow, meal)) if (state.dishes[id]?.frozen) out.push({ dish: state.dishes[id], meal });
  }
  return out;
}

export const backupDue = (lastISO, today, every = 30) => !lastISO || daysBetween(lastISO, today) >= every;

/* ---------- Estadísticas ---------- */

/** Resumen de los últimos `span` días hasta hoy (incluido). */
export function periodStats(state, today, span = 90) {
  const from = addDays(today, -(span - 1));
  const perDish = new Map();
  const perTag = {};
  let meals = 0;
  let planned = 0;
  let total = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (state.days[d]?.off) continue;
    for (const meal of MEALS) {
      total++;
      const ids = slotIds(state, d, meal).filter((id) => state.dishes[id]);
      if (!ids.length) continue;
      planned++;
      for (const id of ids) {
        meals++;
        perDish.set(id, (perDish.get(id) ?? 0) + 1);
        for (const tag of state.dishes[id].tags) perTag[tag] = (perTag[tag] ?? 0) + 1;
      }
    }
  }
  const top = [...perDish].map(([id, count]) => ({ dish: state.dishes[id], count })).sort((a, b) => b.count - a.count || a.dish.name.localeCompare(b.dish.name, 'es')).slice(0, 10);
  return { from, span, top, perTag, meals, planned, total, coverage: total ? Math.round((planned / total) * 100) : 0 };
}

/* ---------- Mes ---------- */

/** Semanas (lunes a domingo) que cubren el mes; cada celda es una fecha ISO. */
export function monthMatrix(year, month) {
  const first = toISO(new Date(year, month, 1));
  let cursor = weekStart(first);
  const rows = [];
  do {
    rows.push(weekDays(cursor));
    cursor = addDays(cursor, 7);
  } while (parseISO(cursor).getMonth() === month && parseISO(cursor).getFullYear() === year);
  return rows;
}

export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* ---------- Calendario (.ics) ---------- */

const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsFold = (line) => {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; len = 0; }
    cur += ch; len += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
};

/** Un evento por comida planificada entre dos fechas (ambas incluidas), en hora local flotante. */
export function buildICS(state, fromISO, toISO_, { lunchAt = '14:00', dinnerAt = '21:00', stamp = new Date() } = {}) {
  const at = { lunch: lunchAt, dinner: dinnerAt };
  const stampTxt = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Menu semanal//ES', 'CALSCALE:GREGORIAN'];
  for (let d = fromISO; d <= toISO_; d = addDays(d, 1)) {
    for (const meal of MEALS) {
      const names = slotIds(state, d, meal).map((id) => state.dishes[id]).filter(Boolean).map((x) => x.name);
      if (!names.length) continue;
      const [h, m] = at[meal].split(':').map(Number);
      const start = `${d.replaceAll('-', '')}T${pad(h)}${pad(m)}00`;
      const end = `${d.replaceAll('-', '')}T${pad(Math.min(h + 1, 23))}${pad(m)}00`;
      lines.push('BEGIN:VEVENT', `UID:${d}-${meal}@menu-semanal`, `DTSTAMP:${stampTxt}`, `DTSTART:${start}`, `DTEND:${end}`,
        `SUMMARY:${icsEscape(`${MEAL_EMOJI[meal]} ${MEAL_LABEL[meal]}: ${names.join(' + ')}`)}`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(icsFold).join('\r\n')}\r\n`;
}

/* ---------- Traspaso a otro móvil (texto, sin servidor) ---------- */

const SHARE_PREFIX = 'menu-semanal:1:';

export function encodeShare(state) {
  const json = JSON.stringify(sanitizeState(state));
  const bin = Array.from(new TextEncoder().encode(json), (b) => String.fromCharCode(b)).join('');
  return SHARE_PREFIX + btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Devuelve el estado o null si el texto no es un código válido. */
export function decodeShare(text) {
  const t = String(text ?? '').trim();
  const start = t.indexOf(SHARE_PREFIX);
  if (start < 0) return null;
  const body = t.slice(start + SHARE_PREFIX.length).match(/^[A-Za-z0-9_-]+/)?.[0];
  if (!body) return null;
  try {
    const bin = atob(body.replaceAll('-', '+').replaceAll('_', '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return sanitizeState(JSON.parse(json));
  } catch { return null; }
}

/* ---------- WhatsApp ---------- */

// WhatsApp usa *negrita*, _cursiva_, ~tachado~ y `código`: los quitamos de los nombres.
const stripMarks = (s) => s.replace(/[*_~`]/g, '');

export const WA_FORMATS = { full: 'Completo', short: 'Corto', lunch: 'Solo almuerzos', dinner: 'Solo cenas' };
const SHORT_DAY = { Lunes: 'Lun', Martes: 'Mar', 'Miércoles': 'Mié', Jueves: 'Jue', Viernes: 'Vie', 'Sábado': 'Sáb', Domingo: 'Dom' };

export function formatWhatsApp(weekStartISO, state, { includeEmpty = false, format = 'full' } = {}) {
  const meals = format === 'lunch' ? ['lunch'] : format === 'dinner' ? ['dinner'] : MEALS;
  const blocks = [];
  for (const date of weekDays(weekStartISO)) {
    const meta = state.days?.[date] ?? {};
    const parts = [];
    for (const meal of meals) {
      const items = slotIds(state, date, meal)
        .map((id) => state.dishes[id])
        .filter(Boolean)
        .map((d) => `${dishEmoji(d)} ${stripMarks(d.name)}`);
      const diners = meta.diners?.[meal] ? ` (${meta.diners[meal]} pers.)` : '';
      parts.push({ meal, items, diners });
    }
    const note = meta.note ? stripMarks(meta.note) : '';
    if (format === 'short') {
      const text = parts.filter((p) => p.items.length).map((p) => `${MEAL_EMOJI[p.meal]} ${p.items.join(' + ')}${p.diners}`).join(' · ');
      const off = meta.off ? OFF_LABEL[meta.off] : '';
      const body = [off, text, note && `📝 ${note}`].filter(Boolean).join(' · ');
      if (body || includeEmpty) blocks.push(`*${SHORT_DAY[dayName(date)]} ${parseISO(date).getDate()}:* ${body || '—'}`);
      continue;
    }
    const lines = [];
    if (meta.off) lines.push(`🚫 ${OFF_LABEL[meta.off]}`);
    for (const p of parts) {
      const head = `${MEAL_EMOJI[p.meal]} *${MEAL_LABEL[p.meal]}:*`;
      if (p.items.length) lines.push(`${head} ${p.items.join(' + ')}${p.diners}`);
      else if (includeEmpty && !meta.off) lines.push(`${head} —`);
    }
    if (note) lines.push(`📝 ${note}`);
    if (lines.length) blocks.push([`📅 *${dayName(date)} ${shortDate(date)}*`, ...lines].join('\n'));
  }
  const title = format === 'lunch' ? 'Almuerzos de la semana' : format === 'dinner' ? 'Cenas de la semana' : 'Menú de la semana';
  const header = `🍽️ *${title}*\n🗓️ ${weekRangeLabel(weekStartISO)}`;
  if (!blocks.length) return `${header}\n\nAún no hay comidas planificadas.`;
  return format === 'short' ? [header, blocks.join('\n'), '¡Buen provecho! 😋'].join('\n\n') : [header, ...blocks, '¡Buen provecho! 😋'].join('\n\n');
}
