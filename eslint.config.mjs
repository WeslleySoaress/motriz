import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Configuração plana do ESLint.
 *
 * O `eslint-config-next` 16 já exporta configuração plana, então não usamos
 * `FlatCompat` — a ponte de compatibilidade quebra com o ESLint 10
 * ("Converting circular structure to JSON").
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'storage/**',
      'src/generated/**',
      'test-results/**',
      'playwright-report/**',
      'scripts/.cache/**',
      'log/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]

export default config
