# Deployment Guide — firststringers_platform

> **Stack:** NestJS 11 · Next.js 16 · Prisma 5 + PostgreSQL · Bull 4 + ioredis · pnpm 9 · Node 20  
> **Plataforma objetivo:** Railway (staging + production) + GitHub Actions CI/CD  
> **Última revisión del código:** Mayo 2026

---

## Índice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Configuración inicial de Railway](#2-configuración-inicial-de-railway)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Archivos a crear o modificar en el proyecto](#4-archivos-a-crear-o-modificar-en-el-proyecto)
5. [Secrets en GitHub](#5-secrets-en-github)
6. [Secuencia de ejecución](#6-secuencia-de-ejecución)
7. [Verificación](#7-verificación)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Pre-requisitos

### Herramientas requeridas

```bash
# Node.js 20 (usa nvm)
nvm install 20
nvm use 20
node --version   # debe mostrar v20.x.x

# pnpm 9 (package manager del proyecto)
npm install -g pnpm@9.0.0
pnpm --version   # debe mostrar 9.0.0

# Railway CLI
npm install -g @railway/cli
railway --version   # debe mostrar 3.x.x

# GitHub CLI (para configurar secrets desde terminal)
# macOS
brew install gh
# Linux/WSL
sudo apt install gh
# Windows
winget install --id GitHub.cli

gh --version   # debe mostrar 2.x.x
```

### Cuentas y accesos necesarios

| Servicio | Qué necesitas | URL |
|----------|---------------|-----|
| Railway | Cuenta creada + proyecto | https://railway.app |
| GitHub | Acceso admin al repo (para configurar secrets) | — |
| Docker Hub | Cuenta + repositorios `firststringers-api` y `firststringers-web` | https://hub.docker.com |
| OpenAI | API Key activa | https://platform.openai.com |

---

## 2. Configuración inicial de Railway

### 2.1 Autenticación y proyecto

```bash
# Login interactivo (abre navegador)
railway login

# Verificar que estás autenticado
railway whoami
```

### 2.2 Crear o vincular el proyecto

**Opción A — proyecto nuevo:**

```bash
# Desde la raíz del repositorio
railway init

# Cuando pregunte el nombre del proyecto:
# → firststringers-platform
```

**Opción B — vincular proyecto existente:**

```bash
railway link
# Selecciona el proyecto en el menú interactivo
```

### 2.3 Crear el entorno staging

Railway crea el entorno `production` automáticamente. Debes crear `staging` manualmente:

```bash
railway environment create staging
```

Verifica que tienes ambos entornos:

```bash
railway environment
# Debe mostrar: production, staging
```

### 2.4 Provisionar servicios en cada entorno

Repite los pasos 2.4 y 2.5 **dos veces**: una para `staging` y otra para `production`.

#### En el entorno staging:

```bash
railway environment staging
```

**Agregar PostgreSQL con pgvector:**

```bash
# Abre el dashboard de Railway en el entorno staging
railway open
```

> En el dashboard: **New Service → Database → PostgreSQL**
>
> ⚠️ VERIFICAR: Railway usa `pgvector/pgvector:pg16` en producción. En Railway el template de Postgres estándar no incluye pgvector. Verifica en el dashboard que la imagen es `pgvector/pgvector:pg16` o agrega la variable `PGVECTOR_EXTENSION=true` si tu template lo soporta. Si no está disponible, usa un servicio Postgres externo (Neon, Supabase) con pgvector habilitado.

**Agregar Redis:**

> En el dashboard: **New Service → Database → Redis**
>
> Railway despliega Redis 7 por defecto. Compatible con el proyecto (`redis:7-alpine`).

**Agregar servicio API:**

> En el dashboard: **New Service → GitHub Repo → selecciona tu repo → Root Directory: `.`**
>
> Railway detectará automáticamente `apps/api/railway.toml`.

**Agregar servicio Web:**

> En el dashboard: **New Service → GitHub Repo → selecciona tu repo → Root Directory: `.`**
>
> Railway detectará `railway.toml` en la raíz que apunta a `apps/web/Dockerfile`.

#### En el entorno production:

```bash
railway environment production
```

Repite los mismos pasos del entorno staging.

### 2.5 Vincular servicios (Railway inyecta URLs automáticamente)

En el dashboard de Railway, para **cada entorno**:

1. Abre el servicio **API**
2. Ve a **Variables**
3. Haz clic en **+ Reference Variable**
4. Selecciona la variable `DATABASE_URL` del servicio Postgres
5. Selecciona la variable `REDIS_URL` del servicio Redis

Esto hace que Railway inyecte automáticamente las URLs correctas con credenciales en cada entorno sin hardcodearlas.

### 2.6 Obtener tokens y IDs necesarios

```bash
# Token de proyecto Railway (para GitHub Actions)
railway open
# En el dashboard: Settings → Tokens → Create Token
# Nombre sugerido: "github-actions-deploy"
# Guarda el token generado → lo usarás como RAILWAY_TOKEN

# Obtener IDs de servicios API y Web por entorno
# Staging
railway environment staging
railway service
# Copia los IDs de "api" y "web" → RAILWAY_API_SERVICE_ID y RAILWAY_WEB_SERVICE_ID (staging)

# Production
railway environment production
railway service
# Copia los IDs → los mismos secrets en el entorno GitHub "production"
```

---

## 3. Variables de entorno

### 3.1 Variables comunes (se configuran en Railway, no en GitHub)

Estas se setean por servicio en Railway usando `railway variables set`. Ejecuta en cada entorno:

```bash
# Cambia al entorno correspondiente primero
railway environment staging   # o production

# Luego setea variables en el servicio API
railway variables set OPENAI_API_KEY="sk-tu-key-aqui" --service api
railway variables set PORT="3001" --service api
railway variables set FRONTEND_URL="https://tu-web-staging.up.railway.app" --service api
```

> ⚠️ `DATABASE_URL` y `REDIS_URL` **no se setean manualmente** si usaste el paso 2.5 (Reference Variables). Railway las inyecta automáticamente.

### 3.2 Tabla completa de variables de entorno

| Variable | Requerida | Quién la provee | Staging | Production |
|----------|-----------|-----------------|---------|------------|
| `DATABASE_URL` | ✅ Sí | Railway (auto via Reference) | `postgresql://...@postgres.railway.internal:5432/railway` | igual (diferente instancia) |
| `REDIS_URL` | ✅ Sí | Railway (auto via Reference) | `redis://default:password@redis.railway.internal:6379` | igual (diferente instancia) |
| `OPENAI_API_KEY` | ✅ Sí | Manual | `sk-...` | `sk-...` |
| `PORT` | ⚠️ No (default: 3001) | Manual | `3001` | `3001` |
| `FRONTEND_URL` | ⚠️ No (default: localhost) | Manual | `https://web-staging.up.railway.app` | `https://firststringers.com` |
| `REDIS_HOST` | ❌ No usar | — | **No setear** (ver sección 4) | **No setear** |
| `REDIS_PORT` | ❌ No usar | — | **No setear** (ver sección 4) | **No setear** |
| `ANTHROPIC_API_KEY` | ❌ No usada | — | No necesaria | No necesaria |
| `AUTH_SECRET` | ❌ No usada | — | No necesaria | No necesaria |

### 3.3 Variables para el frontend (apps/web)

```bash
railway variables set NEXT_PUBLIC_API_URL="https://api-staging.up.railway.app" --service web
```

| Variable | Staging | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_API_URL` | `https://api-staging.up.railway.app` | `https://api.firststringers.com` |

> ⚠️ VERIFICAR: Confirma las URLs públicas en Railway dashboard → servicio → Settings → Domains.

### 3.4 Comando completo de configuración por entorno

```bash
# ===== STAGING =====
railway environment staging

railway variables set \
  OPENAI_API_KEY="sk-tu-openai-key" \
  PORT="3001" \
  FRONTEND_URL="https://web-staging.up.railway.app" \
  --service api

railway variables set \
  NEXT_PUBLIC_API_URL="https://api-staging.up.railway.app" \
  --service web

# ===== PRODUCTION =====
railway environment production

railway variables set \
  OPENAI_API_KEY="sk-tu-openai-key-produccion" \
  PORT="3001" \
  FRONTEND_URL="https://firststringers.com" \
  --service api

railway variables set \
  NEXT_PUBLIC_API_URL="https://api.firststringers.com" \
  --service web
```

---

## 4. Archivos a crear o modificar en el proyecto

### 4.1 CORRECCIÓN CRÍTICA: `apps/api/src/app.module.ts`

**Problema:** `BullModule` está configurado con `REDIS_HOST` + `REDIS_PORT` separados. En Railway, Redis provee una URL completa con contraseña (`redis://:password@host:port`). La configuración actual ignorará la contraseña y fallará en producción.

**Archivo:** [apps/api/src/app.module.ts](apps/api/src/app.module.ts)

```typescript
// ANTES (problemático en Railway):
BullModule.forRoot({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
}),

// DESPUÉS (correcto — usa la URL completa con password):
BullModule.forRoot({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}),
```

El archivo completo quedará así:

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { PrismaModule } from './shared/prisma/prisma.module'
import { RedisModule } from './shared/redis/redis.module'
import { LLMModule } from './shared/llm/llm.module'
import { JerryModule } from './modules/jerry/jerry.module'
import { DossierModule } from './modules/dossier/dossier.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    PrismaModule,
    RedisModule,
    LLMModule,
    JerryModule,
    DossierModule,
    HealthModule,
  ],
})
export class AppModule {}
```

> **Nota:** `REDIS_HOST` y `REDIS_PORT` dejan de ser necesarias. No las configures en Railway.

### 4.2 `apps/api/railway.toml` — ya existe y está correcto

El archivo `apps/api/railway.toml` ya existe con la configuración correcta. **No modificar:**

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/api/Dockerfile"
watchPatterns = ["apps/api/**", "packages/**", "pnpm-lock.yaml", "package.json", "pnpm-workspace.yaml"]

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### 4.3 `railway.toml` (raíz) — ya existe y está correcto

```toml
[build]
dockerfilePath = "apps/web/Dockerfile"
```

### 4.4 `.github/workflows/ci-cd.yml` — reemplazar el archivo vacío existente

El archivo `.github/workflows/ci-cd.yml` existe pero está vacío. Reemplázalo con el siguiente contenido consolidado.

> **Nota sobre workflows existentes:** Los archivos `ci.yml`, `deploy.yml` y `deploy-production.yml` hacen lo mismo que este workflow consolidado. Una vez que `ci-cd.yml` esté funcionando, elimina los otros tres para evitar ejecuciones duplicadas.

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Escribe "deploy" para confirmar deploy a production'
        required: true

permissions:
  contents: read
  packages: write

jobs:
  # ─────────────────────────────────────────────────────────
  # JOB 1: Lint
  # ─────────────────────────────────────────────────────────
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.0.0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  # ─────────────────────────────────────────────────────────
  # JOB 2: Tests con Postgres (pgvector) y Redis reales
  # ─────────────────────────────────────────────────────────
  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.0.0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter=@firststringers/database exec prisma generate

      - name: Apply database migrations
        run: pnpm --filter=@firststringers/database exec prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test

      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
          OPENAI_API_KEY: test-key
          AUTH_SECRET: test-secret

  # ─────────────────────────────────────────────────────────
  # JOB 3: Build y push Docker Hub
  # REQUIERE: rama main. Corre en push a main o workflow_dispatch.
  # Sin esta restricción, un dispatch desde feature branch sobreescribiría
  # la imagen :latest en Docker Hub con código no mergeado a main.
  # ─────────────────────────────────────────────────────────
  build-and-push:
    name: Build & Push Docker
    runs-on: ubuntu-latest
    needs: [lint, test]
    if: >
      github.ref == 'refs/heads/main' &&
      (github.event_name == 'push' ||
       (github.event_name == 'workflow_dispatch' && github.event.inputs.confirm == 'deploy'))
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Metadata — API
        id: meta-api
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.DOCKER_USERNAME }}/firststringers-api
          tags: |
            type=sha,prefix=main-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Metadata — Web
        id: meta-web
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.DOCKER_USERNAME }}/firststringers-web
          tags: |
            type=sha,prefix=main-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build & push API
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/api/Dockerfile
          push: true
          tags: ${{ steps.meta-api.outputs.tags }}
          labels: ${{ steps.meta-api.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build & push Web
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/web/Dockerfile
          push: true
          tags: ${{ steps.meta-web.outputs.tags }}
          labels: ${{ steps.meta-web.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─────────────────────────────────────────────────────────
  # JOB 4: Deploy a STAGING (automático en push a main)
  # ─────────────────────────────────────────────────────────
  deploy-staging:
    name: Deploy → Staging
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: staging
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.0.0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter=@firststringers/database exec prisma generate

      - name: Run migrations → staging
        run: pnpm --filter=@firststringers/database exec prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Redeploy API → staging
        run: railway redeploy --service ${{ secrets.RAILWAY_API_SERVICE_ID }} --yes
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

      - name: Redeploy Web → staging
        run: railway redeploy --service ${{ secrets.RAILWAY_WEB_SERVICE_ID }} --yes
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  # ─────────────────────────────────────────────────────────
  # JOB 5: Deploy a PRODUCTION (manual via workflow_dispatch)
  # Solo se puede disparar desde main para evitar deploys de ramas
  # ─────────────────────────────────────────────────────────
  deploy-production:
    name: Deploy → Production
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: production
    if: >
      github.ref == 'refs/heads/main' &&
      github.event_name == 'workflow_dispatch' &&
      github.event.inputs.confirm == 'deploy'
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.0.0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter=@firststringers/database exec prisma generate

      - name: Run migrations → production
        run: pnpm --filter=@firststringers/database exec prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Redeploy API → production
        run: railway redeploy --service ${{ secrets.RAILWAY_API_SERVICE_ID }} --yes
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

      - name: Redeploy Web → production
        run: railway redeploy --service ${{ secrets.RAILWAY_WEB_SERVICE_ID }} --yes
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### 4.5 Correcciones adicionales al proyecto

#### A. `.gitignore` — agregar patrones de env faltantes

El `.gitignore` actual cubre `.env`, `.env.local`, `.env.*.local` pero **no** cubre `.env.staging`, `.env.production`, `.env.development` ni `.env.test`. Si creas archivos locales con esos nombres, se commitearían accidentalmente.

Agrega al `.gitignore` (en la sección `# Environment`):

