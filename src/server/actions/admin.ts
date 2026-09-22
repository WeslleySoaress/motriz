'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger, toPublicError } from '@/lib/logger'
import { listingModeratedMessage, sendMail } from '@/lib/mail'
import { invalidateAllSessions } from '@/lib/session'
import {
  fieldErrors,
  moderationSchema,
  resolveReportSchema,
  suspendUserSchema,
  type FieldErrors,
} from '@/lib/validation'
import type { AdminActionType } from '@/lib/enums'

export type ActionState = { ok: boolean; message?: string; errors?: FieldErrors }

/**
 * Ações administrativas.
 *
 * Duas regras valem para todas elas:
 *  1. A autorização é conferida **no servidor**, aqui, a cada chamada. Não
 *     basta a rota /admin estar protegida: uma server action é um endpoint.
 *  2. Nada acontece sem registro. Toda ação grava uma linha em AdminAction com
 *     autor, alvo, motivo e estado anterior — é o histórico exigido para
 *     auditar decisões de moderação.
 */
async function requireAdminActor() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    logger.warn('tentativa de ação administrativa sem permissão', { userId: user?.id })
    return null
  }
  return user
}

/**
 * Monta a gravação do registro de auditoria **sem executá-la**, para que ela
 * entre na mesma transação da alteração que descreve.
 *
 * Gravar as duas separadamente permitia que a alteração passasse e o registro
 * falhasse, deixando um anúncio tirado do ar ou uma conta suspensa sem
 * histórico de quem fez e por quê. Como a promessa do projeto é que toda ação
 * administrativa deixa rastro, as duas gravações precisam ser uma só: ou
 * acontecem juntas, ou nenhuma acontece.
 */
function auditoria(input: {
  adminId: string
  action: AdminActionType
  targetType: 'LISTING' | 'USER' | 'REPORT'
  targetId: string
  reason?: string | null
  metadata?: Record<string, unknown>
}) {
  return prisma.adminAction.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  })
}

// ─── Moderação de anúncios ───────────────────────────────────────────────────

export async function moderateListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminActor()
  if (!admin) return { ok: false, message: 'Ação não permitida.' }

  const parsed = moderationSchema.safeParse({
    listingId: formData.get('listingId'),
    decision: formData.get('decision'),
    reason: formData.get('reason') ?? '',
  })

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const { listingId, decision, reason } = parsed.data

  if (decision === 'REJECT' && (!reason || reason.trim().length < 5)) {
    return {
      ok: false,
      errors: { reason: 'Descreva o motivo da rejeição — ele é mostrado ao anunciante.' },
    }
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      status: true,
      slug: true,
      brand: true,
      model: true,
      trim: true,
      seller: { select: { id: true, name: true, email: true } },
    },
  })

  if (!listing) return { ok: false, message: 'Anúncio não encontrado.' }

  const approved = decision === 'APPROVE'
  const title = `${listing.brand} ${listing.model} ${listing.trim}`.trim()

  try {
    await prisma.$transaction([
      prisma.listing.update({
        where: { id: listing.id },
        data: approved
          ? {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              moderatedAt: new Date(),
              rejectionReason: null,
            }
          : {
              status: 'REJECTED',
              moderatedAt: new Date(),
              publishedAt: null,
              rejectionReason: reason ?? null,
            },
      }),
      auditoria({
        adminId: admin.id,
        action: approved ? 'LISTING_APPROVE' : 'LISTING_REJECT',
        targetType: 'LISTING',
        targetId: listing.id,
        reason: approved ? null : reason,
        metadata: {
          statusAnterior: listing.status,
          statusNovo: approved ? 'PUBLISHED' : 'REJECTED',
        },
      }),
    ])

    await sendMail({
      to: listing.seller.email,
      ...listingModeratedMessage(listing.seller.name, title, approved, reason),
    }).catch((error) => logger.warn('falha ao notificar anunciante', { error }))

    revalidatePath('/admin/anuncios')
    revalidatePath('/catalogo')
    revalidatePath('/')

    return {
      ok: true,
      message: approved ? 'Anúncio aprovado e publicado.' : 'Anúncio rejeitado e anunciante avisado.',
    }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'moderateListing' })
    return { ok: false, message }
  }
}

