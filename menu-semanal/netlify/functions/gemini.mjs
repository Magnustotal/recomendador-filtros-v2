// Netlify Function (sintaxis v2): POST/GET /api/gemini. Toda la lógica está en lib/gemini-proxy.mjs.
import { handle } from './lib/gemini-proxy.mjs';

export default (req) => handle(req);

export const config = {
  path: '/api/gemini',
  // Protege tu cuota: 12 peticiones por minuto y por IP
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
