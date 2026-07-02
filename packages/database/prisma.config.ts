import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrations: {
    // `dotenv -e ../../.env` is a no-op when that file is missing (e.g. in
    // CI/remote, where DATABASE_URL is already a real env var) — same command
    // works unchanged for local dev and for remote deploys.
    seed: 'dotenv -e ../../.env -- ts-node --project tsconfig.json -r tsconfig-paths/register prisma/seed.ts',
  },
  migrate: {
    async adapter() {
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const connectionString = process.env.DATABASE_URL!
      return new PrismaPg({ connectionString })
    },
  },
})