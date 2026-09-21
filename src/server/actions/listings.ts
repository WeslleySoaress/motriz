'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { getClientIp, getCurrentUser } from '@/lib/auth'
import { consumeRateLimit } from '@/lib/rate-limit'
import { logger, toPublicError } from '@/lib/logger'
import { sendMail } from '@/lib/mail'
import { deleteObjects } from '@/lib/storage'
import { buildListingSlug, shortSuffix } from '@/lib/slug'
import { parsePriceToCents } from '@/lib/format'
import {
  fieldErrors,
  listingCoreSchema,
  listingDraftSchema,
  reportSchema,
  contactMessageSchema,
  type FieldErrors,
} from '@/lib/validation'
import { FEATURES, type Feature, type ListingStatus } from '@/lib/enums'
import {
  canDelete,
  canEdit,
  canSellerTransition,
  publishBlockers,
  PUBLISH_BLOCKER_LABELS,
  statusOnPublishRequest,
  statusSideEffects,
} from '@/server/listing-rules'

export type ActionState = {
  ok: boolean
  message?: string
  errors?: FieldErrors
  listingId?: string
}

/**
 * Ações do anúncio.
 *
 * Toda ação começa identificando o usuário pela sessão do servidor e
 * confirmando a propriedade do anúncio. Nenhum id de dono vem do formulário —
 * se viesse, bastaria trocá-lo para editar o anúncio de outra pessoa.
 */

async function loadOwned(listingId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessão expirada. Entre novamente.' as const }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      slug: true,
      brand: true,
      model: true,
      trim: true,
      modelYear: true,
      color: true,
      _count: { select: { images: true } },
    },
  })

  if (!listing) return { error: 'Anúncio não encontrado.' as const }
  if (!canEdit(listing, user)) {
    // Mesma resposta de "não existe": não confirmamos que o anúncio é de
    // outra pessoa.
    logger.warn('tentativa de editar anúncio de terceiro', {
      userId: user.id,
      listingId,
    })
    return { error: 'Anúncio não encontrado.' as const }
  }

  return { user, listing }
}

function readFeatures(formData: FormData): Feature[] {
  const raw = formData.getAll('features').map(String)
  const allowed = new Set<string>(FEATURES)
  return raw.filter((f): f is Feature => allowed.has(f))
}

function readCore(formData: FormData) {
  return {
    brand: formData.get('brand'),
    model: formData.get('model'),
    trim: formData.get('trim'),
    year: formData.get('year'),
    modelYear: formData.get('modelYear'),
    priceCents: parsePriceToCents(String(formData.get('price') ?? '')) ?? undefined,
    mileageKm: formData.get('mileageKm'),
    fuel: formData.get('fuel') || undefined,
    transmission: formData.get('transmission') || undefined,
    bodyType: formData.get('bodyType') || undefined,
    color: formData.get('color'),
    doors: formData.get('doors'),
    city: formData.get('city'),
    state: formData.get('state'),
    description: formData.get('description'),
    features: readFeatures(formData),
    contactChannel: formData.get('contactChannel') || undefined,
    contactPhone: formData.get('contactPhone') ?? '',
  }
}

// ─── Criar rascunho ──────────────────────────────────────────────────────────

/**
 * O anúncio nasce como rascunho antes de qualquer upload. Assim a foto já
 * chega vinculada a um anúncio, e a autorização do upload é a mesma do
 * anúncio — não existe arquivo "solto" sem dono.
 */
export async function createDraftAction(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar?proximo=%2Fpainel%2Fanuncios%2Fnovo')

  const limit = await consumeRateLimit('createListing', user.id)
  if (!limit.ok) {
    redirect(`/painel/anuncios/novo?erro=limite&minutos=${Math.ceil(limit.retryAfterSec / 60)}`)
  }

  let id: string
  try {
    const listing = await prisma.listing.create({
      data: {
        sellerId: user.id,
        slug: `rascunho-${shortSuffix(10)}`,
        brand: '',
        model: '',
        trim: '',
        year: new Date().getFullYear(),
        modelYear: new Date().getFullYear(),
        priceCents: 0,
        mileageKm: 0,
        fuel: 'FLEX',
        transmission: 'MANUAL',
        bodyType: 'HATCH',
        color: '',
        city: user.city ?? '',
        state: user.state ?? '',
        description: '',
        status: 'DRAFT',
      },
      select: { id: true },
    })
    id = listing.id
  } catch (error) {
    toPublicError(error, { acao: 'createDraft' })
    redirect('/painel/anuncios/novo?erro=falha')
  }

  redirect(`/painel/anuncios/${id}/editar`)
}

// ─── Salvar ──────────────────────────────────────────────────────────────────

