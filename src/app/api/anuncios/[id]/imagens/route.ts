import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { AuthError, assertSameOrigin, requireUserApi } from '@/lib/auth'
import { consumeRateLimit } from '@/lib/rate-limit'
import { ImageValidationError, defaultAlt, processAndStoreImage } from '@/lib/images'
import { deleteObjects } from '@/lib/storage'
import { canAddImages } from '@/server/listing-rules'
import { logger, toPublicError } from '@/lib/logger'
import { imageOrderSchema } from '@/lib/validation'

/**
 * Upload e organização das fotos de um anúncio.
 *
 * Por que route handler e não server action: o corpo de uma server action tem
 * limite padrão de 1 MB e o upload aqui pode passar disso. O preço é ter de
 * fazer manualmente o que a server action faria sozinha — checagem de origem
 * (CSRF) e autenticação — o que é feito logo nas primeiras linhas.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireOwnedListing(listingId: string, userId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      sellerId: true,
      brand: true,
      model: true,
      trim: true,
      modelYear: true,
      color: true,
      _count: { select: { images: true } },
    },
  })

  if (!listing || listing.sellerId !== userId) {
    // Um anúncio de outra pessoa responde igual a um inexistente.
    throw new AuthError('Anúncio não encontrado.', 404)
  }
  return listing
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof ImageValidationError) {
    return NextResponse.json({ error: error.message }, { status: 422 })
  }
  const { message, errorId } = toPublicError(error, { rota: 'imagens' })
  return NextResponse.json({ error: message, errorId }, { status: 500 })
}

// ─── Enviar fotos ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin()
    const user = await requireUserApi()
    const { id } = await context.params

    const limit = await consumeRateLimit('upload', user.id)
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Muitos envios em pouco tempo. Aguarde alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
      )
    }

    const listing = await requireOwnedListing(id, user.id)

    const formData = await request.formData()
    const entries = formData.getAll('fotos')
    const files = entries.filter((e): e is File => e instanceof File && e.size > 0)

    if (files.length === 0) {
      return NextResponse.json({ error: 'Selecione ao menos uma foto.' }, { status: 422 })
    }

    const max = env.UPLOAD_MAX_FILES_PER_LISTING
    if (!canAddImages(listing._count.images, files.length, max)) {
      return NextResponse.json(
        {
          error: `Cada anúncio aceita no máximo ${max} fotos. Você já tem ${listing._count.images}.`,
        },
        { status: 422 },
      )
    }

    const stored: { storageKey: string; thumbKey: string }[] = []

    try {
      const startPosition = listing._count.images
      const created = []

      for (const [index, file] of files.entries()) {
        // O tipo declarado pelo navegador nem é consultado: quem decide é o
        // conteúdo real do arquivo, lido pelo sharp dentro de processAndStore.
        const buffer = Buffer.from(await file.arrayBuffer())
        const processed = await processAndStoreImage(listing.id, {
          buffer,
          originalName: typeof file.name === 'string' ? file.name.slice(0, 120) : undefined,
        })
        stored.push({ storageKey: processed.storageKey, thumbKey: processed.thumbKey })

        created.push({
          listingId: listing.id,
          storageKey: processed.storageKey,
          thumbKey: processed.thumbKey,
          mimeType: processed.mimeType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
          alt: defaultAlt({
            brand: listing.brand || 'Veículo',
            model: listing.model,
            trim: listing.trim,
            modelYear: listing.modelYear,
            color: listing.color || '',
            index: startPosition + index,
          }),
          position: startPosition + index,
          isCover: startPosition + index === 0,
        })
      }

      await prisma.listingImage.createMany({ data: created })

      const images = await prisma.listingImage.findMany({
        where: { listingId: listing.id },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          storageKey: true,
          thumbKey: true,
          width: true,
          height: true,
          alt: true,
          position: true,
          isCover: true,
        },
      })

      logger.info('fotos enviadas', { listingId: listing.id, quantidade: files.length })
      return NextResponse.json({ images })
    } catch (error) {
      // Falhou no meio: remove tudo que já foi para o disco nesta requisição,
      // senão sobram arquivos sem registro correspondente.
      await deleteObjects(stored.flatMap((s) => [s.storageKey, s.thumbKey]))
      throw error
    }
  } catch (error) {
    return errorResponse(error)
  }
}

// ─── Reordenar / definir capa ────────────────────────────────────────────────

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin()
    const user = await requireUserApi()
    const { id } = await context.params
    const listing = await requireOwnedListing(id, user.id)

    const body: unknown = await request.json()
    const parsed = imageOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ordem inválida.' }, { status: 422 })
    }

    const owned = await prisma.listingImage.findMany({
      where: { listingId: listing.id },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map((i) => i.id))

    // A ordem precisa conter exatamente as imagens deste anúncio. Um id de
    // outro anúncio na lista faria a atualização alcançar dado alheio.
    const incoming = parsed.data.order
    if (incoming.length !== owned.length || incoming.some((imgId) => !ownedIds.has(imgId))) {
      return NextResponse.json(
        { error: 'A lista de fotos não corresponde às fotos deste anúncio.' },
        { status: 422 },
      )
    }

    await prisma.$transaction(
      incoming.map((imageId, index) =>
        prisma.listingImage.update({
          where: { id: imageId },
          data: { position: index, isCover: index === 0 },
        }),
      ),
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
