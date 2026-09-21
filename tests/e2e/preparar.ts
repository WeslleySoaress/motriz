import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Prepara o ambiente dos testes ponta a ponta ANTES de o servidor subir.
 *
 * Isto roda como primeiro passo do `webServer` do Playwright, e não no
 * `globalSetup`: o Playwright inicia o servidor antes do globalSetup, então
 * preparar o banco lá seria tarde demais — o servidor já teria respondido a
 * primeira requisição com o banco vazio.
 *
 * Apaga o banco e os uploads da execução anterior, aplica as migrações, cria
 * as contas e os anúncios de partida e grava os ids em tests/e2e/.dados.json
 * para os testes lerem.
 */
async function main() {
  const raiz = process.cwd()

  const banco = path.join(raiz, 'prisma', 'e2e.db')
  const uploads = path.join(raiz, 'storage', 'e2e-uploads')
  const emails = path.join(raiz, 'log', 'emails.log')

  for (const alvo of [banco, `${banco}-journal`, uploads, emails]) {
    rmSync(alvo, { force: true, recursive: true })
  }
  mkdirSync(uploads, { recursive: true })

  // O CLI do Prisma é chamado pelo próprio Node: no Windows, execFileSync com
  // um arquivo .cmd falha com EINVAL.
  const prismaCli = path.join(raiz, 'node_modules', 'prisma', 'build', 'index.js')
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: raiz,
    stdio: 'inherit',
    env: { ...process.env },
  })

  const { semearE2E } = await import('./seed-e2e')
  const dados = await semearE2E()

  writeFileSync(path.join(raiz, 'tests', 'e2e', '.dados.json'), JSON.stringify(dados, null, 2))
  console.log('[e2e] banco e dados de partida prontos.')
}

main().catch((erro) => {
  console.error('[e2e] falha ao preparar o ambiente:', erro)
  process.exit(1)
})
