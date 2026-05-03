# syntax=docker/dockerfile:1.5

FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace manifest + lockfile for dependency installation
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web/package.json apps/web/next.config.ts apps/web/postcss.config.mjs ./apps/web/
COPY apps/web/src ./apps/web/src
COPY apps/web/public ./apps/web/public
COPY apps/web/tsconfig.json ./apps/web/tsconfig.json

RUN pnpm install --frozen-lockfile
RUN pnpm --dir apps/web build

FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/web/next.config.ts ./apps/web/next.config.ts
COPY packages ./packages
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

# --ignore-scripts prevents packages/database postinstall (prisma generate)
# from running — prisma CLI is a devDependency, unavailable with --prod.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["sh", "-c", "node_modules/.bin/next start --port ${PORT:-3000}"]
