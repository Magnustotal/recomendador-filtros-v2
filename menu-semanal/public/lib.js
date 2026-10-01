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

/* ---------- Estado ---------- */

export const emptyState = () => ({ version: 1, dishes: {}, plan: {} });

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
  const dish = { id, name: clean, emoji: '', meals: [], createdAt: today };
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

export function updateDish(state, id, { name, emoji }) {
  const dish = state.dishes[id];
  if (!dish) return state;
  return { ...state, dishes: { ...state.dishes, [id]: { ...dish, name: cleanName(name) || dish.name, emoji: (emoji ?? dish.emoji).trim().slice(0, 8) } } };
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
  return { ...state, dishes, plan };
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
export function suggest(dishes, plan, today, { meal = null, limit = 5, minDays = 0, horizon = 7 } = {}) {
  const stats = dishStats(plan, today);
  const horizonEnd = addDays(today, horizon);
  const out = [];
  for (const dish of Object.values(dishes)) {
    const s = stats.get(dish.id);
    if (s?.next && s.next <= horizonEnd) continue;
    if (meal && dish.meals.length && !dish.meals.includes(meal)) continue;
    const days = daysBetween(s?.last ?? dish.createdAt, today);
    if (days < minDays) continue;
    out.push({ dish, days, never: !s?.last });
  }
  out.sort((a, b) => b.days - a.days || a.dish.name.localeCompare(b.dish.name, 'es'));
  return out.slice(0, limit);
}

/** Primer hueco vacío desde hoy dentro de los días dados. */
export function firstEmptySlot(days, plan, today) {
  for (const date of days) {
    if (date < today) continue;
    for (const meal of MEALS) if (!plan[date]?.[meal]?.length) return { date, meal };
  }
  return null;
}

/* ---------- WhatsApp ---------- */

// WhatsApp usa *negrita*, _cursiva_, ~tachado~ y `código`: los quitamos de los nombres.
const stripMarks = (s) => s.replace(/[*_~`]/g, '');

export function formatWhatsApp(weekStartISO, state, { includeEmpty = false } = {}) {
  const blocks = [];
  for (const date of weekDays(weekStartISO)) {
    const lines = [];
    for (const meal of MEALS) {
      const items = slotIds(state, date, meal)
        .map((id) => state.dishes[id])
        .filter(Boolean)
        .map((d) => `${dishEmoji(d)} ${stripMarks(d.name)}`);
      const head = `${MEAL_EMOJI[meal]} *${MEAL_LABEL[meal]}:*`;
      if (items.length) lines.push(`${head} ${items.join(' + ')}`);
      else if (includeEmpty) lines.push(`${head} —`);
    }
    if (lines.length) blocks.push([`📅 *${dayName(date)} ${shortDate(date)}*`, ...lines].join('\n'));
  }
  const header = `🍽️ *Menú de la semana*\n🗓️ ${weekRangeLabel(weekStartISO)}`;
  if (!blocks.length) return `${header}\n\nAún no hay comidas planificadas.`;
  return [header, ...blocks, '¡Buen provecho! 😋'].join('\n\n');
}
