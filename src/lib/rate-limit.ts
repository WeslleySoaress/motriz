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
  // Início da janela ainda válida: qualquer registro mais antigo que isto já
  // expirou e deve ser reiniciado.
  const inicioValido = new Date(now.getTime() - windowMs)

  // 1. Consumo do caso comum, numa única instrução atômica. A condição
  //    `count < limit` faz parte do WHERE, então o banco decide se há vaga no
  //    mesmo comando que incrementa. Ler primeiro e incrementar depois deixava
  //    uma janela em que várias requisições liam o mesmo contador e passavam
  //    todas — com o limite de login, isso significava mais tentativas de
  //    senha do que o declarado.
  const consumido = await prisma.rateLimit.updateMany({
    where: { key, windowStart: { gte: inicioValido }, count: { lt: rule.limit } },
    data: { count: { increment: 1 } },
  })

  if (consumido.count === 1) {
    const atual = await prisma.rateLimit.findUnique({ where: { key }, select: { count: true } })
    return {
      ok: true,
      remaining: Math.max(rule.limit - (atual?.count ?? rule.limit), 0),
      retryAfterSec: 0,
    }
  }

  // 2. Não consumiu. Ou a janela expirou, ou o limite estourou, ou não existe
  //    registro. Reiniciar uma janela vencida também é condicional: se outra
  //    requisição reiniciou primeiro, esta não sobrescreve o contador dela.
  const reiniciado = await prisma.rateLimit.updateMany({
    where: { key, windowStart: { lt: inicioValido } },
    data: { count: 1, windowStart: now },
  })

  if (reiniciado.count === 1) {
    return { ok: true, remaining: rule.limit - 1, retryAfterSec: 0 }
  }

  // 3. Primeira vez para esta chave. O create pode colidir com outra
  //    requisição simultânea criando a mesma linha; nesse caso a chave única
  //    faz o create falhar, e quem perdeu a corrida tenta consumir de novo.
  try {
    await prisma.rateLimit.create({ data: { key, count: 1, windowStart: now } })
    return { ok: true, remaining: rule.limit - 1, retryAfterSec: 0 }
  } catch {
    const disputado = await prisma.rateLimit.updateMany({
      where: { key, windowStart: { gte: inicioValido }, count: { lt: rule.limit } },
      data: { count: { increment: 1 } },
    })
    if (disputado.count === 1) {
      return { ok: true, remaining: 0, retryAfterSec: 0 }
    }
  }

  // 4. Limite estourado dentro da janela vigente.
  const existente = await prisma.rateLimit.findUnique({
    where: { key },
    select: { windowStart: true },
  })
  const fim = (existente?.windowStart.getTime() ?? now.getTime()) + windowMs
  return {
    ok: false,
    remaining: 0,
    retryAfterSec: Math.max(Math.ceil((fim - now.getTime()) / 1000), 1),
  }
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
