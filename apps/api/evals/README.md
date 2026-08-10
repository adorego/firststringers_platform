# Jerry evals

Suite de evaluación del agente Jerry, siguiendo la guía de Anthropic
([Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents))
y el flujo de eval engineering de LangChain
([Towards automating eval engineering](https://www.langchain.com/blog/towards-automating-eval-engineering)).

## Filosofía (v1)

- **Empezar pequeño y code-graded.** ~45 casos con graders de código (baratos,
  deterministas, sin calibración). Los LLM-judges llegan en v2, cuando haya
  transcripciones reales para calibrarlos contra criterio humano.
- **Casos no ambiguos.** Cada caso debería producir el mismo veredicto en dos
  revisores humanos independientes. Donde dos intents son legítimamente
  válidos, `expected` acepta ambos — evita que el eval castigue respuestas
  razonables.
- **Grade the output, not the path.** Se evalúa lo que Jerry produce
  (clasificación, campos extraídos, invariantes de la respuesta), no la
  secuencia interna.
- **Cobertura balanceada.** Casos positivos y negativos (p. ej. "not in the
  transfer portal" debe extraer `transferPortal: false`, no omitirlo).
- **El piloto manda.** El dataset incluye béisbol/catcher porque el atleta
  piloto real es un catcher de Miami — los evals cubren primero lo que la
  demo necesita.

## Suites

| Suite | Qué mide | Grader | Umbral |
|---|---|---|---|
| `intents` | Clasificación de mensajes en la taxonomía de 9 intents | igualdad contra lista aceptada | 85 % |
| `extraction` | Extracción de campos del dossier por intent | presencia / igualdad / contains sobre paths | 80 % |
| `invariants` | Reglas que Jerry nunca debe romper: termina con pregunta (lidera la conversación), responde en inglés, no filtra IDs internos (`FS-CS-*`), no promete resultados, longitud acotada | checks de código sobre la respuesta post-procesada | 90 % |

## Correr

```bash
# Desde apps/api — usa OPENAI_API_KEY de .env. Llama a la API real: cuesta dinero.
pnpm eval:jerry
pnpm eval:jerry -- --suite=intents
pnpm eval:jerry -- --suite=intents,extraction --limit=10
```

Sale con código 1 si alguna suite queda bajo su umbral. El reporte JSON queda
en `evals/reports/` (gitignored).

## Cómo agregar casos

1. Los mejores casos vienen de fallas reales: si Jerry clasifica o extrae mal
   algo en una conversación, conviértelo en una línea del JSONL antes de
   arreglarlo (mismo espíritu que un test de regresión).
2. `jerry-intents.jsonl`: `{"id", "message", "expected": [intents aceptados]}`.
3. `jerry-extraction.jsonl`: `{"id", "intent", "message", "expect": [{path, present|equals|contains}]}`.
4. Manten el caso no ambiguo; si dudas entre dos intents, acepta ambos.

## Roadmap (v2+)

- **Trace mining**: cuando el LLM gateway de Fase 1 registre transcripciones y
  `usage`, minar producción para generar casos (loop de LangChain:
  *mine traces → identify failure → build eval → improve agent → rerun*).
- **LLM-as-judge calibrado** para calidad conversacional (tono de
  representante, no inventa datos) — calibrado contra etiquetas humanas antes
  de confiar en él.
- **pass^k** sobre los invariantes (confiabilidad, no solo capacidad): el
  invariante debe cumplirse en k corridas seguidas.
- **Graduación**: cuando una suite sature en ~100 %, pasa a regresión y se
  agregan capacidades nuevas (multi-turno, extracción cruzada, Owner's
  Manual).
- **Evals de Billy**: mismos patrones para la conversación de búsqueda y los
  criterios generados (bloqueado por la migración a structured outputs — hoy
  el parseo por regex hace que el eval mida el parser, no el modelo).
