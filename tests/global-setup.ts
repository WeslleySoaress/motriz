import { execFileSync } from 'node:child_process'
import { rmSync, mkdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Prepara um banco SQLite limpo antes da suíte e apaga tudo no fim.
 * O banco de desenvolvimento (prisma/dev.db) nunca é tocado.
 */
export async function setup() {
  const raiz = process.cwd()
  const banco = path.join(raiz, 'prisma', 'test.db')
  const uploads = path.join(raiz, 'storage', 'test-uploads')

  for (const alvo of [banco, `${banco}-journal`, uploads]) {
    rmSync(alvo, { force: true, recursive: true })
  }
  mkdirSync(uploads, { recursive: true })

  // Chamamos o CLI do Prisma pelo próprio Node: no Windows, execFileSync com
  // um .cmd falha com EINVAL.
  const prismaCli = path.join(raiz, 'node_modules', 'prisma', 'build', 'index.js')
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: raiz,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./prisma/test.db' },
  })
}

export async function teardown() {
  const raiz = process.cwd()
  for (const alvo of [
    path.join(raiz, 'prisma', 'test.db'),
    path.join(raiz, 'prisma', 'test.db-journal'),
    path.join(raiz, 'storage', 'test-uploads'),
  ]) {
    rmSync(alvo, { force: true, recursive: true })
  }
}