```
# Environment
.env
.env.*
.env.local
```

La línea `.env.*` reemplaza el patrón `.env.*.local` y cubre todos los casos.

#### B. `apps/api/Dockerfile` — `prisma generate` apunta al schema equivocado

**Problema:** El Dockerfile ejecuta:
```dockerfile
RUN pnpm --dir apps/api exec prisma generate
```
Esto usa `apps/api/prisma/schema.prisma`, que está vacío (sin modelos). El schema real con los modelos `Athlete`, `Dossier`, `JerrySession`, etc. está en `packages/database/prisma/schema.prisma`. El `@prisma/client` generado en producción quedaría sin tipos ni métodos de modelos.

**Archivo:** [apps/api/Dockerfile](apps/api/Dockerfile) — línea 17

```dockerfile
# ANTES (genera cliente vacío desde schema sin modelos):
RUN pnpm --dir apps/api exec prisma generate

# DESPUÉS (genera cliente con todos los modelos reales):
RUN pnpm --dir packages/database exec prisma generate
```

---

## 5. Secrets en GitHub

### 5.1 Crear los entornos en GitHub

Antes de agregar secrets de entorno, crea los environments en GitHub:

```bash
# No hay comando gh para crear environments, hazlo en el dashboard:
# Repositorio → Settings → Environments → New environment
# Crea: "staging" y "production"
#
# En "production", activa "Required reviewers" y agrégate a ti mismo
# para tener un gate de aprobación manual.
```

