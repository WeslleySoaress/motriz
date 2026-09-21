import { isProd } from './env'

/**
 * Log estruturado e enxuto.
 *
 * Regras: nunca registrar senha, token, hash, cookie ou corpo bruto de
 * requisição. E-mails são mascarados. Em produção o stack trace fica no log do
 * servidor e **nunca** vai para a resposta HTTP.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'passwordhash',
  'token',
  'tokenhash',
  'authorization',
  'cookie',
  'secret',
  'authsecret',
])

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[profundo]'
  if (value === null || value === undefined) return value
  if (value instanceof Error) return { name: value.name, message: value.message }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[oculto]' : redact(v, depth + 1)
    }
    return out
  }
  return value
}

/** ma***@exemplo.com — suficiente para suporte, sem expor a conta. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const head = local.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`
}

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  if (level === 'debug' && isProd) return
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? { ctx: redact(context) } : {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
}

/**
 * Converte um erro interno em mensagem segura para o usuário.
 * O detalhe real vai só para o log, com um id de correlação que a pessoa pode
 * informar ao suporte.
 */
export function toPublicError(error: unknown, context?: Record<string, unknown>) {
  const id = crypto.randomUUID().slice(0, 8)
  logger.error('erro não tratado', { id, error, ...context })
  return {
    message: 'Não foi possível concluir a operação. Tente novamente em instantes.',
    errorId: id,
  }
}