/** Salva sem exigir todos os campos: é o "salvar rascunho". */
export async function saveDraftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const listingId = String(formData.get('listingId') ?? '')
  const owned = await loadOwned(listingId)
  if ('error' in owned) return { ok: false, message: owned.error }

  const raw = readCore(formData)
  const parsed = listingDraftSchema.safeParse({
    ...raw,
    features: raw.features,
  })

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
  const d = parsed.data

  try {
    await prisma.listing.update({
      where: { id: owned.listing.id },
      data: {
        brand: d.brand ?? '',
        model: d.model ?? '',
        trim: d.trim ?? '',
        year: d.year ?? new Date().getFullYear(),
        modelYear: d.modelYear ?? new Date().getFullYear(),
        priceCents: d.priceCents ?? 0,
        mileageKm: d.mileageKm ?? 0,
        fuel: d.fuel ?? 'FLEX',
        transmission: d.transmission ?? 'MANUAL',
        bodyType: d.bodyType ?? 'HATCH',
        color: d.color ?? '',
        doors: d.doors ?? 4,
        city: d.city ?? '',
        state: d.state ?? '',
        description: d.description ?? '',
        features: JSON.stringify(raw.features),
        contactChannel: d.contactChannel ?? 'PLATFORM',
        contactPhone: d.contactPhone ? d.contactPhone : null,
      },
    })

    revalidatePath(`/painel/anuncios/${owned.listing.id}/editar`)
    return { ok: true, message: 'Rascunho salvo.', listingId: owned.listing.id }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'saveDraft' })
    return { ok: false, message }
  }
}

/** Salva exigindo o anúncio completo (usado ao editar algo já publicado). */
export async function saveListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const listingId = String(formData.get('listingId') ?? '')
  const owned = await loadOwned(listingId)
  if ('error' in owned) return { ok: false, message: owned.error }

  const parsed = listingCoreSchema.safeParse(readCore(formData))
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const d = parsed.data

  try {
    await prisma.listing.update({
      where: { id: owned.listing.id },
      data: {
        brand: d.brand,
        model: d.model,
        trim: d.trim,
        year: d.year,
        modelYear: d.modelYear,
        priceCents: d.priceCents,
        mileageKm: d.mileageKm,
        fuel: d.fuel,
        transmission: d.transmission,
        bodyType: d.bodyType,
        color: d.color,
        doors: d.doors,
        city: d.city,
        state: d.state,
        description: d.description,
        features: JSON.stringify(d.features),
        contactChannel: d.contactChannel,
        contactPhone: d.contactPhone ? d.contactPhone : null,
        // O slug NÃO é recalculado aqui: ele é definido no momento da
        // publicação e congelado. Ver `slugDefinitivo`.
      },
    })

    revalidatePath(`/painel/anuncios/${owned.listing.id}/editar`)
    revalidatePath('/catalogo')
    return { ok: true, message: 'Anúncio atualizado.', listingId: owned.listing.id }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'saveListing' })
    return { ok: false, message }
  }
}

/**
 * Define o slug definitivo do anúncio.
 *
 * O rascunho nasce com um slug provisório (`rascunho-xxxx`), que ninguém
 * conhece porque rascunho não tem página pública. O slug de verdade é gerado
 * **no momento da publicação** e nunca mais muda — mudar a URL de um anúncio
 * que já circula quebraria todo link compartilhado.
 *
 * Esta função devolve o slug atual quando ele já é definitivo, então chamá-la
 * mais de uma vez é seguro.
 */
async function slugDefinitivo(
  id: string,
  currentSlug: string,
  d: { brand: string; model: string; trim: string; modelYear: number },
): Promise<string> {
  if (!currentSlug.startsWith('rascunho-')) return currentSlug

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = buildListingSlug({ ...d, suffix: shortSuffix() })
    const clash = await prisma.listing.findFirst({
      where: { slug: candidate, NOT: { id } },
      select: { id: true },
    })
    if (!clash) return candidate
  }
  return `${buildListingSlug({ ...d, suffix: shortSuffix(10) })}`
}

// ─── Mudança de status ───────────────────────────────────────────────────────

export async function changeStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const listingId = String(formData.get('listingId') ?? '')
  const target = String(formData.get('status') ?? '') as ListingStatus

  const owned = await loadOwned(listingId)
  if ('error' in owned) return { ok: false, message: owned.error }

  const { listing, user } = owned

  // Publicar é um caso especial: passa pelas checagens de completude e pode
  // cair em análise em vez de ir direto ao ar.
  if (target === 'PUBLISHED' || target === 'PENDING') {
    return publishListing(listing.id, user.id)
  }

  if (!canSellerTransition(listing.status, target)) {
    return {
      ok: false,
      message: 'Essa mudança de situação não é permitida a partir do estado atual do anúncio.',
    }
  }

  try {
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: target, ...statusSideEffects(target) },
    })

    revalidatePath('/painel')
    revalidatePath('/catalogo')
    revalidatePath(`/veiculo/${listing.slug}`)
    return { ok: true, message: statusMessage(target) }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'changeStatus' })
    return { ok: false, message }
  }
}

