import { z } from 'zod'

/**
 * Configuração da aplicação vinda exclusivamente do ambiente.
 * Validada uma única vez na inicialização do servidor: se algo obrigatório
 * estiver ausente ou malformado, o processo falha cedo e com mensagem clara,
 * em vez de quebrar no meio de uma requisição.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  APP_URL: z.url().default('http://localhost:3000'),
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET precisa de pelo menos 32 caracteres (use 32 bytes em hex)'),
  STORAGE_DIR: z.string().default('storage/uploads'),
  UPLOAD_MAX_FILE_MB: z.coerce.number().int().positive().max(50).default(8),
  UPLOAD_MAX_FILES_PER_LISTING: z.coerce.number().int().positive().max(40).default(12),
  MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
  MAIL_FROM: z.string().default('Motriz <nao-responda@motriz.local>'),
  MODERATION_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
})

function load() {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(
      `Variáveis de ambiente inválidas:\n${issues.join('\n')}\n\nCopie .env.example para .env e preencha os valores.`,
    )
  }
  return parsed.data
}

export const env = load()

export const isProd = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

/** Limite de upload em bytes, derivado de UPLOAD_MAX_FILE_MB. */
export const UPLOAD_MAX_BYTES = env.UPLOAD_MAX_FILE_MB * 1024 * 1024