### 5.2 Tabla de secrets

#### Secrets globales del repositorio (compartidos por todos los workflows)

| Secret | Descripción | Cómo obtenerlo |
|--------|-------------|----------------|
| `DOCKER_USERNAME` | Usuario de Docker Hub | Tu username en hub.docker.com |
| `DOCKER_PASSWORD` | Access Token de Docker Hub | Docker Hub → Account Settings → Security → New Access Token |
| `RAILWAY_TOKEN` | Token de proyecto Railway | Railway dashboard → Settings → Tokens → Create Token |

#### Secrets del entorno `staging`

| Secret | Descripción | Cómo obtenerlo |
|--------|-------------|----------------|
| `DATABASE_URL` | URL de Postgres de staging | Railway → entorno staging → servicio Postgres → Variables → `DATABASE_URL` |
| `RAILWAY_API_SERVICE_ID` | ID del servicio API en staging | `railway environment staging && railway service` → columna ID del servicio `api` |
| `RAILWAY_WEB_SERVICE_ID` | ID del servicio Web en staging | `railway environment staging && railway service` → columna ID del servicio `web` |

#### Secrets del entorno `production`

| Secret | Descripción | Cómo obtenerlo |
|--------|-------------|----------------|
| `DATABASE_URL` | URL de Postgres de production | Railway → entorno production → servicio Postgres → Variables → `DATABASE_URL` |
| `RAILWAY_API_SERVICE_ID` | ID del servicio API en production | `railway environment production && railway service` → columna ID del servicio `api` |
| `RAILWAY_WEB_SERVICE_ID` | ID del servicio Web en production | `railway environment production && railway service` → columna ID del servicio `web` |

