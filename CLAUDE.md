# Instrucciones del proyecto

## Modo de respuesta

Activa la skill `caveman` en nivel **lite** al inicio de cada sesión y mantenla en
todas las respuestas: sin relleno ni titubeos, con frases completas. Responde en
el idioma del usuario. Solo se desactiva con "stop caveman" o "normal mode".
Código, commits y PRs en modo normal.

## Carpetas

- `app/`, `lib/`, `types/`: recomendador de filtros (Next.js + MUI).
- `menu-semanal/`: PWA estática de menú semanal (sin build). Ver su `README.md`.
  Tests: `cd menu-semanal && npm test`. Zip para Netlify Drop: `npm run zip`.
