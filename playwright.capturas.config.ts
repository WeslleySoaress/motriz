import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

/**
 * Configuração separada, só para gerar as capturas de tela da documentação.
 *
 * Roda contra o banco de **desenvolvimento** (`prisma/dev.db`), porque é ele
 * que tem os anúncios de demonstração com as fotografias reais baixadas do
 * Wikimedia Commons. Não faz nenhuma asserção: apenas navega e fotografa.
 *
 * Uso: npm run capturas   (exige `npm run db:seed` antes)
 */

const PORTA = 3220
const BASE_URL = `http://127.0.0.1:${PORTA}`

export default defineConfig({
  testDir: path.join('tests', 'capturas'),
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // As fotos precisam estar carregadas antes do clique do obturador.
    actionTimeout: 20_000,
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'celular',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: `npx next dev --port ${PORTA}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
