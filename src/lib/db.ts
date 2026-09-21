import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'
import { env, isProd } from './env'

/**
 * Cliente Prisma único por processo.
 * Em desenvolvimento o Next recarrega os módulos a cada alteração; guardar a
 * instância em globalThis evita abrir uma conexão nova a cada hot reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function create() {
  const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL })
  return new PrismaClient({
    adapter,
    // Em produção não logamos queries (podem conter dados pessoais); apenas
    // avisos e erros, sem valores de parâmetros.
    log: isProd ? ['warn', 'error'] : ['warn', 'error'],
  })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? create()

if (!isProd) globalForPrisma.prisma = prisma