### 5.3 Comandos para cargar los secrets con GitHub CLI

```bash
# Autenticarse con GitHub CLI primero
gh auth login

# ── SECRETS GLOBALES ──────────────────────────────────────────────

gh secret set DOCKER_USERNAME \
  --body "tu-usuario-dockerhub" \
  --repo tu-org/firststringers_platform

gh secret set DOCKER_PASSWORD \
  --body "dckr_pat_xxxxxxxxxxxx" \
  --repo tu-org/firststringers_platform

gh secret set RAILWAY_TOKEN \
  --body "railway-token-xxxxxxxxxxxx" \
  --repo tu-org/firststringers_platform

# ── SECRETS DE ENTORNO: staging ───────────────────────────────────

gh secret set DATABASE_URL \
  --body "postgresql://postgres:pass@roundhouse.proxy.rlwy.net:PORT/railway" \
  --env staging \
  --repo tu-org/firststringers_platform

gh secret set RAILWAY_API_SERVICE_ID \
  --body "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  --env staging \
  --repo tu-org/firststringers_platform

gh secret set RAILWAY_WEB_SERVICE_ID \
  --body "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy" \
  --env staging \
  --repo tu-org/firststringers_platform

# ── SECRETS DE ENTORNO: production ────────────────────────────────

gh secret set DATABASE_URL \
  --body "postgresql://postgres:pass@roundhouse.proxy.rlwy.net:PORT/railway" \
  --env production \
  --repo tu-org/firststringers_platform

gh secret set RAILWAY_API_SERVICE_ID \
  --body "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" \
  --env production \
  --repo tu-org/firststringers_platform

gh secret set RAILWAY_WEB_SERVICE_ID \
  --body "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" \
  --env production \
  --repo tu-org/firststringers_platform
```

