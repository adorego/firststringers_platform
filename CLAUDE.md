# First Stringers Platform

AI-powered athletic recruiting platform. Monorepo with pnpm workspaces + Turborepo.

## Structure

```
apps/
  web/          → Next.js 16 frontend (React 19, Tailwind v4, App Router)
  api/          → NestJS 11 backend (REST + WebSockets)
packages/
  database/     → Prisma schema + migrations (PostgreSQL)
  config/       → Shared environment config
  types/        → Shared TypeScript types
```

## Commands

```bash
pnpm dev              # Run all apps in dev mode (turbo)
pnpm build            # Build all apps
pnpm lint             # Lint all apps

# API (from apps/api/)
pnpm start:dev        # NestJS watch mode (port 3001)
pnpm test             # Jest unit tests
pnpm test:e2e         # E2E tests with supertest

# Web (from apps/web/)
pnpm dev              # Next.js dev server (port 3000)

# Database (from packages/database/)
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema without migration
pnpm db:studio        # Open Prisma Studio
```

## Tech Stack

### Backend (apps/api)
- **Framework**: NestJS 11 with Express
- **ORM**: Prisma (schema in `packages/database/prisma/schema.prisma`)
- **Auth**: JWT + Passport.js + bcrypt (module in `src/modules/auth/`)
- **Queue**: Bull + Redis for async jobs
- **WebSockets**: Socket.io (Jerry AI chat on `/jerry` namespace)
- **LLM**: OpenAI (GPT-4o) for intent classification and data extraction
- **Validation**: class-validator + class-transformer with global ValidationPipe (whitelist + transform)
- **Events**: @nestjs/event-emitter for inter-module communication

### Frontend (apps/web)
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4, dark mode primary
- **State**: Zustand
- **Data fetching**: @tanstack/react-query + axios
- **Auth**: next-auth
- **WebSocket**: socket.io-client
- **Icons**: Lucide React
- **Design System**: Colors — black #000, teal #00D4AA, dark-card #111827. Font: Inter.

## Architecture Patterns

- **Global modules**: PrismaModule, RedisModule, LLMModule are `@Global()` — no need to import in feature modules
- **Auth is global**: JwtAuthGuard and RolesGuard are registered as APP_GUARD in AppModule. Use `@Public()` to skip auth on specific routes. Use `@Roles('ATHLETE')` to restrict by role. Use `@CurrentUser()` to inject the authenticated user.
- **Async processing**: Messages go through Bull queue → ConversationWorker processes intent → events trigger dossier updates
- **TypeScript config**: `nodenext` module resolution in API, `esnext` in web. Imports do NOT use `.js` extensions.

## Environment Variables

```
DATABASE_URL          # PostgreSQL connection string
REDIS_URL             # Redis connection (or REDIS_HOST + REDIS_PORT, default localhost:6379)
JWT_SECRET            # Required for auth
JWT_REFRESH_SECRET    # Optional (falls back to JWT_SECRET)
OPENAI_API_KEY        # For LLM service
FRONTEND_URL          # CORS origin (default http://localhost:3000)
PORT                  # API port (default 3001)
```

## Conventions

- Language: TypeScript strict (strictNullChecks enabled)
- Package manager: pnpm 9 (do NOT use npm or yarn)
- Imports: No `.js` extensions, no path aliases in API, `@/*` alias in web
- NestJS modules go in `src/modules/<name>/`
- Shared services go in `src/shared/<name>/`
- DTOs go in `src/modules/<name>/dto/`
- Database changes go in `packages/database/prisma/schema.prisma`, then run `pnpm db:migrate`
