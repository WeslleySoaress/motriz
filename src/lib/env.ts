import { z } from 'zod'

/**
 * Configuração da aplicação vinda exclusivamente do ambiente.
 * Validada uma única vez na inicialização do servidor: se algo obrigatório
 * estiver ausente ou malformado, o processo falha cedo e com mensagem clara,
 * em vez de quebrar no meio de uma requisição.
 */
export const schema = z.object({
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
  // Só fazem sentido com MAIL_TRANSPORT="smtp"; a checagem cruzada está abaixo.
  MAIL_SMTP_HOST: z.string().optional(),
  MAIL_SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  MAIL_SMTP_USER: z.string().optional(),
  MAIL_SMTP_PASSWORD: z.string().optional(),
  MAIL_SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MODERATION_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
})
  // Escolher "smtp" sem credencial derrubaria o envio só na hora em que
  // alguém pedisse recuperação de senha — o pior momento para descobrir. A
  // checagem acontece na inicialização.
  .superRefine((cfg, ctx) => {
    if (cfg.MAIL_TRANSPORT !== 'smtp') return
    for (const campo of ['MAIL_SMTP_HOST', 'MAIL_SMTP_USER', 'MAIL_SMTP_PASSWORD'] as const) {
      if (!cfg[campo]) {
        ctx.addIssue({
          code: 'custom',
          path: [campo],
          message: `${campo} é obrigatória quando MAIL_TRANSPORT="smtp"`,
        })
      }
    }
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
