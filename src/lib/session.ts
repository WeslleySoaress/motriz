import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from './db'
import { isProd } from './env'

export const SESSION_COOKIE = 'motriz_session'

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 dias
const SESSION_RENEW_MS = 1000 * 60 * 60 * 24 * 15 // renova quando faltam 15 dias

/**
 * O cookie carrega apenas um segredo aleatório de 32 bytes. O banco guarda
 * somente o SHA-256 dele, então um dump do banco não permite assumir sessões.
 * SHA-256 (e não bcrypt) é adequado aqui porque o segredo já tem entropia alta
 * — não há dicionário a atacar — e a verificação precisa ser rápida.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export type SessionContext = {
  ip?: string | null
  userAgent?: string | null
}

export async function createSession(userId: string, ctx: SessionContext = {}) {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await prisma.session.create({
    data: {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent?.slice(0, 255) ?? null,
    },
  })

  return { token, expiresAt }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    expires: expiresAt,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 0,
  })
}

export type SessionUser = {
  id: string
  email: string
  name: string
  role: string
  status: string
  emailVerifiedAt: Date | null
  city: string | null
  state: string | null
}

/**
 * Valida o token de sessão contra o banco.
 * Retorna null para sessão inexistente, expirada ou de conta suspensa —
 * a suspensão tem efeito imediato, sem esperar o cookie expirar.
 */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          city: true,
          state: true,
        },
      },
    },
  })

  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  if (session.user.status !== 'ACTIVE') {
    // Conta suspensa: derruba todas as sessões dela.
    await prisma.session.deleteMany({ where: { userId: session.userId } }).catch(() => {})
    return null
  }

  // Renovação deslizante: evita expirar a sessão de quem usa a plataforma com
  // frequência, sem estender indefinidamente sessões abandonadas.
  if (session.expiresAt.getTime() - Date.now() < SESSION_RENEW_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS), lastUsedAt: new Date() },
      })
      .catch(() => {})
  }

  return session.user
}

export async function invalidateSession(token: string) {
  if (!token) return
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
}

/** Usado após troca de senha: encerra todas as sessões do usuário. */
export async function invalidateAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } })
}

export async function getSessionToken(): Promise<string | null> {
  // Fora de uma requisição HTTP (script, seed, teste) não há cookie algum.
  // Nesse caso a resposta correta é 'ninguém autenticado', não um erro.
  try {
    const store = await cookies()
    return store.get(SESSION_COOKIE)?.value ?? null
  } catch {
    return null
  }
}
