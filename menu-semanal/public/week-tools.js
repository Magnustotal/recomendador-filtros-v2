// Herramientas de la vista Semana: detalles del día, menú de cada plato (mover/copiar), plantillas, mes y equilibrio.
// Reciben un contexto (`ctx`) con el estado y los diálogos de app.js, para no depender de variables globales.
import { h, icon, illustration } from './dom.js';
import {
  MEALS, MEAL_LABEL, MEAL_EMOJI, MONTH_NAMES, OFF_LABEL, TAGS,
  applyTemplate, dayName, deleteTemplate, monthMatrix, moveDish, parseISO, removeFromSlot, ruleStatus, saveTemplate, setDayMeta,
  shortDate, slotIds, todayISO, weekDays, weekTagCounts,
} from './lib.js';

const dayLabel = (date) => `${dayName(date)} ${shortDate(date)}`;

export function createWeekTools(ctx) {
  const { toast, openDialog, dialogHead } = ctx;

  /* ----- Detalles del día: nota, fuera de casa y comensales ----- */
  function openDayEditor(date) {
    const meta = ctx.state().days[date] ?? {};
    const note = h('input', { class: 'field', type: 'text', name: 'nota', maxlength: '120', autocomplete: 'off', 'aria-label': 'Nota del día', placeholder: 'Nota: cumpleaños, visita, médico…', value: meta.note ?? '' });
    const diners = Object.fromEntries(MEALS.map((meal) => [meal, h('input', {
      class: 'field', type: 'number', name: `comensales-${meal}`, min: '1', max: '20', inputmode: 'numeric', autocomplete: 'off',
      'aria-label': `Comensales en ${MEAL_LABEL[meal].toLowerCase()}`, placeholder: 'Sin indicar', value: meta.diners?.[meal] ? String(meta.diners[meal]) : '',
    })]));
    let off = meta.off ?? '';

    const save = (e) => {
      e.preventDefault();
      ctx.close();
      ctx.commit(setDayMeta(ctx.state(), date, {
        note: note.value, off,
        diners: Object.fromEntries(MEALS.map((m) => [m, Number(diners[m].value) || 0])),
      }));
    };
    openDialog(
      h('form', { class: 'dlg', onsubmit: save },
        dialogHead(`Detalles de ${dayLabel(date).toLowerCase()}`, 'Una nota para recordar algo, si ese día no se cocina en casa y cuántos coméis.'),
        ctx.segmented('Tipo de día', [['', 'Normal'], ['fuera', '🚫 Fuera de casa'], ['festivo', '🎉 Festivo']], off, (v) => { off = v; }),
        h('label', { class: 'field-label', for: 'dia-nota' }, 'Nota'),
        Object.assign(note, { id: 'dia-nota' }),
        h('div', { class: 'two' },
          ...MEALS.map((meal) => h('div', {},
            h('label', { class: 'field-label', for: `dia-${meal}` }, `${MEAL_EMOJI[meal]} Comensales en ${MEAL_LABEL[meal].toLowerCase()}`),
            Object.assign(diners[meal], { id: `dia-${meal}` }))),
        ),
        h('div', { class: 'buttons' },
          h('button', { class: 'btn text', type: 'button', onclick: () => ctx.close() }, 'Cancelar'),
          h('button', { class: 'btn', type: 'submit' }, 'Guardar'),
        ),
      ),
      { sheet: true },
    );
  }

  /* ----- Mover o copiar ----- */
  function openMoveDialog(date, meal, id, copy) {
    const week = weekDays(ctx.ui.weekStart);
    const daySel = h('select', { class: 'field', name: 'destino-dia', 'aria-label': 'Día de destino' },
      week.map((d) => h('option', { value: d, selected: d === date ? true : null }, dayLabel(d))));
    let toMeal = meal === 'lunch' ? 'dinner' : 'lunch';
    const go = (e) => {
      e.preventDefault();
      const prev = ctx.state();
      const next = moveDish(prev, { date, meal }, { date: daySel.value, meal: toMeal }, id, { copy });
      ctx.close();
      if (next === prev) return toast('No hay nada que cambiar.');
      ctx.setFocus(`add:${daySel.value}:${toMeal}`);
      ctx.commit(next);
      toast(`${copy ? 'Copiado' : 'Movido'}: ${prev.dishes[id].name}`, { label: 'Deshacer', onClick: () => ctx.commit(prev) });
    };
    openDialog(
      h('form', { class: 'dlg', onsubmit: go },
        dialogHead(copy ? 'Copiar a otro hueco' : 'Mover a otro hueco', `${ctx.state().dishes[id].name} · ahora en ${MEAL_LABEL[meal].toLowerCase()} del ${dayLabel(date).toLowerCase()}`),
        h('label', { class: 'field-label', for: 'mv-dia' }, 'Día'),
        Object.assign(daySel, { id: 'mv-dia' }),
        ctx.segmented('Comida de destino', MEALS.map((m) => [m, `${MEAL_EMOJI[m]} ${MEAL_LABEL[m]}`]), toMeal, (v) => { toMeal = v; }),
        h('div', { class: 'buttons' },
          h('button', { class: 'btn text', type: 'button', onclick: () => ctx.close() }, 'Cancelar'),
          h('button', { class: 'btn', type: 'submit' }, copy ? 'Copiar' : 'Mover'),
        ),
      ),
      { sheet: true },
    );
  }

  /* ----- Menú de un plato dentro del día ----- */
  function openItemMenu(date, meal, id) {
    const dish = ctx.state().dishes[id];
    if (!dish) return;
    const row = (ico, label, onclick, cls = 'tonal') => h('button', { class: `btn ${cls} wide`, type: 'button', onclick }, ico && icon(ico), label);
    openDialog(
      h('div', { class: 'dlg' },
        dialogHead(dish.name, `${MEAL_LABEL[meal]} del ${dayLabel(date).toLowerCase()}`),
        h('div', { class: 'menu-list' },
          row('move', 'Mover a otro hueco', () => openMoveDialog(date, meal, id, false)),
          row('copy', 'Copiar a otro hueco', () => openMoveDialog(date, meal, id, true)),
          row('edit', 'Ver o editar el plato', () => ctx.openDishEditor(id)),
          row('trash', 'Quitar de aquí', () => {
            const prev = ctx.state();
            ctx.close();
            ctx.setFocus(`add:${date}:${meal}`);
            ctx.commit(removeFromSlot(prev, date, meal, id));
            toast(`Quitado: ${dish.name}`, { label: 'Deshacer', onClick: () => ctx.commit(prev) });
          }, 'danger'),
        ),
      ),
      { sheet: true },
    );
  }

  /* ----- Arrastrar y soltar (ratón/lápiz; en táctil queda el menú del plato) ----- */
  function dragSource(handle, host, date, meal, id) {
    handle.draggable = true; // el botón es el asa (un <li> con botones dentro no inicia el arrastre)
    handle.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ date, meal, id }));
      e.dataTransfer.effectAllowed = 'copyMove';
      host.classList.add('dragging');
    });
    handle.addEventListener('dragend', () => host.classList.remove('dragging'));
  }
  function dropTarget(el, date, meal) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.altKey || e.ctrlKey ? 'copy' : 'move'; el.classList.add('drop-target'); });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-target'); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      let from;
      try { from = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
      const prev = ctx.state();
      if (!from?.id || !prev.dishes[from.id]) return;
      const copy = e.altKey || e.ctrlKey;
      const next = moveDish(prev, { date: from.date, meal: from.meal }, { date, meal }, from.id, { copy });
      if (next === prev) return;
      ctx.setFocus(`add:${date}:${meal}`);
      ctx.commit(next);
      toast(`${copy ? 'Copiado' : 'Movido'}: ${prev.dishes[from.id].name}`, { label: 'Deshacer', onClick: () => ctx.commit(prev) });
    });
  }

  /* ----- Plantillas ----- */
  function openTemplates() {
    const name = h('input', { class: 'field', type: 'text', name: 'plantilla', maxlength: '40', autocomplete: 'off', 'aria-label': 'Nombre de la plantilla', placeholder: 'Nombre: semana de cole, verano…' });
    const list = h('div', { class: 'list' });
    const fill = () => {
      const templates = Object.values(ctx.state().templates);
      list.replaceChildren(...(templates.length ? templates.map((t) => h('div', { class: 'row' },
        h('span', { class: 'grow' }, h('span', { class: 'name' }, t.name), h('span', { class: 'meta' }, `${Object.keys(t.slots).length} días con comidas`)),
        h('span', { class: 'tools' },
          h('button', { class: 'btn tonal small', type: 'button', onclick: () => apply(t) }, 'Aplicar'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Eliminar la plantilla ${t.name}`, onclick: () => remove(t) }, icon('trash')),
        ),
      )) : [h('div', { class: 'empty' }, illustration('pot'), 'Aún no tienes plantillas. Planifica una semana y guárdala para repetirla.')]));
    };
    const apply = (t) => {
      const prev = ctx.state();
      const { state: next, copied } = applyTemplate(prev, t.id, ctx.ui.weekStart);
      ctx.close();
      if (!copied) return toast('No hay huecos libres donde aplicarla.');
      ctx.commit(next);
      toast(`Plantilla «${t.name}» aplicada en ${copied} ${copied === 1 ? 'comida' : 'comidas'}`, { label: 'Deshacer', onClick: () => ctx.commit(prev) });
    };
    const remove = (t) => {
      const prev = ctx.state();
      ctx.commit(deleteTemplate(prev, t.id));
      fill();
      toast(`Plantilla eliminada: ${t.name}`, { label: 'Deshacer', onClick: () => { ctx.commit(prev); } });
    };
    const save = (e) => {
      e.preventDefault();
      const { state: next, id } = saveTemplate(ctx.state(), name.value, ctx.ui.weekStart);
      if (!id) return toast(name.value.trim() ? 'Esta semana está vacía: planifica algo antes de guardarla.' : 'Escribe un nombre para la plantilla.', { error: true });
      ctx.commit(next);
      name.value = '';
      fill();
      toast('Plantilla guardada');
    };
    fill();
    openDialog(
      h('form', { class: 'dlg', onsubmit: save },
        dialogHead('Plantillas de semana', 'Guarda la semana visible y aplícala en otra: solo rellena los huecos libres y respeta los días fuera de casa.'),
        h('div', { class: 'ai-key' }, name, h('button', { class: 'btn tonal', type: 'submit' }, 'Guardar esta semana')),
        list,
      ),
      { sheet: true },
    );
  }

  /* ----- Vista de mes ----- */
  function openMonth() {
    const start = parseISO(ctx.ui.weekStart);
    let cur = { year: start.getFullYear(), month: start.getMonth() };
    const body = h('div', {});
    const title = h('h2', { id: 'dlg-title', 'aria-live': 'polite' });
    const shift = (n) => { const d = new Date(cur.year, cur.month + n, 1); cur = { year: d.getFullYear(), month: d.getMonth() }; draw(); };

    function draw() {
      const st = ctx.state();
      const today = todayISO();
      title.textContent = `${MONTH_NAMES[cur.month][0].toUpperCase()}${MONTH_NAMES[cur.month].slice(1)} ${cur.year}`;
      const rows = monthMatrix(cur.year, cur.month);
      body.replaceChildren(h('table', { class: 'month' },
        h('caption', { class: 'sr-only' }, title.textContent),
        h('thead', {}, h('tr', {}, ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => h('th', { scope: 'col', 'aria-label': ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][i] }, d)))),
        h('tbody', {}, rows.map((week) => h('tr', {}, week.map((date) => {
          const inMonth = parseISO(date).getMonth() === cur.month;
          const meta = st.days[date] ?? {};
          const planned = MEALS.filter((m) => slotIds(st, date, m).some((id) => st.dishes[id]));
          const label = `${dayLabel(date)}${planned.length ? `: ${planned.map((m) => MEAL_LABEL[m].toLowerCase()).join(' y ')} planificad${planned.length > 1 ? 'os' : 'o'}` : ': sin planificar'}${meta.off ? `, ${OFF_LABEL[meta.off].toLowerCase()}` : ''}${meta.note ? `. Nota: ${meta.note}` : ''}`;
          return h('td', { class: inMonth ? '' : 'out' },
            h('button', { class: `mday${date === today ? ' today' : ''}${meta.off ? ' off' : ''}`, type: 'button', 'aria-label': label, 'aria-current': date === today ? 'date' : null, onclick: () => { ctx.close(); ctx.goToDate(date); } },
              h('span', { class: 'n' }, String(parseISO(date).getDate())),
              h('span', { class: 'dots', 'aria-hidden': 'true' }, meta.off ? '🚫' : planned.map((m) => MEAL_EMOJI[m]).join('')),
            ));
        })))),
      ));
    }
    draw();
    openDialog(
      h('div', { class: 'dlg' },
        h('div', { class: 'dlg-head' },
          h('div', { class: 'month-nav' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes anterior', onclick: () => shift(-1) }, icon('chevL')),
            title,
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes siguiente', onclick: () => shift(1) }, icon('chevR')),
          ),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: () => ctx.close() }, icon('close')),
        ),
        h('p', { class: 'sub' }, 'Toca un día para abrir su semana. ☀️ almuerzo y 🌙 cena planificados.'),
        body,
      ),
      { sheet: true },
    );
  }

  /* ----- Equilibrio de la semana ----- */
  function balanceStrip() {
    const st = ctx.state();
    const rules = ruleStatus(st, ctx.ui.weekStart);
    const counts = weekTagCounts(st, ctx.ui.weekStart);
    const ruled = new Set(rules.map((r) => r.tag));
    const free = Object.entries(counts).filter(([tag]) => !ruled.has(tag) && tag !== 'domingo');
    if (!rules.length && !free.length) return null;
    const STATUS = { ok: '✓ bien', low: '↓ faltan', high: '↑ te pasas' };
    return h('section', { class: 'balance', 'aria-label': 'Equilibrio de la semana' },
      h('p', { class: 'kicker' }, '⚖️ Equilibrio de la semana'),
      h('ul', { class: 'chips' },
        rules.map((r) => h('li', { class: `chip ${r.status}` },
          `${TAGS[r.tag].emoji} ${TAGS[r.tag].label} ${r.count}${r.min && r.max ? ` (${r.min}-${r.max})` : r.min ? ` (mín. ${r.min})` : ` (máx. ${r.max})`} · ${STATUS[r.status]}`)),
        free.map(([tag, n]) => h('li', { class: 'chip' }, `${TAGS[tag].emoji} ${TAGS[tag].label} ${n}`)),
      ),
    );
  }

  return { openDayEditor, openItemMenu, openTemplates, openMonth, balanceStrip, dragSource, dropTarget };
}
