---
name: ai-team
description: Coordina el trabajo con otros modelos de IA (Gemini vía API gratuita) como apoyo de Claude en una tarea. Actívala cuando el usuario pida trabajar "en equipo" con Gemini o ChatGPT, pedir una segunda opinión a otra IA, dividir el trabajo entre varios modelos, o contrastar un plan/diseño con otro modelo.
argument-hint: "[consulta|segunda-opinion] <tarea>"
metadata:
  author: recomendador-filtros-v2
  version: "1.0.0"
---

# Equipo de IA (Claude + Gemini)

Reparte el trabajo de una tarea entre Claude (esta sesión, con acceso completo al
repositorio) y Gemini (API gratuita de Google), usados como un pequeño equipo en
vez de una sola IA trabajando sola.

## Por qué así, y no un chat a tres bandas

No es posible hacer que Claude, ChatGPT y Gemini "hablen entre sí" en tiempo real
como si fuera una conversación de grupo: aquí no hay acceso a las cuentas web
gratuitas de ChatGPT/Gemini (eso requeriría automatizar su sesión de navegador,
lo cual incumple sus términos de servicio), y esta sesión corre en un contenedor
remoto sin acceso al navegador del usuario. Lo que sí funciona de verdad es
delegar por **API**: Gemini tiene una capa gratuita real por API (a diferencia de
ChatGPT, cuya API es de pago). Por eso el reparto es Claude-lidera /
Gemini-colabora, no una charla simétrica entre iguales.

## Reparto de responsabilidades

**Claude (líder/orquestador, plan PRO)** se queda con todo lo que requiere el
contexto completo del proyecto o tocar el sistema real:
- Editar archivos, ejecutar comandos, tests, git, despliegues
- Decisiones de arquitectura y la integración final del resultado
- Cualquier tarea que dependa del estado actual del repo

**Gemini (colaborador vía API, gratis)** recibe subtareas de solo texto, bien
acotadas, que no necesitan tocar el repo:
- Segunda opinión sobre un plan, una decisión de diseño o un fragmento de código
- Generación de alternativas en paralelo (copys, nombres, enfoques de UX)
- Investigación o resumen rápido sobre una librería, patrón o API
- Detección de fallos obvios en un plan antes de implementarlo

Gemini nunca edita el repo ni ejecuta nada: solo opina, y Claude decide qué usar
de esa opinión y la integra.

## Antes de delegar: cuota gratuita

La capa gratuita de Gemini tiene límites diarios bajos (del orden de decenas a
cientos de peticiones/día según el modelo). No la uses para tareas triviales que
Claude ya resuelve solo; resérvala para cuando aporte una perspectiva realmente
distinta, y agrupa varias preguntas en una sola llamada cuando se pueda.

## Uso

```bash
# La clave se configura como variable de entorno, nunca se pega en el chat.
export GEMINI_API_KEY="tu-clave"   # gratis en https://aistudio.google.com/apikey

python3 .claude/skills/ai-team/scripts/ask_gemini.py "pregunta o tarea para Gemini"
# también acepta el prompt por stdin:
echo "revisa este plan: ..." | python3 .claude/skills/ai-team/scripts/ask_gemini.py
```

Variables opcionales:
- `GEMINI_MODEL` — modelo a usar (por defecto `gemini-3.8-flash`). Los nombres de
  modelo de Gemini cambian con frecuencia; si el script falla con 404, revisa el
  listado actual en https://ai.google.dev/gemini-api/docs/models y ajusta esta
  variable.
- `GEMINI_SYSTEM` — instrucción de sistema para darle a Gemini un rol concreto
  dentro del equipo (p. ej. "Eres el revisor de accesibilidad del equipo").

## Flujo típico

1. Claude analiza la tarea y decide qué parte, si alguna, conviene contrastar con
   Gemini (ver criterios de arriba).
2. Si hay algo que delegar, Claude llama a `ask_gemini.py` con un prompt
   autocontenido (Gemini no ve el resto de la conversación ni el repo, así que
   el prompt debe incluir todo el contexto necesario).
3. Claude evalúa la respuesta de Gemini, la contrasta con su propio criterio y
   decide qué incorporar.
4. Claude implementa el resultado final en el repo y se lo explica al usuario,
   dejando claro qué vino de Gemini y qué decidió Claude.

## Añadir ChatGPT más adelante

Ahora mismo solo Gemini está conectado, porque es la única clave disponible. La
API de OpenAI no tiene capa gratuita continua (a diferencia del ChatGPT web
gratuito), así que hace falta una clave de pago de platform.openai.com para
sumarlo. Cuando se disponga de ella, se añade un script equivalente
`ask_chatgpt.py` (mismo patrón que `ask_gemini.py`, contra
`https://api.openai.com/v1/chat/completions`) y se actualiza este reparto para
incluirlo.
