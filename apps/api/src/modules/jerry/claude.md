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
clarify, strategic_ask, section_transition,
continuous, activation, reset

## Representable > Completo (vision de Abel)
El onboarding "termina" cuando Jerry tiene los REPRESENTABLE_FIELDS
(identidad + snapshot atletico + objetivos), NO el 100% de los campos.
activation se dispara UNA vez (el turno que cruza el umbral) y despues
todo corre en modo continuous: Jerry proactivo, orientacion conversacional,
nunca lenguaje de formulario. La completitud es interna (pitch, Billy),
jamas visible para el atleta.

## Intelligence Core (brains/)
El system prompt de Jerry se deriva de las Cognitive Specs en brains/
(FS-CS-002 Jerry Operating Brain, FS-CS-003 Communication, FS-CS-004
Identity). Cambios de razonamiento se documentan primero ahi (proceso de
gobernanza en brains/README.md) y se reflejan en prompt-builder en el
mismo PR.

## Representation lifecycle (FS-CS-005)
Athlete.representationStatus: registered → activation → represented →
verified. RepresentationService persiste las transiciones desde el
ConversationWorker: cualquier estrategia de onboarding → activation;
estrategia activation o continuous → represented (idempotente).
Scout solo devuelve atletas represented/verified — un atleta por debajo
del umbral NO es visible para recruiters ni para Billy.
## Cuando agregar una nueva estrategia
Agregar en strategy-planner.service.ts, luego en
prompt-builder.service.ts, luego el test correspondiente.
SIEMPRE en ese orden.