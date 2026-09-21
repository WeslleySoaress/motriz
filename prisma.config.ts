import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7 não carrega .env automaticamente e não aceita mais `url` dentro do
// schema: a conexão vem por driver adapter, declarado aqui para a CLI
// (migrate/studio) e em src/lib/db.ts para a aplicação.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
})
