# Preferencias globales

Estas reglas aplican a todos los proyectos salvo que el CLAUDE.md del proyecto diga otra cosa.

## Stack por defecto

Para aplicaciones nuevas, salvo indicación contraria:

- Next.js (App Router) + React + TypeScript en modo `strict`
- Material Design 3 / M3 Expressive como sistema de diseño, implementado con Material UI (MUI)
- PWA: manifest, service worker y funcionamiento offline cuando tenga sentido
- Despliegue en Vercel
- IA integrada con el AI SDK de Vercel

Si el proyecto ya usa otro stack (por ejemplo shadcn/ui o Tailwind), respeta el existente y no migres sin preguntar.

## Orden de consulta para diseño e interfaces

Cuando diseñes o desarrolles una interfaz, consulta en este orden y usa la primera fuente que resuelva la duda:

1. Material Design 3 — https://m3.material.io/
2. Material Theme Builder — https://material-foundation.github.io/material-theme-builder/
3. Material UI — https://mui.com/
4. Magic UI — https://magicui.design/
5. shadcn/ui — https://ui.shadcn.com/
6. 21st.dev — https://21st.dev/
7. VengenceUI — https://www.vengenceui.com/
8. AnimMasterLib — https://animmasterlib.dev/

Documentación de referencia: https://react.dev/, https://nextjs.org/docs, https://web.dev/explore/progressive-web-apps, https://developer.mozilla.org/docs/Web/Progressive_web_apps, https://developer.chrome.com/docs/capabilities

Verifica APIs y props contra la documentación oficial de la versión instalada antes de usarlas; no las supongas de memoria.

## Estándares de calidad

- **Accesibilidad:** WCAG 2.2 nivel AA. Contraste mínimo 4.5:1 en texto, navegación completa por teclado, foco visible, etiquetas en controles, `prefers-reduced-motion` respetado.
- **Rendimiento (Core Web Vitals):** LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Imágenes optimizadas, carga diferida y evitar JavaScript innecesario en el cliente.
- **Responsive:** mobile-first, sin scroll horizontal, objetivos táctiles de al menos 48×48 dp.
- **Animaciones:** fluidas y con propósito; usa el sistema de motion de M3 y View Transitions cuando aplique.
- **Seguridad:** OWASP Top 10. Valida entradas en el servidor, no expongas secretos al cliente, cabeceras de seguridad y dependencias actualizadas.
- **Testing:** tests automatizados para lógica y flujos críticos; Playwright para pruebas end-to-end.
- **Código:** limpio, tipado y mantenible. Componentes pequeños, sin `any` salvo justificación.

## Skills a usar según la tarea

- Diseño con Material 3 → `material-design-3-ui`
- Criterios generales de UI/UX → `ui-ux-pro-max`, `frontend-ui-engineering`
- Revisión de accesibilidad y UX del código → `web-design-guidelines`
- React y Next.js → `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions`
- Comprobar cambios en una app Next.js en marcha → `next-dev-loop`
- Componentes shadcn/ui → `shadcn`
- Funciones de IA → `ai-sdk`
- PWA → `pwa-review`
- Rendimiento → `performance-optimization`
- Seguridad → `security-and-hardening`
- Tests → `test-driven-development`, `playwright-cli`
- Despliegue → `deploy-to-vercel` (pide confirmación antes de desplegar)
