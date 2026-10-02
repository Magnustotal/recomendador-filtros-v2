import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { MAX_BODY_BYTES, UPSTREAM, apiKey, handle, sanitizeBody } from '../netlify/functions/lib/gemini-proxy.mjs';
import fn, { config } from '../netlify/functions/gemini.mjs';

const SITE = 'https://mi-sitio.netlify.app';
const SECRET = 'AQ.clave-secreta-de-prueba-123456789';
const good = { model: 'gemini-3.1-flash-lite', input: [{ type: 'text', text: 'hola' }] };
const post = (body, headers = {}, url = `${SITE}/api/gemini`) => new Request(url, {
  method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const upstream = (...responses) => {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  f.calls = calls;
  return f;
};
const env = { GEMINI_API_KEY: SECRET };
const ok = { body: { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'OK' }] }] } };

test('GET devuelve el estado sin exponer secretos', async () => {
  const res = await handle(new Request(`${SITE}/api/gemini`), { env });
  assert.deepEqual(await res.json(), { configured: true, accessCode: false });
  const none = await (await handle(new Request(`${SITE}/api/gemini`), { env: {} })).json();
  assert.deepEqual(none, { configured: false, accessCode: false });
  const coded = await (await handle(new Request(`${SITE}/api/gemini`), { env: { ...env, ACCESS_CODE: 'abc' } })).text();
  assert.ok(!coded.includes(SECRET) && !coded.includes('abc'));
});

test('lee la clave de GEMINI_API_KEY o, si no, de las variables habituales de Google', () => {
  assert.equal(apiKey({ GEMINI_API_KEY: ' k1 ' }), 'k1');
  assert.equal(apiKey({ GOOGLE_API_KEY: 'k2' }), 'k2');
  assert.equal(apiKey({ GOOGLE_GENERATIVE_AI_API_KEY: 'k3' }), 'k3');
  assert.equal(apiKey({ GEMINI_API_KEY: '  ' }), '');
});

test('POST reenvía a Interactions con la clave del servidor y devuelve la respuesta', async () => {
  const up = upstream(ok);
  const res = await handle(post({ ...good, response_format: { type: 'text', mime_type: 'application/json', schema: { type: 'object' } } }), { env, fetchImpl: up });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).steps[0].content[0].text, 'OK');
  assert.equal(up.calls[0].url, UPSTREAM);
  assert.equal(up.calls[0].init.headers['x-goog-api-key'], SECRET);
  assert.deepEqual(up.calls[0].body.input, good.input);
  assert.equal(up.calls[0].body.response_format.mime_type, 'application/json');
});

test('exige mismo origen: sin Origin o con otro Origin es 403 y no llama a Google', async () => {
  const up = upstream(ok);
  const noOrigin = new Request(`${SITE}/api/gemini`, { method: 'POST', body: JSON.stringify(good) });
  assert.equal((await handle(noOrigin, { env, fetchImpl: up })).status, 403);
  assert.equal((await handle(post(good, { origin: 'https://otro-sitio.com' }), { env, fetchImpl: up })).status, 403);
  assert.equal(up.calls.length, 0);
});

test('código de acceso opcional: ausente, incorrecto y correcto', async () => {
  const withCode = { ...env, ACCESS_CODE: 'familia-2026' };
  const up = upstream(ok);
  const missing = await handle(post(good), { env: withCode, fetchImpl: up });
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).error.code, 'code_required');
  const bad = await handle(post(good, { 'x-access-code': 'familia-2027' }), { env: withCode, fetchImpl: up });
  assert.equal((await bad.json()).error.code, 'bad_code');
  assert.equal(up.calls.length, 0);
  const right = await handle(post(good, { 'x-access-code': 'familia-2026' }), { env: withCode, fetchImpl: up });
  assert.equal(right.status, 200);
  assert.equal((await handle(post(good), { env, fetchImpl: upstream(ok) })).status, 200, 'sin ACCESS_CODE no se pide');
});

test('sin clave configurada responde 503 not_configured y lo dice en claro', async () => {
  const res = await handle(post(good), { env: {}, fetchImpl: upstream() });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error.code, 'not_configured');
  assert.match(body.error.message, /GEMINI_API_KEY/);
});

