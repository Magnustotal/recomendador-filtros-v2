// Extras de la app: estadísticas, reglas de equilibrio, traspaso a otro móvil, imagen y calendario, avisos y primeros pasos.
import { h, icon, plural } from './dom.js';
import {
  MEALS, MEAL_EMOJI, MEAL_LABEL, TAGS, TAG_IDS, WA_FORMATS,
  addDays, backupDue, buildICS, dayName, daysBetween, decodeShare, dishEmoji, encodeShare, frozenReminders, periodStats, relativeDays,
  ruleText, sanitizeState, shortDate, slotIds, suggest, todayISO, upsertDishByName, weekDays, weekRangeLabel, weekStart,
} from './lib.js';

const META_KEY = 'menu-semanal:meta'; // fuera de las copias de seguridad

export const SAMPLE_DISHES = [
  'Macarrones con tomate', 'Lentejas estofadas', 'Merluza a la plancha con verduras', 'Tortilla de patatas', 'Pollo asado con patatas',
  'Crema de calabacín', 'Arroz con verduras', 'Albóndigas en salsa', 'Salmón al horno', 'Ensalada mixta', 'Garbanzos con espinacas', 'Hamburguesa casera',
];

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Dibuja la semana en un PNG (1080 px de ancho) usando solo canvas 2D. */
export async function weekImage(state, weekStartISO) {
  const W = 1080;
  const pad = 48;
  const probe = document.createElement('canvas').getContext('2d');
  const FONT = '32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  probe.font = FONT;
  const wrap = (text, max) => {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (probe.measureText(next).width > max && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines.length > 3 ? [...lines.slice(0, 2), `${lines[2].slice(0, -1)}…`] : lines;
  };
  const days = weekDays(weekStartISO).map((date) => {
    const meta = state.days[date] ?? {};
    const rows = MEALS.map((meal) => {
      const names = slotIds(state, date, meal).map((id) => state.dishes[id]).filter(Boolean).map((d) => `${dishEmoji(d)} ${d.name}`);
      const text = names.length ? names.join(' + ') : '—';
      return { meal, lines: wrap(text, W - pad * 2 - 230), empty: !names.length };
    });
    const height = 28 + Math.max(2, rows[0].lines.length + rows[1].lines.length) * 40 + (meta.note ? 36 : 0) + 24;
    return { date, meta, rows, height };
  });
  const H = 220 + days.reduce((n, d) => n + d.height + 16, 0) + 80;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  const round = (x, y, w, hgt, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, hgt, r) : c.rect(x, y, w, hgt); };
  c.fillStyle = '#FFF8F5';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#3d160a';
  c.textAlign = 'center';
  c.font = 'bold 68px Georgia, "Iowan Old Style", serif';
  c.fillText('Menú de la semana', W / 2, 108);
  c.font = '34px system-ui, sans-serif';
  c.fillStyle = '#9a4521';
  c.fillText(weekRangeLabel(weekStartISO), W / 2, 164);
  c.textAlign = 'left';
  let y = 200;
  for (const d of days) {
    c.fillStyle = '#ffffff';
    round(pad, y, W - pad * 2, d.height, 28); c.fill();
    c.strokeStyle = 'rgba(154,69,33,.25)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#9a4521';
    c.font = 'bold 34px Georgia, serif';
    c.fillText(dayName(d.date), pad + 28, y + 52);
    c.font = '26px system-ui, sans-serif';
    c.fillStyle = '#52443d';
    c.fillText(shortDate(d.date) + (d.meta.off ? ' · fuera de casa' : ''), pad + 28, y + 88);
    let ty = y + 48;
    c.font = FONT;
    for (const r of d.rows) {
      c.fillStyle = r.meal === 'lunch' ? '#7a5200' : '#1d4a86';
      c.fillText(MEAL_EMOJI[r.meal], pad + 230, ty);
      c.fillStyle = r.empty ? '#85736b' : '#221a16';
      r.lines.forEach((line, i) => c.fillText(line, pad + 290, ty + i * 40));
      ty += r.lines.length * 40;
    }
    if (d.meta.note) { c.fillStyle = '#52443d'; c.font = 'italic 28px system-ui, sans-serif'; c.fillText(`📝 ${d.meta.note}`, pad + 28, y + d.height - 24); }
    y += d.height + 16;
  }
  c.fillStyle = '#85736b';
  c.font = '26px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('¡Buen provecho! 😋', W / 2, H - 30);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function createExtras(ctx) {
  const { toast, openDialog, dialogHead } = ctx;

  /* ----- Datos auxiliares (fuera de la copia de seguridad) ----- */
  const meta = () => { try { return JSON.parse(ctx.readStorage(META_KEY) ?? '{}') ?? {}; } catch { return {}; } };
  const saveMeta = (patch) => ctx.writeStorage(META_KEY, JSON.stringify({ ...meta(), ...patch }));
  if (!meta().firstSeen) saveMeta({ firstSeen: todayISO() });

  /* ----- Avisos de la vista Semana ----- */
  function banners() {
    const st = ctx.state();
    const today = todayISO();
    const out = [];
    const m = meta();

    if (!Object.keys(st.dishes).length && !Object.keys(st.plan).length && !m.onboarded) {
      out.push(h('section', { class: 'idea welcome', 'aria-label': 'Primeros pasos' },
        h('p', { class: 'kicker' }, '👋 Bienvenido'),
        h('p', { class: 'dish' }, 'Empieza con unos platos de ejemplo'),
        h('p', { class: 'why' }, 'Te cargo 12 platos típicos (con sus grupos de alimentos) para que pruebes la app. Los puedes borrar o cambiar cuando quieras.'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', type: 'button', 'data-fk': 'sample', onclick: loadSamples }, 'Cargar platos de ejemplo'),
          h('button', { class: 'btn text', type: 'button', onclick: () => { saveMeta({ onboarded: true }); ctx.rerender(); } }, 'Empezar en blanco'),
        ),
      ));
    }

    if (ctx.ui.weekStart === weekStart(today)) {
      const frozen = frozenReminders(st, today);
      if (frozen.length) {
        out.push(h('section', { class: 'notice', role: 'status', 'aria-label': 'Aviso de congelados' },
          h('span', { 'aria-hidden': 'true' }, '🧊'),
          h('p', {}, `Mañana toca ${frozen.map((f) => `${f.dish.name} (${MEAL_LABEL[f.meal].toLowerCase()})`).join(' y ')}: sácalo hoy del congelador.`),
        ));
      }
    }

    const hasData = Object.keys(st.dishes).length >= 3;
    if (hasData && backupDue(m.lastBackup ?? m.firstSeen, today) && !(m.snoozeUntil && m.snoozeUntil > today)) {
      out.push(h('section', { class: 'notice', 'aria-label': 'Copia de seguridad' },
        h('span', { 'aria-hidden': 'true' }, '💾'),
        h('p', {}, m.lastBackup ? `Hace ${daysBetween(m.lastBackup, today)} días de tu última copia de seguridad.` : 'Aún no has hecho ninguna copia de seguridad.'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn tonal small', type: 'button', onclick: () => ctx.exportData() }, 'Exportar copia'),
          h('button', { class: 'btn text small', type: 'button', onclick: () => { saveMeta({ snoozeUntil: addDays(today, 7) }); ctx.rerender(); } }, 'Recordármelo en una semana'),
        ),
      ));
    }
    return out;
  }

  function loadSamples() {
    let next = ctx.state();
    for (const name of SAMPLE_DISHES) next = upsertDishByName(next, name).state;
    saveMeta({ onboarded: true });
    ctx.commit(next);
    toast(`Cargados ${SAMPLE_DISHES.length} platos de ejemplo`);
  }

  /* ----- Estadísticas ----- */
  function renderStats() {
    const st = ctx.state();
    const today = todayISO();
    const span = ctx.ui.statsSpan;
    const s = periodStats(st, today, span);
    const old = suggest(st.dishes, st.plan, today, { limit: 5 });
    const maxTop = Math.max(1, ...s.top.map((t) => t.count));
    const tagTotal = Math.max(1, ...Object.values(s.perTag), 1);
    return h('div', { class: 'view-enter' },
      ctx.segmented('Periodo', [['30', '30 días'], ['90', '3 meses'], ['365', 'Un año']], String(span), (v) => { ctx.ui.statsSpan = Number(v); ctx.rerender(); }),
      h('section', { class: 'card' },
        h('h2', {}, '📊 Resumen'),
        s.meals
          ? h('p', {}, `En los últimos ${span} días has planificado ${s.planned} de ${s.total} comidas (${s.coverage} %) con ${plural(s.meals, 'plato', 'platos')} en total. Los días «fuera de casa» no cuentan.`)
          : h('p', {}, 'Todavía no hay comidas planificadas en este periodo. Cuando planifiques, aquí verás qué repites más.'),
      ),
      s.top.length > 0 && h('section', { class: 'card' },
        h('h2', {}, '🏆 Lo que más repites'),
        h('ol', { class: 'bars' }, s.top.map((t) => h('li', {},
          h('span', { class: 'bar-label' }, `${dishEmoji(t.dish)} ${t.dish.name}`),
          h('span', { class: 'bar-n' }, plural(t.count, 'vez', 'veces')),
          h('meter', { min: '0', max: String(maxTop), value: String(t.count), 'aria-label': `${t.dish.name}: ${plural(t.count, 'vez', 'veces')}` }),
        ))),
      ),
      Object.keys(s.perTag).length > 0 && h('section', { class: 'card' },
        h('h2', {}, '⚖️ Por grupos de alimentos'),
        h('ul', { class: 'bars' }, Object.entries(s.perTag).sort((a, b) => b[1] - a[1]).map(([tag, n]) => h('li', {},
          h('span', { class: 'bar-label' }, `${TAGS[tag].emoji} ${TAGS[tag].label}`),
          h('span', { class: 'bar-n' }, plural(n, 'vez', 'veces')),
          h('meter', { min: '0', max: String(tagTotal), value: String(n), 'aria-label': `${TAGS[tag].label}: ${plural(n, 'vez', 'veces')}` }),
        ))),
      ),
      old.length > 0 && h('section', { class: 'card' },
        h('h2', {}, '⏳ Llevas más tiempo sin comer'),
        h('ul', { class: 'plain' }, old.map((o) => h('li', {}, `${dishEmoji(o.dish)} ${o.dish.name} — ${o.never ? 'aún sin planificar' : relativeDays(o.days)}`))),
      ),
    );
  }

  /* ----- Reglas de equilibrio (Ajustes) ----- */
  function rulesCard() {
    const st = ctx.state();
    const tag = h('select', { class: 'field', name: 'regla-grupo', 'aria-label': 'Grupo de alimentos' }, TAG_IDS.filter((t) => t !== 'domingo').map((t) => h('option', { value: t }, `${TAGS[t].emoji} ${TAGS[t].label}`)));
    const min = h('input', { class: 'field', type: 'number', name: 'regla-min', min: '0', max: '14', inputmode: 'numeric', 'aria-label': 'Mínimo por semana', placeholder: 'Mín.' });
    const max = h('input', { class: 'field', type: 'number', name: 'regla-max', min: '0', max: '14', inputmode: 'numeric', 'aria-label': 'Máximo por semana', placeholder: 'Máx.' });
    const add = (e) => {
      e.preventDefault();
      const rule = { tag: tag.value, min: Number(min.value) || 0, max: Number(max.value) || 0 };
      if (!rule.min && !rule.max) return toast('Indica un mínimo, un máximo o ambos.', { error: true });
      if (rule.min && rule.max && rule.min > rule.max) return toast('El mínimo no puede ser mayor que el máximo.', { error: true });
      const cur = ctx.state();
      ctx.commit({ ...cur, rules: sanitizeState({ rules: [...cur.rules.filter((r) => r.tag !== rule.tag), rule] }).rules });
      toast('Regla guardada');
    };
    const remove = (r) => {
      const prev = ctx.state();
      ctx.commit({ ...prev, rules: prev.rules.filter((x) => x.tag !== r.tag) });
      toast('Regla eliminada', { label: 'Deshacer', onClick: () => ctx.commit(prev) });
    };
    return h('section', { class: 'card' },
      h('h2', {}, '⚖️ Reglas de equilibrio'),
      h('p', {}, 'Define cuántas veces por semana quieres cada grupo (por ejemplo, pescado al menos 2). Se muestran en la semana y se tienen en cuenta al pedir cenas a la IA.'),
      st.rules.length > 0 && h('ul', { class: 'plain rules' }, st.rules.map((r) => h('li', {},
        h('span', {}, `${TAGS[r.tag].emoji} ${ruleText(r)}`),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Eliminar la regla de ${TAGS[r.tag].label.toLowerCase()}`, onclick: () => remove(r) }, icon('trash')),
      ))),
      h('form', { class: 'rule-form', onsubmit: add }, tag, h('div', { class: 'two' }, min, max), h('button', { class: 'btn tonal', type: 'submit' }, 'Añadir regla')),
    );
  }

  /* ----- Traspaso a otro móvil ----- */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  function transferCard() {
    const out = h('textarea', { class: 'field compact short', name: 'codigo-traspaso', readonly: true, hidden: true, spellcheck: 'false', 'aria-label': 'Código de traspaso' });
    const make = async () => {
      const code = encodeShare(ctx.state());
      out.value = code;
      out.hidden = false;
      if (await copyText(code)) toast('Código copiado. Pégalo en el otro móvil (por ejemplo, enviándotelo por WhatsApp).');
      else { out.select(); toast('Selecciona el código y cópialo.'); }
    };
    return h('section', { class: 'card' },
      h('h2', {}, '📲 Pasar los datos a otro móvil'),
      h('p', {}, 'No hay sincronización automática: genera un código con tus platos y menús, envíatelo (WhatsApp, correo…) y pégalo en el otro móvil. Es una copia puntual; los cambios posteriores no se sincronizan.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn tonal', type: 'button', onclick: make }, 'Copiar código'),
        h('button', { class: 'btn outline', type: 'button', onclick: openTransferImport }, 'Pegar código'),
      ),
      out,
    );
  }

  function openTransferImport() {
    const area = h('textarea', { class: 'field compact', name: 'codigo-pegado', spellcheck: 'false', 'aria-label': 'Código recibido', placeholder: 'Pega aquí el código que empieza por menu-semanal:1:…' });
    const go = (e) => {
      e.preventDefault();
      const next = decodeShare(area.value);
      if (!next) return toast('Ese texto no es un código válido.', { error: true });
      ctx.restore(next); // sin cerrar antes: el diálogo de confirmación sustituye a este (cerrar y reabrir dispara un «close» tardío)
    };
    openDialog(
      h('form', { class: 'dlg', onsubmit: go },
        dialogHead('Pegar código', 'Sustituirá tus datos actuales por los del código (podrás deshacerlo).'),
        area,
        h('div', { class: 'buttons' },
          h('button', { class: 'btn text', type: 'button', onclick: () => ctx.close() }, 'Cancelar'),
          h('button', { class: 'btn', type: 'submit' }, 'Continuar'),
        ),
      ),
      { sheet: true },
    );
    area.focus();
  }

  /* ----- Exportaciones del mensaje semanal ----- */
  function exportButtons() {
    const st = () => ctx.state();
    const ics = (all) => {
      const from = all ? todayISO() : ctx.ui.weekStart;
      const to = all ? Object.keys(st().plan).sort().at(-1) ?? from : addDays(ctx.ui.weekStart, 6);
      const text = buildICS(st(), from, to < from ? from : to);
      if (!text.includes('BEGIN:VEVENT')) return toast('No hay comidas planificadas en ese periodo.');
      download(new Blob([text], { type: 'text/calendar' }), `menu-semana-${from}.ics`);
      toast('Calendario descargado: ábrelo para añadirlo a tu agenda.');
    };
    const image = async () => {
      const blob = await weekImage(st(), ctx.ui.weekStart);
      if (!blob) return toast('No se pudo crear la imagen.', { error: true });
      const file = new File([blob], `menu-semana-${ctx.ui.weekStart}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Menú de la semana' }); return; } catch (err) { if (err?.name === 'AbortError') return; }
      }
      download(blob, file.name);
      toast('Imagen descargada.');
    };
    return [
      h('button', { class: 'btn outline small', type: 'button', 'data-fk': 'img', onclick: image }, '🖼️ Imagen'),
      h('button', { class: 'btn outline small', type: 'button', onclick: () => ics(false) }, '📅 Calendario (semana)'),
      h('button', { class: 'btn outline small', type: 'button', onclick: () => ics(true) }, '📅 Calendario (todo)'),
    ];
  }

  return { banners, renderStats, rulesCard, transferCard, exportButtons, saveMeta, meta, WA_FORMATS };
}