> Reemplaza todos los valores `xxxx...` con los reales obtenidos en el paso 2.6.

---

## 6. Secuencia de ejecución

Ejecuta en este orden exacto, copiando y pegando cada bloque:

```bash
# ── PASO 0 (UNA SOLA VEZ): Crear la primera migración de base de datos ──
#
# Las migraciones no existen todavía en el repo
# (packages/database/prisma/migrations/ está vacío).
# Este paso debe hacerse ANTES del primer deploy y los archivos
# generados deben commitearse al repositorio.
#
# Necesitas una base de datos PostgreSQL accesible (puede ser la de
# staging en Railway, o una local con Docker):

# Instala dependencias
pnpm install

# Genera el cliente Prisma desde el schema real (packages/database)
pnpm --filter=@firststringers/database exec prisma generate

# Crea la primera migración (requiere DATABASE_URL disponible)
DATABASE_URL="postgresql://postgres:1234@localhost:5432/firststringers" \
  pnpm --filter=@firststringers/database exec prisma migrate dev --name init

# Verifica que se creó la carpeta de migraciones
ls packages/database/prisma/migrations/
# Debe mostrar: 20XXXXXX_init/

# Commitea las migraciones (son parte del código, no van en .gitignore)
git add packages/database/prisma/migrations/
git commit -m "feat: add initial Prisma migrations"
git push origin main
```

---