test('sanitizeBody: acepta lo que envía la app y rechaza cualquier extra', () => {
  assert.ok(sanitizeBody(good).body);
  assert.ok(sanitizeBody({ model: 'gemini-3.8-flash', input: 'hola' }).body, 'input como texto');
  const img = { type: 'image', data: 'QUJD', mime_type: 'image/jpeg' };
  assert.equal(sanitizeBody({ ...good, input: [...good.input, img] }).body.input.length, 2);
  for (const bad of [
    { ...good, tools: [{ type: 'google_search' }] }, { ...good, stream: true }, { ...good, system_instruction: 'x' },
    { model: 'gpt-4', input: 'x' }, { model: 'gemini-../../x', input: 'x' }, { model: 'gemini-3.8-flash' },
    { ...good, input: [] }, { ...good, input: Array.from({ length: 9 }, () => ({ type: 'text', text: 'x' })) },
    { ...good, input: [{ type: 'image', data: 'QUJD', mime_type: 'image/svg+xml' }] },
    { ...good, input: [{ type: 'image', data: '<script>', mime_type: 'image/png' }] },
    { ...good, input: [{ type: 'file', uri: 'https://x' }] },
    { ...good, response_format: { type: 'text', mime_type: 'text/html', schema: {} } },
    { ...good, response_format: { type: 'text', mime_type: 'application/json', schema: { x: 'y'.repeat(30_000) } } },
    null, [], 'texto',
  ]) assert.ok(sanitizeBody(bad).error, JSON.stringify(bad).slice(0, 60));
});

test('un cuerpo con campos de más no llega a Google', async () => {
  const up = upstream(ok);
  const res = await handle(post({ ...good, tools: [{ type: 'code_execution' }] }), { env, fetchImpl: up });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'bad_request');
  assert.equal(up.calls.length, 0);
  assert.equal((await handle(post('{no es json'), { env, fetchImpl: up })).status, 400);
});

test('rechaza peticiones demasiado grandes sin leerlas', async () => {
  const up = upstream(ok);
  const big = post(good, { 'content-length': String(MAX_BODY_BYTES + 1) });
  assert.equal((await handle(big, { env, fetchImpl: up })).status, 413);
  assert.equal(up.calls.length, 0);
});

test('errores de Gemini: conserva el estado (para que la app reintente o cambie de modelo) y recorta el mensaje', async () => {
  for (const status of [400, 403, 404, 429, 503]) {
    const res = await handle(post(good), { env, fetchImpl: upstream({ status, body: { error: { message: 'detalle '.repeat(100) } } }) });
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.error.code, 'upstream');
    assert.ok(body.error.message.length <= 300);
  }
});

test('red caída y tiempo agotado se traducen a 502 y 504', async () => {
  assert.equal((await handle(post(good), { env, fetchImpl: upstream(new TypeError('fetch failed')) })).status, 502);
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
  assert.equal((await handle(post(good), { env, fetchImpl: upstream(abort) })).status, 504);
});

test('la clave nunca aparece en ninguna respuesta, ni de éxito ni de error', async () => {
  const cases = [
    handle(post(good), { env, fetchImpl: upstream(ok) }),
    handle(post(good), { env, fetchImpl: upstream({ status: 403, body: { error: { message: 'API key not valid' } } }) }),
    handle(post(good), { env, fetchImpl: upstream(new TypeError('boom')) }),
    handle(post({ ...good, extra: 1 }), { env }),
    handle(post(good, { origin: 'https://x.com' }), { env }),
    handle(new Request(`${SITE}/api/gemini`, { method: 'DELETE' }), { env }),
  ];
  for (const r of await Promise.all(cases)) assert.ok(!(await r.text()).includes(SECRET));
});

test('métodos no permitidos: 405', async () => {
  assert.equal((await handle(new Request(`${SITE}/api/gemini`, { method: 'PUT', headers: { origin: SITE } }), { env })).status, 405);
});

test('la función exporta la ruta /api/gemini y un límite de peticiones; el handler delega en handle()', async () => {
  assert.equal(config.path, '/api/gemini');
  assert.ok(config.rateLimit.windowLimit > 0 && config.rateLimit.windowSize > 0 && config.rateLimit.windowSize <= 180);
  const res = await fn(new Request(`${SITE}/api/gemini`));
  assert.equal(res.status, 200);
});

test('netlify.toml publica public/ y declara el directorio de funciones, fuera de lo publicado', () => {
  const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.match(toml, /publish\s*=\s*"public"/);
  assert.match(toml, /directory\s*=\s*"netlify\/functions"/);
  assert.ok(existsSync(new URL('../netlify/functions/gemini.mjs', import.meta.url)));
  assert.ok(!existsSync(new URL('../public/netlify', import.meta.url)), 'las funciones no deben publicarse como estáticos');
});