/** Tira do ar um anúncio já publicado (sem excluir), com motivo obrigatório. */
export async function suspendListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminActor()
  if (!admin) return { ok: false, message: 'Ação não permitida.' }

  const listingId = String(formData.get('listingId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (reason.length < 5) {
    return { ok: false, errors: { reason: 'Descreva o motivo da suspensão.' } }
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, status: true, seller: { select: { email: true, name: true } }, brand: true, model: true, trim: true },
  })
  if (!listing) return { ok: false, message: 'Anúncio não encontrado.' }

  try {
    await prisma.$transaction([
      prisma.listing.update({
        where: { id: listing.id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          moderatedAt: new Date(),
          publishedAt: null,
        },
      }),
      auditoria({
        adminId: admin.id,
        action: 'LISTING_SUSPEND',
        targetType: 'LISTING',
        targetId: listing.id,
        reason,
        metadata: { statusAnterior: listing.status },
      }),
    ])

    await sendMail({
      to: listing.seller.email,
      ...listingModeratedMessage(
        listing.seller.name,
        `${listing.brand} ${listing.model} ${listing.trim}`.trim(),
        false,
        reason,
      ),
    }).catch(() => {})

    revalidatePath('/admin/anuncios')
    revalidatePath('/catalogo')
    return { ok: true, message: 'Anúncio suspenso e retirado do catálogo.' }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'suspendListing' })
    return { ok: false, message }
  }
}

// ─── Contas ──────────────────────────────────────────────────────────────────

export async function suspendUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminActor()
  if (!admin) return { ok: false, message: 'Ação não permitida.' }

  const parsed = suspendUserSchema.safeParse({
    userId: formData.get('userId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const { userId, reason } = parsed.data

  if (userId === admin.id) {
    return { ok: false, message: 'Você não pode suspender a própria conta.' }
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true },
  })
  if (!target) return { ok: false, message: 'Conta não encontrada.' }
  if (target.role === 'ADMIN') {
    return { ok: false, message: 'Contas administradoras não podem ser suspensas por aqui.' }
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { status: 'SUSPENDED', suspendedAt: new Date(), suspendedReason: reason },
      }),
      // Anúncios da conta saem do ar junto.
      prisma.listing.updateMany({
        where: { sellerId: userId, status: { in: ['PUBLISHED', 'PENDING'] } },
        data: { status: 'PAUSED' },
      }),
      auditoria({
        adminId: admin.id,
        action: 'USER_SUSPEND',
        targetType: 'USER',
        targetId: userId,
        reason,
        metadata: { statusAnterior: target.status },
      }),
    ])

    // Derruba as sessões: a suspensão vale a partir de agora, não do próximo
    // login. Fica fora da transação de propósito — apagar sessão é idempotente
    // e, se falhar, a próxima requisição da conta suspensa já é recusada por
    // `validateSessionToken`.
    await invalidateAllSessions(userId)

    revalidatePath('/admin/usuarios')
    revalidatePath('/catalogo')
    return { ok: true, message: 'Conta suspensa. Os anúncios dela saíram do catálogo.' }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'suspendUser' })
    return { ok: false, message }
  }
}

export async function reinstateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminActor()
  if (!admin) return { ok: false, message: 'Ação não permitida.' }

  const userId = String(formData.get('userId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim() || null

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } })
  if (!target) return { ok: false, message: 'Conta não encontrada.' }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
      }),
      auditoria({
        adminId: admin.id,
        action: 'USER_REINSTATE',
        targetType: 'USER',
        targetId: userId,
        reason,
        metadata: { statusAnterior: target.status },
      }),
    ])

    revalidatePath('/admin/usuarios')
    return {
      ok: true,
      message: 'Conta reativada. Os anúncios continuam pausados até o dono publicá-los.',
    }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'reinstateUser' })
    return { ok: false, message }
  }
}

// ─── Denúncias ───────────────────────────────────────────────────────────────

export async function resolveReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminActor()
  if (!admin) return { ok: false, message: 'Ação não permitida.' }

  const parsed = resolveReportSchema.safeParse({
    reportId: formData.get('reportId'),
    decision: formData.get('decision'),
    note: formData.get('note') ?? '',
  })
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const { reportId, decision, note } = parsed.data

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, listingId: true },
  })
  if (!report) return { ok: false, message: 'Denúncia não encontrada.' }

  try {
    await prisma.$transaction([
      prisma.report.update({
        where: { id: reportId },
        data: {
          status: decision,
          handledById: admin.id,
          handledAt: new Date(),
          resolutionNote: note || null,
        },
      }),
      auditoria({
        adminId: admin.id,
        action: decision === 'ACTIONED' ? 'REPORT_ACTIONED' : 'REPORT_DISMISSED',
        targetType: 'REPORT',
        targetId: reportId,
        reason: note,
        metadata: { listingId: report.listingId, statusAnterior: report.status },
      }),
    ])

    revalidatePath('/admin/denuncias')
    return {
      ok: true,
      message: decision === 'ACTIONED' ? 'Denúncia marcada como acatada.' : 'Denúncia arquivada.',
    }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'resolveReport' })
    return { ok: false, message }
  }
}