```bash
# ── PASO 1: Instalar herramientas ─────────────────────────────────
nvm install 20 && nvm use 20
npm install -g pnpm@9.0.0
npm install -g @railway/cli
brew install gh   # o apt install gh en Linux

# ── PASO 2: Autenticaciones ───────────────────────────────────────
railway login          # abre navegador
gh auth login          # sigue el flujo interactivo
docker login           # usuario y password/token de Docker Hub

# ── PASO 3: Vincular repositorio con Railway ──────────────────────
cd /ruta/a/firststringers_platform
railway link           # selecciona tu proyecto en el menú

# ── PASO 4: Crear entorno staging ────────────────────────────────
railway environment create staging

# ── PASO 5: Provisionar servicios en Railway (staging) ───────────
# Hazlo desde el dashboard (ver sección 2.4):
railway open           # abre el dashboard en el entorno actual

# Desde el dashboard crea:
#   → Postgres (pgvector/pgvector:pg16)
#   → Redis
#   → Servicio API (apunta al repo, Railway detecta apps/api/railway.toml)
#   → Servicio Web (apunta al repo, Railway detecta railway.toml raíz)

# ── PASO 6: Configurar Reference Variables en Railway (staging) ───
# Dashboard → servicio API → Variables → Add Reference → DATABASE_URL (de Postgres)
# Dashboard → servicio API → Variables → Add Reference → REDIS_URL (de Redis)

# ── PASO 7: Setear variables de aplicación en staging ────────────
railway environment staging

railway variables set \
  OPENAI_API_KEY="sk-tu-key-aqui" \
  PORT="3001" \
  FRONTEND_URL="https://web-staging.up.railway.app" \
  --service api

railway variables set \
  NEXT_PUBLIC_API_URL="https://api-staging.up.railway.app" \
  --service web

# ── PASO 8: Repetir pasos 5-7 para production ────────────────────
railway environment production
railway open
# (repetir provisioning y variables con URLs de producción)

# ── PASO 9: Obtener IDs de servicios ─────────────────────────────
railway environment staging
railway service
# Anota los UUIDs de los servicios "api" y "web"

railway environment production
railway service
# Anota los UUIDs de los servicios "api" y "web"

# ── PASO 10: Crear environments en GitHub ────────────────────────
# Hazlo en el dashboard: repo → Settings → Environments
# Crea: "staging" y "production"
# En "production" activa Required reviewers

# ── PASO 11: Cargar secrets en GitHub ────────────────────────────
# (reemplaza los valores con los reales)
gh secret set DOCKER_USERNAME --body "tu-usuario" --repo tu-org/firststringers_platform
gh secret set DOCKER_PASSWORD --body "dckr_pat_xxx" --repo tu-org/firststringers_platform
gh secret set RAILWAY_TOKEN --body "railway-token-xxx" --repo tu-org/firststringers_platform

gh secret set DATABASE_URL --body "postgresql://..." --env staging --repo tu-org/firststringers_platform
gh secret set RAILWAY_API_SERVICE_ID --body "uuid-staging-api" --env staging --repo tu-org/firststringers_platform
gh secret set RAILWAY_WEB_SERVICE_ID --body "uuid-staging-web" --env staging --repo tu-org/firststringers_platform

gh secret set DATABASE_URL --body "postgresql://..." --env production --repo tu-org/firststringers_platform
gh secret set RAILWAY_API_SERVICE_ID --body "uuid-prod-api" --env production --repo tu-org/firststringers_platform
gh secret set RAILWAY_WEB_SERVICE_ID --body "uuid-prod-web" --env production --repo tu-org/firststringers_platform

# ── PASO 12: Aplicar corrección crítica en el código ─────────────
# Edita apps/api/src/app.module.ts según la sección 4.1
# Cambia redis: { host, port } por url: process.env.REDIS_URL

# ── PASO 13: Reemplazar ci-cd.yml ────────────────────────────────
# Reemplaza .github/workflows/ci-cd.yml con el contenido de la sección 4.4

# ── PASO 14: Commit y push ───────────────────────────────────────
git add \
  apps/api/src/app.module.ts \
  apps/api/Dockerfile \
  .github/workflows/ci-cd.yml \
  .gitignore
git commit -m "fix: correct prisma generate target, REDIS_URL for BullModule, CI/CD workflow"
git push origin main

# ── PASO 15: Verificar el pipeline ───────────────────────────────
gh run watch   # sigue en tiempo real el workflow que se acaba de disparar

# ── PASO 15b: Si es el PRIMER deploy — Railway auto-despliega ────
#
# IMPORTANTE: `railway redeploy` falla si no hay un deployment previo.
# Para el primer deploy de cada servicio, Railway lo hace automáticamente
# cuando conectas el repo en el dashboard (paso 5). Verifica en
# Railway dashboard que el primer build completó antes de continuar.
#
# Para los deploys subsiguientes, el workflow ci-cd.yml usa
# `railway redeploy` que funciona correctamente.

# ── PASO 16: Deploy a production (cuando staging esté verificado) ─
# NOTA: El workflow_dispatch solo funciona desde la rama main.
gh workflow run ci-cd.yml --ref main --field confirm=deploy
```

---

## 7. Verificación

### 7.1 Verificar que la API está corriendo

```bash
# Staging
curl https://api-staging.up.railway.app/health

# Respuesta esperada:
# {"status":"ok","info":{"database":{"status":"up"},...}}
```

### 7.2 Verificar conexión a Redis

```bash
# Ver logs del servicio API en Railway
railway logs --service api --environment staging

# Busca en los logs:
# [RedisService] Redis connected        → ioredis conectado OK
# [BullModule] Connected to Redis       → BullModule conectado OK

# Si ves errores como "NOAUTH" o "ERR invalid password":
# → El BullModule todavía usa REDIS_HOST/PORT en vez de REDIS_URL
# → Verifica que aplicaste el cambio de la sección 4.1
```

### 7.3 Verificar que Bull está procesando jobs

