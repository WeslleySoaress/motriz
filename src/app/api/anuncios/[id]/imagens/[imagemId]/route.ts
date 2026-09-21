import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AuthError, assertSameOrigin, requireUserApi } from '@/lib/auth'
import { deleteObjects } from '@/lib/storage'
import { imageAltSchema } from '@/lib/validation'
import { logger, toPublicError } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Exclusão e edição de uma foto.
 *
 * A consulta sempre casa `id` da imagem COM `listingId` e `sellerId`: assim
 * nenhuma requisição com id de imagem de outra pessoa encontra linha para
 * alterar, mesmo que o id seja adivinhado corretamente.
 */
async function loadOwnedImage(listingId: string, imageId: string, userId: string) {
  const image = await prisma.listingImage.findFirst({
    where: { id: imageId, listingId, listing: { sellerId: userId } },
    select: {
      id: true,
      storageKey: true,
      thumbKey: true,
      isCover: true,
      position: true,
      listingId: true,
    },
  })
  if (!image) throw new AuthError('Foto não encontrada.', 404)
  return image
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  const { message, errorId } = toPublicError(error, { rota: 'imagem' })
  return NextResponse.json({ error: message, errorId }, { status: 500 })
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; imagemId: string }> },
) {
  try {
    await assertSameOrigin()
    const user = await requireUserApi()
    const { id, imagemId } = await context.params
    const image = await loadOwnedImage(id, imagemId, user.id)

    await prisma.listingImage.delete({ where: { id: image.id } })

    // Reposiciona o que sobrou e garante que sempre exista uma capa.
    const remaining = await prisma.listingImage.findMany({
      where: { listingId: image.listingId },
      orderBy: { position: 'asc' },
      select: { id: true },
    })

    if (remaining.length > 0) {
      await prisma.$transaction(
        remaining.map((img, index) =>
          prisma.listingImage.update({
            where: { id: img.id },
            data: { position: index, isCover: index === 0 },
          }),
        ),
      )
    }

    await deleteObjects([image.storageKey, image.thumbKey])
    logger.info('foto removida', { listingId: image.listingId, imageId: image.id })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; imagemId: string }> },
) {
  try {
    await assertSameOrigin()
    const user = await requireUserApi()
    const { id, imagemId } = await context.params
    const image = await loadOwnedImage(id, imagemId, user.id)

    const body = (await request.json()) as { alt?: unknown }
    const parsed = imageAltSchema.safeParse(body.alt)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'O texto alternativo precisa ter entre 3 e 180 caracteres.' },
        { status: 422 },
      )
    }

    await prisma.listingImage.update({ where: { id: image.id }, data: { alt: parsed.data } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
