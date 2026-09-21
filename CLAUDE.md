# CLAUDE.md

## Uso de skills

Claude puede invocar cualquiera de las skills disponibles (las de `.claude/skills/`
en este repo y las skills globales de la cuenta) por iniciativa propia, cuando
considere que son útiles para la tarea en curso, sin esperar a que el usuario las
pida o las nombre explícitamente.

Excepción — `ai-team` (delega subtareas a Gemini vía API): también se puede usar
por iniciativa propia, pero cada vez que se use hay que avisar al usuario en el
momento — qué se le consultó a Gemini y por qué — nunca en silencio, porque
consume una cuota gratuita diaria limitada. El resto de skills no tiene esta
restricción de aviso.
