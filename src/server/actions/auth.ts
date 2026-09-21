'use server'

import { createHash, randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { getClientIp, getCurrentUser, getUserAgent } from '@/lib/auth'
import { hashPassword, verifyPassword, fakeVerify } from '@/lib/password'
import {
  clearSessionCookie,
  createSession,
  getSessionToken,
  invalidateAllSessions,
  invalidateSession,
  setSessionCookie,
} from '@/lib/session'
import { consumeRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { logger, maskEmail, toPublicError } from '@/lib/logger'
import { resetPasswordMessage, sendMail, verifyEmailMessage } from '@/lib/mail'
import {
  changePasswordSchema,
  fieldErrors,
  loginSchema,
  profileSchema,
  requestResetSchema,
  resetPasswordSchema,
  signupSchema,
  type FieldErrors,
} from '@/lib/validation'

/**
 * Ações de conta.
 *
 * Postura adotada contra enumeração de contas: cadastro, login e recuperação
 * respondem a mesma coisa para e-mail existente e inexistente. Quem tenta
 * descobrir se "fulano@exemplo.com" tem conta aqui recebe sempre a mesma tela.
 */

export type ActionState = {
  ok: boolean
  message?: string
  errors?: FieldErrors
}


const TOKEN_TTL = {
  EMAIL_VERIFY: 1000 * 60 * 60 * 24, // 24 h
  PASSWORD_RESET: 1000 * 60 * 60, // 1 h
} as const

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function issueToken(userId: string, type: keyof typeof TOKEN_TTL) {
  // Só um token válido por tipo: pedir um novo invalida o anterior.
  await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } })
  const token = randomBytes(32).toString('base64url')
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL[type]),
    },
  })
  return token
}

// ─── Cadastro ────────────────────────────────────────────────────────────────

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await getClientIp()
  const limit = await consumeRateLimit('signup', ip)
  if (!limit.ok) {
    return {
      ok: false,
      message: `Muitas tentativas de cadastro. Tente novamente em ${Math.ceil(limit.retryAfterSec / 60)} minutos.`,
    }
  }

  const parsed = signupSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) }
  }

  const { name, email, password } = parsed.data

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })

    if (existing) {
      // Conta já existe: em vez de revelar isso, avisamos o dono do endereço.
      await sendMail({
        to: email,
        subject: 'Tentativa de cadastro na Motriz',
        text: [
          `Olá, ${existing.name}.`,
          '',
          'Alguém tentou criar uma conta na Motriz com este e-mail, que já está cadastrado.',
          'Se foi você, entre normalmente ou use "Esqueci minha senha".',
          'Se não foi, ignore esta mensagem.',
        ].join('\n'),
      }).catch((error) => logger.warn('falha ao enviar aviso de cadastro duplicado', { error }))

      logger.info('cadastro com e-mail já existente', { email: maskEmail(email) })
      return { ok: true, message: 'verificacao-enviada' }
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
      select: { id: true, name: true },
    })

    const token = await issueToken(user.id, 'EMAIL_VERIFY')
    const link = `${env.APP_URL}/verificar-email?token=${encodeURIComponent(token)}`
    await sendMail({ to: email, ...verifyEmailMessage(user.name, link) })

    logger.info('conta criada', { userId: user.id })
    return { ok: true, message: 'verificacao-enviada' }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'signup' })
    return { ok: false, message }
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) }
  }

  const { email, password } = parsed.data
  const next = String(formData.get('proximo') ?? '')
  const ip = await getClientIp()

  // Dois limites: por IP (ataque distribuído em várias contas) e por e-mail
  // (força bruta em uma conta específica a partir de vários IPs).
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit('login', ip),
    consumeRateLimit('login', `email:${email}`),
  ])

  if (!byIp.ok || !byEmail.ok) {
    const wait = Math.max(byIp.retryAfterSec, byEmail.retryAfterSec)
    return {
      ok: false,
      message: `Muitas tentativas. Aguarde ${Math.ceil(wait / 60)} minutos antes de tentar de novo.`,
    }
  }

  const GENERIC = 'E-mail ou senha incorretos.'

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, status: true, suspendedReason: true },
    })

    if (!user) {
      // Gasta o mesmo tempo de um bcrypt real para não vazar por temporização.
      await fakeVerify(password)
      return { ok: false, message: GENERIC }
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      logger.warn('login com senha incorreta', { email: maskEmail(email) })
      return { ok: false, message: GENERIC }
    }

    if (user.status !== 'ACTIVE') {
      return {
        ok: false,
        message: `Esta conta está suspensa.${
          user.suspendedReason ? ` Motivo: ${user.suspendedReason}` : ''
        } Fale com o suporte.`,
      }
    }

    const { token, expiresAt } = await createSession(user.id, {
      ip,
      userAgent: await getUserAgent(),
    })
    await setSessionCookie(token, expiresAt)

    await Promise.all([resetRateLimit('login', ip), resetRateLimit('login', `email:${email}`)])
    logger.info('login bem-sucedido', { userId: user.id })
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'login' })
    return { ok: false, message }
  }

  // redirect() lança internamente — precisa ficar fora do try/catch.
  redirect(safeNext(next))
}

/**
 * Só aceitamos redirecionamento para caminho interno. Sem isso, um link como
 * /entrar?proximo=https://site-falso levaria a pessoa para fora depois do
 * login (open redirect).
 */
function safeNext(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/painel'
  return value
}

export async function logoutAction() {
  const token = await getSessionToken()
  if (token) await invalidateSession(token)
  await clearSessionCookie()
  redirect('/')
}

// ─── Recuperação de senha ────────────────────────────────────────────────────