```bash
# Monitorear logs mientras mandas un mensaje por WebSocket
railway logs --service api --environment staging --tail 100

# Deberías ver logs del ConversationWorker:
# [ConversationWorker] Processing job process.message #<id>
# [ConversationWorker] Job completed: #<id>

# Si los jobs quedan en estado "waiting" indefinidamente:
# → Problema de conexión Redis en BullModule (ver sección 8)
```

### 7.4 Verificar variables de entorno en Railway

```bash
# Ver todas las variables del servicio API en staging
railway variables --service api --environment staging

# Debe mostrar:
# DATABASE_URL  postgresql://postgres:...@railway.internal:5432/railway
# REDIS_URL     redis://:password@redis.railway.internal:6379
# OPENAI_API_KEY  sk-...
# PORT          3001
# FRONTEND_URL  https://...
```

### 7.5 Verificar migraciones de Prisma

```bash
# Verificar que las migraciones se aplicaron
# (usa DATABASE_URL del servicio Postgres de staging en Railway)
DATABASE_URL="postgresql://..." \
  pnpm --filter=@firststringers/database exec prisma migrate status

# Debe mostrar todas las migraciones como "Applied"
# Si alguna aparece como "Pending", correr migrate deploy manualmente:
DATABASE_URL="postgresql://..." \
  pnpm --filter=@firststringers/database exec prisma migrate deploy

# Verificar tablas directamente en la base de datos
railway run --service api --environment staging -- \
  npx prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname='public';"
```

### 7.6 Ver logs en tiempo real

```bash
# API
railway logs --service api --environment staging --tail 200

# Web
railway logs --service web --environment staging --tail 100

# Modo follow (streaming)
railway logs --service api --environment staging --follow
```

---

## 8. Troubleshooting

### Error: `NOAUTH Authentication required`

**Síntoma:** La API arranca pero los jobs de Bull no se procesan. En los logs aparece `NOAUTH Authentication required`.

**Causa:** `BullModule` está usando `REDIS_HOST`/`REDIS_PORT` sin la contraseña. Railway proporciona Redis con autenticación.

**Solución:** Verificar que aplicaste el cambio de la sección 4.1:
```typescript
// app.module.ts debe tener:
BullModule.forRoot({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
})
```
Verifica que `REDIS_URL` está seteada en Railway con el valor que provee el servicio Redis.

---

### Error: `connect ECONNREFUSED 127.0.0.1:6379`

**Síntoma:** La API no puede conectar a Redis. En los logs: `Error: connect ECONNREFUSED`.

**Causa A:** `REDIS_URL` no está configurada como Reference Variable en el servicio API.

**Solución A:** En Railway dashboard → servicio API → Variables → Add Reference → selecciona `REDIS_URL` del servicio Redis. Redeploy.

**Causa B:** Los servicios Redis y API están en entornos distintos.

**Solución B:** Verificar que ambos servicios están en el mismo entorno de Railway.

---

### Error: `P1001: Can't reach database server`

**Síntoma:** La API arranca pero falla al conectar a Postgres.

**Causa:** `DATABASE_URL` no está configurada o apunta a `localhost`.

**Solución:**
```bash
# Verificar la variable
railway variables --service api --environment staging | grep DATABASE_URL

# Si está vacía o es localhost, agregar Reference Variable:
# Dashboard → servicio API → Variables → Add Reference → DATABASE_URL (de Postgres)
```

---

### Error: `Healthcheck failed` — servicio no arranca en Railway

**Síntoma:** Railway reporta que el healthcheck falla y el servicio no pasa a estado `Running`.

**Causa A:** La aplicación está crasheando antes de que `/health` esté disponible.

**Diagnóstico:**
```bash
railway logs --service api --environment staging --tail 50
```

**Causa B:** `PORT` no coincide con el puerto en el que la app escucha.

**Solución B:** Verificar que `PORT=3001` está seteado en Railway y que `main.ts` usa `process.env.PORT || 3001`.

**Causa C:** El healthcheck timeout de 300s es insuficiente para el cold start (raro pero posible con imágenes grandes).

**Solución C:** En `apps/api/railway.toml`, aumentar `healthcheckTimeout = 600`.

---

### Error: `Missing script: db:generate`

**Síntoma:** El CI/CD falla con `ERR_PNPM_NO_SCRIPT  Missing script: db:generate`.

**Causa:** El script `db:generate` no existe en el `package.json` raíz del monorepo. Solo existe en `packages/database/package.json`. Además, ese script usa `dotenv -e ../../.env` que requiere que exista un archivo `.env` local — que no existe en CI.

