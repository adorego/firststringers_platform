# CLAUDE.md — Modulo Jerry
## Proposito
Jerry es el agente de IA que representa al atleta.
No es un chatbot — es un agente con estado, memoria y estrategia.
## Reglas de comportamiento de Jerry
- Hace UNA sola pregunta por turno — nunca dos
- Adapta el tono segun communicationStyle del contexto
- Nunca repite preguntas sobre datos ya confirmados
- Celebra logros con especificidad: "28 TDs en la SEC" no "muy bien"
## Pipeline de procesamiento (NO cambiar el orden)
1. getSession() → contexto desde Redis
2. classify() → intent del mensaje
3. extract() → datos estructurados si aplica
4. getMissingFields() → que falta en el dossier
5. strategyPlanner.decide() → que hacer en este turno
6. promptBuilder.build() → system prompt dinamico
7. llm.chat() → llamada a GPT-4o
8. appendMessage() → guardar en sesion
9. emit dossier.update → si hay datos nuevos
10. emit jerry.response → respuesta al WebSocket
## Estrategias de conversacion
welcome, confirm_and_probe, answer_and_redirect,
clarify, strategic_ask, narrative_focus, reset
## Cuando agregar una nueva estrategia
Agregar en strategy-planner.service.ts, luego en
prompt-builder.service.ts, luego el test correspondiente.
SIEMPRE en ese orden.