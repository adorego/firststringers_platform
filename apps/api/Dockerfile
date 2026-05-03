# syntax=docker/dockerfile:1.5

FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api/package.json apps/api/nest-cli.json apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src

RUN pnpm install --frozen-lockfile

# prisma generate follows pnpm symlinks into the .pnpm virtual store.
# .prisma and @prisma/client always end up as siblings in the same node_modules dir.
# We locate .prisma with find, derive its parent, then cp -rL (follow symlinks)
# both artifacts to stable root paths for the production COPY below.
RUN pnpm --dir packages/database exec prisma generate && \
    PSRC=$(find /app -type d -name ".prisma" 2>/dev/null | head -1) && \
    [ -n "$PSRC" ] || (echo "ERROR: .prisma not found after prisma generate" && exit 1) && \
    PARENT=$(dirname "$PSRC") && \
    mkdir -p /app/node_modules/@prisma && \
    cp -rL "$PSRC" /app/node_modules/ && \
    if [ -d "$PARENT/@prisma/client" ]; then \
      cp -rL "$PARENT/@prisma/client" /app/node_modules/@prisma/; \
    else \
      echo "ERROR: @prisma/client not found at $PARENT/@prisma/client" && exit 1; \
    fi

RUN pnpm --dir apps/api build

FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Hoist all packages to root node_modules so @prisma/client resolves at
# node_modules/@prisma/client — the path we overwrite with the generated client.
RUN echo "shamefully-hoist=true" > .npmrc
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# --ignore-scripts prevents packages/database postinstall (prisma generate)
# from running — prisma CLI is a devDependency, unavailable with --prod.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Restore the Prisma native query engine and schema-specific generated client
# from the builder. The @prisma/client copy overwrites the vanilla npm package
# that pnpm just installed with the schema-aware version from prisma generate.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

WORKDIR /app/apps/api
RUN chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "dist/main"]