**Solución:** Siempre usar el comando directo de Prisma con el filtro correcto:
```bash
# Correcto — bypassa el dotenv wrapper, usa el schema con modelos reales
pnpm --filter=@firststringers/database exec prisma generate

# INCORRECTO — falla en root porque el script no existe ahí
pnpm db:generate
```

---

### Error: `Cannot find module '@prisma/client'`

**Síntoma:** La API arranca pero falla con error de módulo de Prisma, o los modelos `prisma.athlete`, `prisma.dossier` etc. no existen en runtime.

**Causa:** El Dockerfile ejecuta `prisma generate` contra `apps/api/prisma/schema.prisma`, que tiene modelos vacíos. El schema real con todos los modelos está en `packages/database/prisma/schema.prisma`.

**Solución:** Verificar que `apps/api/Dockerfile` usa el schema correcto (ver sección 4.5-B):
```dockerfile
# Correcto:
RUN pnpm --dir packages/database exec prisma generate

# Incorrecto (genera cliente vacío):
RUN pnpm --dir apps/api exec prisma generate
```

---

### Error: `No Prisma Schema found` o `Migrations folder not found`

**Síntoma:** `prisma migrate deploy` falla con error sobre migraciones no encontradas.

**Causa A:** La carpeta `packages/database/prisma/migrations/` no existe. Las migraciones nunca fueron creadas.

**Solución A:** Crear la primera migración localmente antes del primer deploy (ver Paso 0 en sección 6):
```bash
DATABASE_URL="postgresql://..." \
  pnpm --filter=@firststringers/database exec prisma migrate dev --name init
# Commitea y pushea packages/database/prisma/migrations/
```

**Causa B:** Se está apuntando al package equivocado (`--filter=api` en vez de `--filter=@firststringers/database`). El schema en `apps/api/prisma/` está vacío.

**Solución B:** Usar siempre `--filter=@firststringers/database` para comandos Prisma.

---

### Error: `railway redeploy: no deployment found`

**Síntoma:** El paso `railway redeploy --service ...` falla en el primer pipeline.

**Causa:** `railway redeploy` requiere que exista al menos un deployment previo del servicio. En el primer push, aún no hay ninguno.

**Solución:** Para el primer deploy, Railway lo hace automáticamente cuando conectas el servicio a GitHub en el dashboard. Verifica en Railway dashboard que el build inicial completó correctamente. Los deploys subsiguientes via `railway redeploy` funcionarán sin problema.

---

### Jobs de Bull quedan en estado `waiting` para siempre

**Síntoma:** El WebSocket recibe el mensaje y el job se agrega a la cola, pero el worker nunca lo procesa. `removeOnComplete: false` para verificar en Redis.

**Causa más común:** El worker (`ConversationWorker`) no está registrado en el mismo proceso que el productor, o hay error silencioso en el worker.

**Diagnóstico:**
```bash
railway logs --service api --environment staging | grep -i "worker\|bull\|redis\|jerry"
```

**Pasos de diagnóstico adicionales:**
```bash
# Conectar a Redis de staging y ver la cola
railway run --service redis --environment staging -- \
  redis-cli -u $REDIS_URL LLEN bull:jerry:wait

# Si hay jobs acumulados:
railway run --service redis --environment staging -- \
  redis-cli -u $REDIS_URL LRANGE bull:jerry:wait 0 -1
```

---

### Las migraciones fallan en CI con `migration file ... was modified`

**Síntoma:** El job `Apply database migrations` falla en GitHub Actions.

**Causa:** Se modificó un archivo de migración ya aplicado (Prisma detecta el cambio de checksum).

**Solución:** Nunca modificar archivos en `prisma/migrations/` una vez commiteados. Crear siempre una nueva migración con `prisma migrate dev --name <descripción>`.

---

### Deploy exitoso pero la web no puede alcanzar la API (CORS)

**Síntoma:** El frontend carga pero las requests fallan con `CORS policy` en el navegador.

**Causa:** `FRONTEND_URL` en Railway no coincide con el dominio real del servicio Web.

**Solución:**
```bash
# Obtener el dominio real del servicio web
railway open --service web --environment staging
# Copia el dominio asignado (ej: web-staging-production.up.railway.app)

# Actualizar la variable en el servicio API
railway variables set \
  FRONTEND_URL="https://web-staging-production.up.railway.app" \
  --service api \
  --environment staging

# Railway redeploya automáticamente al cambiar variables
```

---

*Documento generado con base en el análisis del código fuente del proyecto. Para cambios en la arquitectura o nuevas dependencias, actualizar las secciones correspondientes.*