function statusMessage(status: ListingStatus): string {
  switch (status) {
    case 'PAUSED':
      return 'Anúncio pausado. Ele saiu do catálogo e pode voltar quando você quiser.'
    case 'SOLD':
      return 'Anúncio marcado como vendido.'
    case 'DRAFT':
      return 'Anúncio voltou para rascunho.'
    case 'PUBLISHED':
      return 'Anúncio publicado.'
    case 'PENDING':
      return 'Anúncio enviado para análise.'
    default:
      return 'Situação atualizada.'
  }
}

async function publishListing(listingId: string, userId: string): Promise<ActionState> {
  const [listing, user] = await Promise.all([
    prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        slug: true,
        status: true,
        sellerId: true,
        brand: true,
        model: true,
        trim: true,
        year: true,
        modelYear: true,
        priceCents: true,
        mileageKm: true,
        fuel: true,
        transmission: true,
        bodyType: true,
        color: true,
        doors: true,
        city: true,
        state: true,
        description: true,
        features: true,
        contactChannel: true,
        contactPhone: true,
        _count: { select: { images: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, status: true },
    }),
  ])

  if (!listing || listing.sellerId !== userId) {
    return { ok: false, message: 'Anúncio não encontrado.' }
  }
  if (!user) return { ok: false, message: 'Sessão expirada. Entre novamente.' }

  const coreCheck = listingCoreSchema.safeParse({
    ...listing,
    features: safeParseFeatures(listing.features),
    contactPhone: listing.contactPhone ?? '',
  })

  const blockers = publishBlockers({
    imageCount: listing._count.images,
    emailVerified: Boolean(user.emailVerifiedAt),
    userStatus: user.status,
    coreValid: coreCheck.success,
  })

  if (blockers.length > 0) {
    return {
      ok: false,
      message: blockers.map((b) => PUBLISH_BLOCKER_LABELS[b]).join(' '),
      errors: coreCheck.success ? undefined : fieldErrors(coreCheck.error),
    }
  }

  const target = statusOnPublishRequest(env.MODERATION_ENABLED)

  try {
    // É aqui que o anúncio ganha a URL que vai circular — e ela é congelada a
    // partir deste ponto, mesmo que a ficha seja editada depois.
    const slug = await slugDefinitivo(listing.id, listing.slug, listing)

    await prisma.listing.update({
      where: { id: listing.id },
      data: { slug, status: target, ...statusSideEffects(target) },
    })

    revalidatePath('/painel')
    revalidatePath('/catalogo')
    revalidatePath('/')
    logger.info('anúncio enviado para publicação', { listingId: listing.id, target })

    return {
      ok: true,
      message:
        target === 'PENDING'
          ? 'Anúncio enviado para análise. Avisamos assim que for aprovado.'
          : 'Anúncio publicado no catálogo.',
    }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'publishListing' })
    return { ok: false, message }
  }
}

function safeParseFeatures(json: string): Feature[] {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    const allowed = new Set<string>(FEATURES)
    return parsed.filter((f): f is Feature => typeof f === 'string' && allowed.has(f))
  } catch {
    return []
  }
}

// ─── Excluir ─────────────────────────────────────────────────────────────────

export async function deleteListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const listingId = String(formData.get('listingId') ?? '')
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Sessão expirada. Entre novamente.' }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true },
  })

  if (!listing || !canDelete(listing, user)) {
    return { ok: false, message: 'Anúncio não encontrado.' }
  }

  try {
    const images = await prisma.listingImage.findMany({
      where: { listingId: listing.id },
      select: { storageKey: true, thumbKey: true },
    })

    await prisma.listing.delete({ where: { id: listing.id } })
    // Arquivos saem depois do registro: se o disco falhar, o anúncio já não
    // existe e sobra no máximo um arquivo inacessível, nunca o contrário.
    await deleteObjects(images.flatMap((i) => [i.storageKey, i.thumbKey]))

    revalidatePath('/painel')
    revalidatePath('/catalogo')
    logger.info('anúncio excluído', { listingId: listing.id, by: user.id })
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'deleteListing' })
    return { ok: false, message }
  }

  redirect('/painel?removido=1')
}

// ─── Favoritos ───────────────────────────────────────────────────────────────

