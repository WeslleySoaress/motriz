import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSessionToken, validateSessionToken, type SessionUser } from './session'
import { env } from './env'

/**
 * Autorização. Regra do projeto: **toda** rota, server action e route handler
 * que lê ou escreve dado privado chama uma destas funções. Não há checagem de
 * permissão feita apenas no middleware ou no cliente — as duas podem ser
 * contornadas por requisição direta.
 */

/**
 * `cache` deduplica a consulta dentro da mesma requisição: layout, página e
 * componentes podem pedir o usuário sem gerar N consultas ao banco.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await getSessionToken()
  if (!token) return null
  return validateSessionToken(token)
})

export async function requireUser(redirectTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    const next = redirectTo ? `?proximo=${encodeURIComponent(redirectTo)}` : ''
    redirect(`/entrar${next}`)
  }
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar?proximo=%2Fadmin')
  if (user.role !== 'ADMIN') {
    // 404 em vez de 403: não confirma a existência da área para quem não pode
    // acessá-la.
    const { notFound } = await import('next/navigation')
    notFound()
  }
  return user
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/** Versão para route handlers: lança em vez de redirecionar. */
export async function requireUserApi(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('Autenticação necessária.', 401)
  return user
}

export async function requireAdminApi(): Promise<SessionUser> {
  const user = await requireUserApi()
  if (user.role !== 'ADMIN') throw new AuthError('Recurso não encontrado.', 404)
  return user
}

/**
 * Defesa contra CSRF para route handlers que alteram estado.
 *
 * Os cookies são SameSite=Lax, o que já bloqueia POST cross-site; esta
 * verificação é a segunda camada e cobre também `fetch` de outras origens.
 * Server Actions do Next fazem sua própria checagem de Origin internamente.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers()
  const origin = h.get('origin')
  const secFetchSite = h.get('sec-fetch-site')

  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    throw new AuthError('Origem não permitida.', 403)
  }

  if (origin) {
    const allowed = new Set([env.APP_URL])
    const host = h.get('host')
    if (host) {
      allowed.add(`http://${host}`)
      allowed.add(`https://${host}`)
    }
    if (!allowed.has(origin)) {
      throw new AuthError('Origem não permitida.', 403)
    }
  }
}

/** IP do cliente, para limitação de requisições. */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'desconhecido'
  return h.get('x-real-ip') ?? 'desconhecido'
}

export async function getUserAgent(): Promise<string | null> {
  const h = await headers()
  return h.get('user-agent')
}