export async function requestResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ip = await getClientIp()
  const limit = await consumeRateLimit('passwordReset', ip)
  if (!limit.ok) {
    return {
      ok: false,
      message: `Muitos pedidos. Tente novamente em ${Math.ceil(limit.retryAfterSec / 60)} minutos.`,
    }
  }

  const parsed = requestResetSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const { email } = parsed.data

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })

    if (user) {
      const token = await issueToken(user.id, 'PASSWORD_RESET')
      const link = `${env.APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`
      await sendMail({ to: email, ...resetPasswordMessage(user.name, link) })
    }

    // Resposta idêntica para e-mail cadastrado e não cadastrado.
    return { ok: true, message: 'enviado' }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'requestReset' })
    return { ok: false, message }
  }
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const { token, password } = parsed.data

  try {
    const record = await prisma.authToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true },
    })

    const invalid =
      !record ||
      record.type !== 'PASSWORD_RESET' ||
      record.usedAt !== null ||
      record.expiresAt.getTime() <= Date.now()

    if (invalid) {
      return {
        ok: false,
        message: 'Este link expirou ou já foi usado. Peça um novo para redefinir sua senha.',
      }
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ])

    // Troca de senha derruba todas as sessões: se alguém estava dentro da
    // conta indevidamente, perde o acesso imediatamente.
    await invalidateAllSessions(record.userId)
    logger.info('senha redefinida', { userId: record.userId })

    return { ok: true, message: 'redefinida' }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'resetPassword' })
    return { ok: false, message }
  }
}

// ─── Verificação de e-mail ───────────────────────────────────────────────────

export type VerifyResult = 'ok' | 'ja-verificado' | 'invalido'

export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  if (!token) return 'invalido'

  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true },
  })

  if (!record || record.type !== 'EMAIL_VERIFY') return 'invalido'
  if (record.usedAt) return 'ja-verificado'
  if (record.expiresAt.getTime() <= Date.now()) return 'invalido'

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  logger.info('e-mail verificado', { userId: record.userId })
  return 'ok'
}

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Faça login para reenviar a confirmação.' }
  if (user.emailVerifiedAt) return { ok: true, message: 'Seu e-mail já está confirmado.' }

  const limit = await consumeRateLimit('passwordReset', `verify:${user.id}`)
  if (!limit.ok) {
    return {
      ok: false,
      message: `Aguarde ${Math.ceil(limit.retryAfterSec / 60)} minutos para pedir outro e-mail.`,
    }
  }

  const token = await issueToken(user.id, 'EMAIL_VERIFY')
  const link = `${env.APP_URL}/verificar-email?token=${encodeURIComponent(token)}`
  await sendMail({ to: user.email, ...verifyEmailMessage(user.name, link) })

  return { ok: true, message: 'Enviamos um novo link de confirmação para o seu e-mail.' }
}

// ─── Perfil ──────────────────────────────────────────────────────────────────

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Sessão expirada. Entre novamente.' }

  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    city: formData.get('city') ?? '',
    state: formData.get('state') ?? '',
    bio: formData.get('bio') ?? '',
    showPhone: formData.get('showPhone') === 'on',
    showEmail: formData.get('showEmail') === 'on',
  })

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const d = parsed.data

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: d.name,
        phone: d.phone ? d.phone : null,
        city: d.city ? d.city : null,
        state: d.state ? d.state : null,
        bio: d.bio ? d.bio : null,
        // Não dá para expor o telefone sem ter telefone cadastrado.
        showPhone: d.showPhone && Boolean(d.phone),
        showEmail: d.showEmail,
      },
    })

    revalidatePath('/conta')
    return { ok: true, message: 'Perfil atualizado.' }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'updateProfile' })
    return { ok: false, message }
  }
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Sessão expirada. Entre novamente.' }

  const parsed = changePasswordSchema.safeParse({
    current: formData.get('current'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    })
    if (!record) return { ok: false, message: 'Conta não encontrada.' }

    const valid = await verifyPassword(parsed.data.current, record.passwordHash)
    if (!valid) {
      return { ok: false, errors: { current: 'Senha atual incorreta.' } }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    })

    // Mantemos a sessão atual e encerramos as demais.
    const currentToken = await getSessionToken()
    await invalidateAllSessions(user.id)
    if (currentToken) {
      const { token, expiresAt } = await createSession(user.id, {
        ip: await getClientIp(),
        userAgent: await getUserAgent(),
      })
      await setSessionCookie(token, expiresAt)
    }

    return { ok: true, message: 'Senha alterada. As outras sessões foram encerradas.' }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'changePassword' })
    return { ok: false, message }
  }
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Sessão expirada. Entre novamente.' }

  const confirmation = String(formData.get('confirmacao') ?? '').trim()
  if (confirmation !== 'EXCLUIR') {
    return { ok: false, errors: { confirmacao: 'Digite EXCLUIR para confirmar.' } }
  }

  const password = String(formData.get('password') ?? '')
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  })
  if (!record || !(await verifyPassword(password, record.passwordHash))) {
    return { ok: false, errors: { password: 'Senha incorreta.' } }
  }

  try {
    // As imagens no disco são removidas antes: o cascade do banco apagaria os
    // registros e deixaria arquivos órfãos.
    const images = await prisma.listingImage.findMany({
      where: { listing: { sellerId: user.id } },
      select: { storageKey: true, thumbKey: true },
    })
    const { deleteObjects } = await import('@/lib/storage')
    await deleteObjects(images.flatMap((i) => [i.storageKey, i.thumbKey]))

    await prisma.user.delete({ where: { id: user.id } })
    await clearSessionCookie()
    logger.info('conta excluída pelo próprio usuário', { userId: user.id })
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'deleteAccount' })
    return { ok: false, message }
  }

  redirect('/?conta=excluida')
}

