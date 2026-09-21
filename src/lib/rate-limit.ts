import { prisma } from './db'

/**
 * Limitação de requisições por janela fixa, persistida no banco.
 *
 * Escolha consciente: com uma única instância e SQLite, o banco é o lugar mais
 * simples que sobrevive a reinício do processo. Em várias instâncias isso
 * precisa migrar para Redis — está registrado em docs/PENDENCIAS.md.
 */

export type RateLimitRule = {
  /** Quantas tentativas cabem na janela. */
  limit: number
  /** Tamanho da janela em segundos. */
  windowSec: number
}

export const RATE_LIMITS = {
  login: { limit: 8, windowSec: 600 }, // 8 tentativas / 10 min
  signup: { limit: 5, windowSec: 3600 },
  passwordReset: { limit: 5, windowSec: 3600 },
  upload: { limit: 60, windowSec: 3600 },
  createListing: { limit: 20, windowSec: 3600 },
  report: { limit: 10, windowSec: 3600 },
  contact: { limit: 20, windowSec: 3600 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitName = keyof typeof RATE_LIMITS

export type RateLimitResult = {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

/**
 * Consome uma unidade do limite identificado por `name` + `identifier`
 * (normalmente IP, e-mail ou id do usuário). Retorna ok:false quando estourou.
 */
export async function consumeRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name]
  const key = `${name}:${identifier}`
  const now = new Date()
  const windowMs = rule.windowSec * 1000

  const existing = await prisma.rateLimit.findUnique({ where: { key } })

  if (!existing || now.getTime() - existing.windowStart.getTime() >= windowMs) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    })
    return { ok: true, remaining: rule.limit - 1, retryAfterSec: 0 }
  }

  if (existing.count >= rule.limit) {
    const retryAfterSec = Math.ceil(
      (existing.windowStart.getTime() + windowMs - now.getTime()) / 1000,
    )
    return { ok: false, remaining: 0, retryAfterSec: Math.max(retryAfterSec, 1) }
  }

  const updated = await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  })

  return { ok: true, remaining: Math.max(rule.limit - updated.count, 0), retryAfterSec: 0 }
}

/** Zera o contador após uma operação bem-sucedida (ex.: login correto). */
export async function resetRateLimit(name: RateLimitName, identifier: string) {
  await prisma.rateLimit.deleteMany({ where: { key: `${name}:${identifier}` } })
}

/** Remove janelas antigas. Chamado pelo seed e pode virar tarefa agendada. */
export async function pruneRateLimits() {
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24)
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } })
}
