// Proxy mínimo hacia la API Interactions de Gemini. La clave vive solo en una variable de entorno
// de Netlify (nunca llega al navegador). Solo reenvía el cuerpo que usa la app, validado campo a campo.
// Sin dependencias: `handle` recibe la Request estándar y devuelve una Response, y se prueba con `node --test`.
import { createHash, timingSafeEqual } from 'node:crypto';

export const UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const KEY_NAMES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'];
export const MAX_BODY_BYTES = 5 * 1024 * 1024; // el límite de Netlify es 6 MB
export const UPSTREAM_TIMEOUT_MS = 55_000; // el de Netlify es 60 s: respondemos nosotros antes con un error claro

const MODEL_RE = /^gemini-[a-z0-9][a-z0-9.-]{1,60}$/;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const fail = (status, code, message) => json(status, { error: { code, message } });

export function apiKey(env) {
  for (const name of KEY_NAMES) if (typeof env[name] === 'string' && env[name].trim()) return env[name].trim();
  return '';
}

const digest = (s) => createHash('sha256').update(String(s)).digest();
const sameSecret = (a, b) => timingSafeEqual(digest(a), digest(b));

/** Valida el cuerpo y devuelve solo los campos permitidos (sin herramientas, streaming ni otros extras). */
export function sanitizeBody(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'El cuerpo debe ser un objeto JSON.' };
  const extra = Object.keys(raw).filter((k) => !['model', 'input', 'response_format'].includes(k));
  if (extra.length) return { error: `Campos no permitidos: ${extra.slice(0, 3).join(', ')}.` };
  if (typeof raw.model !== 'string' || !MODEL_RE.test(raw.model)) return { error: 'Modelo no válido.' };

  const parts = typeof raw.input === 'string' ? [{ type: 'text', text: raw.input }] : raw.input;
  if (!Array.isArray(parts) || !parts.length || parts.length > 8) return { error: 'Entrada no válida.' };
  const input = [];
  for (const p of parts) {
    if (p?.type === 'text' && typeof p.text === 'string' && p.text.length <= 80_000) input.push({ type: 'text', text: p.text });
    else if (p?.type === 'image' && IMAGE_TYPES.has(p.mime_type) && typeof p.data === 'string' && BASE64_RE.test(p.data)) input.push({ type: 'image', data: p.data, mime_type: p.mime_type });
    else return { error: 'Parte de la entrada no válida.' };
  }

  const body = { model: raw.model, input };
  if (raw.response_format !== undefined) {
    const f = raw.response_format;
    if (!f || f.type !== 'text' || f.mime_type !== 'application/json' || typeof f.schema !== 'object' || JSON.stringify(f.schema).length > 20_000) return { error: 'Formato de respuesta no válido.' };
    body.response_format = { type: 'text', mime_type: 'application/json', schema: f.schema };
  }
  return { body };
}

/**
 * GET  → estado (sin secretos): { configured, accessCode }
 * POST → reenvía a Gemini. Exige mismo origen y, si existe ACCESS_CODE, la cabecera x-access-code.
 */
export async function handle(req, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const key = apiKey(env);
  const needsCode = Boolean(env.ACCESS_CODE);

  if (req.method === 'GET') return json(200, { configured: Boolean(key), accessCode: needsCode });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Método no permitido.');

  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) return fail(403, 'forbidden_origin', 'Origen no permitido.');

  if (needsCode) {
    const given = req.headers.get('x-access-code') ?? '';
    if (!given) return fail(401, 'code_required', 'Falta el código de acceso.');
    if (!sameSecret(given, env.ACCESS_CODE)) return fail(401, 'bad_code', 'Código de acceso incorrecto.');
  }
  if (!key) return fail(503, 'not_configured', 'Falta la variable GEMINI_API_KEY en Netlify.');

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fail(413, 'too_large', 'La petición es demasiado grande.');
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'La petición es demasiado grande.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { return fail(400, 'bad_request', 'JSON no válido.'); }
  const { body, error } = sanitizeBody(parsed);
  if (error) return fail(400, 'bad_request', error);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(UPSTREAM, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    return err?.name === 'AbortError'
      ? fail(504, 'upstream_timeout', 'Gemini tardó demasiado en responder.')
      : fail(502, 'upstream_unreachable', 'No se pudo contactar con Gemini.');
  } finally {
    clearTimeout(timer);
  }

  const out = await res.text();
  if (res.ok) return new Response(out, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  let message = '';
  try { message = String(JSON.parse(out)?.error?.message ?? '').slice(0, 300); } catch { /* sin cuerpo JSON */ }
  return json(res.status, { error: { code: 'upstream', message } });
}
