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
RUN pnpm --dir packages/database exec prisma generate
# prisma generate writes to packages/database/node_modules (schema-relative output).
# cp -rL follows pnpm symlinks so production gets real files, not broken .pnpm refs.
RUN mkdir -p /app/node_modules/@prisma && \
    cp -rL /app/packages/database/node_modules/.prisma /app/node_modules/ && \
    cp -rL /app/packages/database/node_modules/@prisma/client /app/node_modules/@prisma/
RUN pnpm --dir apps/api build

FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Hoist all packages to root so @prisma/client resolves at node_modules/@prisma/client,
# the same path where we restore the generated client from the builder.
RUN echo "shamefully-hoist=true" > .npmrc
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# --ignore-scripts prevents packages/database postinstall (prisma generate)
# from running — prisma CLI is a devDependency, not available with --prod.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Restore the Prisma native query engine and schema-specific generated client
# from the builder. These overwrite the vanilla @prisma/client that pnpm installed.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

WORKDIR /app/apps/api
RUN chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "dist/main"]
