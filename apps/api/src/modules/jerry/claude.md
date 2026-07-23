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
4. manualExtractor.extract() → señales de comprension (Owner's Manual)
5. getMissingFields() → que falta en el dossier
6. strategyPlanner.decide() → que hacer en este turno
7. representation transitions → activation / represented (FS-CS-005)
8. ownersManual.merge() + get() → persistir insights y cargar el manual
9. promptBuilder.build(strategy, manual) → system prompt dinamico
10. llm.chat() → llamada a GPT-4o
11. appendMessage() → guardar en sesion
12. emit dossier.update → si hay datos nuevos
13. emit jerry.response → respuesta al WebSocket
## Estrategias de conversacion
welcome, confirm_and_probe, answer_and_redirect,
clarify, strategic_ask, section_transition,
continuous, activation, reset

## Athlete Representation Activation Conversation (FS-CS-005A, Abel 2026-07)
Fuente: brains/FS-CS-005A-athlete-representation-activation-conversation.md.
- FIELD_PRIORITY sigue la conversacion FS-CS-005A: Athlete Identity →
  Athletic Foundation → Recruiting Direction → Academic & Personal
  Direction → Owner's Manual Initialization → Representation Assets.
- El full name NO se pregunta: viene del registro. welcome lleva
  targetField con la primera pregunta pendiente.
- Jerry no esta completando un perfil; esta activando representacion.
  Cada turno debe seguir el ritmo Question → Listen → Acknowledge →
  Reflect → Transition.
- Si el atleta no tiene metrics, footage, references o social accounts,
  Jerry tranquiliza, lo marca como prioridad futura y sigue. Eso no bloquea
  la representacion.
- SECTION_FIRST_FIELDS: school, competitive level goal, GPA,
  self-representation, highlights.

## Representable > Completo (vision de Abel)
El onboarding "termina" cuando Jerry tiene los REPRESENTABLE_FIELDS
(identidad + base atletica + direccion + academia + Owner's Manual inicial),
NO el 100% de los campos.
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

## Owner's Manual (FS-CS-002/005)
Tabla OwnersManual (data Json): la comprension INTERNA de Jerry sobre el
atleta — motivaciones, valores, aspiraciones, estilos de comunicacion/
aprendizaje, toma de decisiones, ambientes, sistema de apoyo. NO es el
dossier: el dossier es la capa compartible, el manual es solo de Jerry.
ManualExtractorService extrae señales en intents personal/character/
recruiting/availability/other; OwnersManualService hace merge (arrays =
union sin duplicados, textos = ultima comprension) y el manual entra al
system prompt para que Jerry adapte tono y consejo.
REGLA DE PRIVACIDAD: el manual JAMAS se expone a recruiters, Billy,
Scout ni endpoints — ningun controller/gateway debe incluirlo.
## Cuando agregar una nueva estrategia
Agregar en strategy-planner.service.ts, luego en
prompt-builder.service.ts, luego el test correspondiente.
SIEMPRE en ese orden.
