// Utilidades de DOM sin dependencias: siempre texto plano, nunca HTML.
import { ICON_DEFS } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';

export function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  for (const [tag, attrs] of ICON_DEFS[name]) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

function append(el, kid) {
  if (kid == null || kid === false) return;
  if (Array.isArray(kid)) kid.forEach((k) => append(el, k));
  else el.append(kid instanceof Node ? kid : String(kid));
}

/** h('button', { class: 'btn', onclick }, 'texto', hijo…) — siempre texto plano, nunca HTML. */
export function h(tag, props = {}, ...kids) {
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

export const $ = (sel) => document.querySelector(sel);
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Ilustraciones propias (dibujadas para esta app, sin licencias de terceros) para los estados vacíos.
const ART = {
  pot: [['path', 'steam', 'M60 30c-6-6 6-10 0-18M80 32c-6-6 6-10 0-18M100 30c-6-6 6-10 0-18'], ['rect', 'lid', { x: 44, y: 38, width: 72, height: 10, rx: 5 }], ['rect', 'lid', { x: 73, y: 31, width: 14, height: 8, rx: 3 }], ['path', 'body', 'M40 52h80v32a18 18 0 0 1-18 18H58a18 18 0 0 1-18-18z'], ['path', 'line', 'M40 62h-10a6 6 0 0 0 0 12h10M120 62h10a6 6 0 0 1 0 12h-10M40 72h80']],
  plate: [['circle', 'body', { cx: 80, cy: 62, r: 38 }], ['circle', 'inner', { cx: 80, cy: 62, r: 25 }], ['path', 'line', 'M20 30v16a6 6 0 0 0 12 0V30M26 30v66M138 30c-9 6-11 22-7 36h7zM138 66v30']],
  chart: [['rect', 'body', { x: 30, y: 62, width: 20, height: 38, rx: 4 }], ['rect', 'inner', { x: 60, y: 44, width: 20, height: 56, rx: 4 }], ['rect', 'body', { x: 90, y: 74, width: 20, height: 26, rx: 4 }], ['path', 'line', 'M20 100h120M126 100V66'], ['path', 'leaf', 'M126 78c-14 0-18-10-18-18 12 0 18 6 18 18zM126 72c12 0 16-8 16-16-10 0-16 6-16 16z']],
};

export function illustration(kind) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 160 120');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('art');
  for (const [tag, cls, attrs] of ART[kind]) {
    const el = document.createElementNS(NS, tag);
    el.setAttribute('class', `art-${cls}`);
    if (typeof attrs === 'string') el.setAttribute('d', attrs);
    else for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.append(el);
  }
  return svg;
}
