import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

/**
 * Testes ponta a ponta.
 *
 * Ambiente isolado: banco próprio (prisma/e2e.db), diretório de uploads
 * próprio (storage/e2e-uploads) e porta própria. Nada aqui toca o banco nem os
 * arquivos de desenvolvimento.
 *
 * A moderação fica LIGADA, como no padrão do projeto: o caminho completo
 * "publicar → análise → aprovação → catálogo" é justamente um dos fluxos que
 * precisamos provar que funciona.
 *
 * Rodamos contra `next dev` por causa do tempo de iteração. O build de produção
 * é verificado separadamente por `npm run build` — ver docs/TESTES.md.
 */

const PORTA = 3210
const BASE_URL = `http://127.0.0.1:${PORTA}`

const ambiente = {
  NODE_ENV: 'development',
  DATABASE_URL: 'file:./prisma/e2e.db',
  APP_URL: BASE_URL,
  AUTH_SECRET: 'segredo-de-testes-ponta-a-ponta-com-32-chars',
  STORAGE_DIR: 'storage/e2e-uploads',
  UPLOAD_MAX_FILE_MB: '8',
  UPLOAD_MAX_FILES_PER_LISTING: '12',
  MAIL_TRANSPORT: 'console',
  MAIL_FROM: 'Motriz <nao-responda@motriz.local>',
  MODERATION_ENABLED: 'true',
}

export default defineConfig({
  testDir: path.join('tests', 'e2e'),
  // Um usuário por vez: os cenários compartilham o mesmo banco SQLite.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // O site respeita prefers-reduced-motion. Rodar assim tira as transições
    // de hover do caminho do clique (um card que se desloca nunca fica
    // 'estável' para o Playwright) e ainda exercita esse suporte.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      // responsivo.spec.ts só faz sentido em largura de celular: nesta largura
      // o menu e o painel de filtros nem existem na tela.
      testIgnore: /responsivo.spec.ts/,
    },
    {
      name: 'celular',
      use: { ...devices['Pixel 7'] },
      testMatch: /responsivo\.spec\.ts/,
    },
  ],

  webServer: {
    // O preparo do banco entra aqui, e não no globalSetup, porque o Playwright
    // sobe o webServer ANTES do globalSetup — ver tests/e2e/preparar.ts.
    command: `npx tsx tests/e2e/preparar.ts && npx next dev --port ${PORTA}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: ambiente,
  },
})

export { ambiente, BASE_URL, PORTA }
