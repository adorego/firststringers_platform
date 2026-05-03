# syntax=docker/dockerfile:1.5
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
 
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web/package.json apps/web/next.config.mjs apps/web/postcss.config.mjs ./apps/web/
COPY apps/web/src ./apps/web/src
COPY apps/web/public ./apps/web/public
COPY apps/web/tsconfig.json ./apps/web/tsconfig.json
 
RUN pnpm install --frozen-lockfile
RUN pnpm --dir apps/web build
 
# ─────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
 
# FIX 1: fijar el store de pnpm en una ruta absoluta que sea
# accesible tanto durante el build (root) como en runtime (node).
RUN pnpm config set store-dir /app/.pnpm-store --global
 
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages
 
# FIX 2: copiar next.config.mjs en vez de .ts para que Next.js
# no intente transpilarlo en runtime (lo que requiere TypeScript
# como devDependency, que no está disponible con --prod).
COPY apps/web/next.config.mjs ./apps/web/next.config.mjs
 
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
 
# FIX 3: chown ANTES del pnpm install para que el store quede
# con permisos del usuario node desde el inicio.
RUN chown -R node:node /app
 
# Cambiar a node ANTES del install para que el store y
# node_modules queden con el mismo usuario que ejecuta la app.
USER node
 
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
 
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
 
WORKDIR /app/apps/web
EXPOSE 3000
 
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT||3000) + '/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"
 
CMD ["pnpm", "run", "start"]