export async function toggleFavoriteAction(listingId: string): Promise<{
  ok: boolean
  favorited?: boolean
  message?: string
  requiresLogin?: boolean
}> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, requiresLogin: true, message: 'Entre para salvar favoritos.' }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, status: true, sellerId: true, slug: true },
  })

  // Só é possível favoritar o que se pode ver.
  if (!listing || !['PUBLISHED', 'SOLD'].includes(listing.status)) {
    return { ok: false, message: 'Anúncio não encontrado.' }
  }

  try {
    const existing = await prisma.favorite.findUnique({
      where: { userId_listingId: { userId: user.id, listingId } },
      select: { id: true },
    })

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } })
      revalidatePath('/favoritos')
      return { ok: true, favorited: false }
    }

    await prisma.favorite.create({ data: { userId: user.id, listingId } })
    revalidatePath('/favoritos')
    return { ok: true, favorited: true }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'toggleFavorite' })
    return { ok: false, message }
  }
}

// ─── Denúncia ────────────────────────────────────────────────────────────────

export async function reportListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ip = await getClientIp()
  const user = await getCurrentUser()

  const limit = await consumeRateLimit('report', user?.id ?? ip)
  if (!limit.ok) {
    return { ok: false, message: 'Você já enviou muitas denúncias. Tente novamente mais tarde.' }
  }

  const parsed = reportSchema.safeParse({
    listingId: formData.get('listingId'),
    reason: formData.get('reason'),
    details: formData.get('details') ?? '',
  })

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    select: { id: true, status: true },
  })

  if (!listing || !['PUBLISHED', 'SOLD'].includes(listing.status)) {
    return { ok: false, message: 'Anúncio não encontrado.' }
  }

  try {
    await prisma.report.create({
      data: {
        listingId: listing.id,
        reporterId: user?.id ?? null,
        reason: parsed.data.reason,
        details: parsed.data.details || null,
      },
    })

    logger.info('denúncia registrada', { listingId: listing.id, reason: parsed.data.reason })
    return {
      ok: true,
      message: 'Denúncia enviada. Nossa equipe vai analisar o anúncio.',
    }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'reportListing' })
    return { ok: false, message }
  }
}

// ─── Contato com o anunciante ────────────────────────────────────────────────

/**
 * Envia uma mensagem do interessado para o anunciante pelo canal de e-mail
 * configurado em MAIL_TRANSPORT.
 *
 * Exige login por dois motivos: evita que o endereço do anunciante vire alvo
 * de envio automatizado por visitante anônimo, e dá ao anunciante um remetente
 * identificável para responder.
 *
 * Importante: com MAIL_TRANSPORT="console" (padrão de desenvolvimento) a
 * mensagem é gravada em log/emails.log e NÃO chega a uma caixa de entrada real.
 * Ver README e docs/PENDENCIAS.md.
 */
export async function contactSellerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, message: 'Entre na sua conta para falar com o anunciante.' }
  }

  const limit = await consumeRateLimit('contact', user.id)
  if (!limit.ok) {
    return {
      ok: false,
      message: `Você enviou muitas mensagens em pouco tempo. Tente de novo em ${Math.ceil(limit.retryAfterSec / 60)} minutos.`,
    }
  }

  const listingId = String(formData.get('listingId') ?? '')
  const parsedMessage = contactMessageSchema.safeParse(formData.get('message'))
  if (!parsedMessage.success) {
    return { ok: false, errors: { message: parsedMessage.error.issues[0]?.message ?? 'Mensagem inválida.' } }
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
      modelYear: true,
      sellerId: true,
      seller: { select: { name: true, email: true } },
    },
  })

  // Só anúncio público recebe contato — e ninguém manda mensagem para si mesmo.
  if (!listing || !['PUBLISHED', 'SOLD'].includes(listing.status)) {
    return { ok: false, message: 'Anúncio não encontrado.' }
  }
  if (listing.sellerId === user.id) {
    return { ok: false, message: 'Este anúncio é seu.' }
  }

  const titulo = `${listing.brand} ${listing.model} ${listing.trim} ${listing.modelYear}`

  try {
    await sendMail({
      to: listing.seller.email,
      subject: `Interesse no seu anúncio: ${titulo}`,
      text: [
        `Olá, ${listing.seller.name}.`,
        '',
        `${user.name} demonstrou interesse no anúncio "${titulo}".`,
        '',
        'Mensagem:',
        parsedMessage.data,
        '',
        `Responda para: ${user.email}`,
        `Anúncio: ${env.APP_URL}/veiculo/${listing.slug}`,
      ].join('\n'),
    })

    logger.info('mensagem de interesse enviada', { listingId: listing.id })
    return {
      ok: true,
      message: 'Mensagem enviada ao anunciante com o seu e-mail para resposta.',
    }
  } catch (error) {
    const { message } = toPublicError(error, { acao: 'contactSeller' })
    return { ok: false, message }
  }
}
