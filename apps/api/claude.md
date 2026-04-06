# CLAUDE.md — First Stringers API
## Proyecto
API de reclutamiento deportivo con IA. Jerry es el agente de IA
que conversa con atletas para construir su dossier de reclutamiento.
## Stack
- NestJS 11 con TypeScript strict
- PostgreSQL + Prisma ORM
- Redis + BullMQ para jobs asincronos
- OpenAI GPT-4o para LLM
- Socket.io para WebSocket (namespace /jerry)
## Arquitectura de Jerry
El pipeline de Jerry sigue este orden SIEMPRE:
1. JerryGateway recibe mensaje WebSocket → encola en BullMQ
2. ConversationWorker procesa: Intent → Extract → Strategy → Prompt → LLM
3. Emite evento jerry.response → Gateway reenvía al cliente
4. DossierWorker escucha dossier.update → merge → PostgreSQL
## Convenciones de codigo
- NUNCA usar any en TypeScript — siempre tipar correctamente
- Todos los servicios son @Injectable() con constructor injection
- Los workers usan @Processor y @Process de @nestjs/bull
- Los eventos usan @OnEvent de @nestjs/event-emitter
- Imports siempre con rutas relativas desde src/
## Estructura de modulos
src/modules/jerry/ → agente conversacional completo
src/modules/dossier/ → motor de datos del atleta
src/modules/scout/ → busqueda y matching para reclutadores
src/shared/llm/ → wrapper de OpenAI
src/shared/redis/ → cliente Redis
src/shared/prisma/ → cliente de base de datos
## Tests
- Jest + @nestjs/testing para unit tests
- Siempre mockear Redis, Prisma y OpenAI en tests unitarios
- Usar jest.fn() y mockResolvedValue — nunca conectar servicios reales
- Archivos de test en src/modules/jerry/__tests__/*.spec.ts
## Comandos utiles
pnpm test → corre todos los tests
pnpm test -- --watch → watch mode
pnpm start:dev → servidor en desarrollo
