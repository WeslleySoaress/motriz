import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.dirname(fileURLToPath(import.meta.url))

/**
 * Testes de unidade e de integração.
 *
 * `server-only` é substituído por um módulo vazio: esse pacote existe para
 * quebrar o build quando um módulo de servidor é importado no cliente, e fora
 * do runtime do Next ele lançaria erro em todo import.
 *
 * O banco de teste é um arquivo SQLite separado (prisma/test.db), criado pelo
 * globalSetup. Nenhum teste toca o banco de desenvolvimento.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./prisma/test.db',
      APP_URL: 'http://localhost:3000',
      AUTH_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok',
      STORAGE_DIR: 'storage/test-uploads',
      UPLOAD_MAX_FILE_MB: '8',
      UPLOAD_MAX_FILES_PER_LISTING: '12',
      MAIL_TRANSPORT: 'console',
      MODERATION_ENABLED: 'true',
    },
    // bcrypt com custo 12 e o sharp deixam alguns testes naturalmente lentos.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    // SQLite não gosta de várias conexões escrevendo ao mesmo tempo no mesmo
    // arquivo; um arquivo de teste por vez mantém a suíte determinística.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(raiz, 'src'),
      'server-only': path.resolve(raiz, 'tests/stubs/server-only.ts'),
    },
  },
})
