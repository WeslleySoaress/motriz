import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getObject, isValidStorageKey } from '@/lib/storage'
import { isPubliclyVisible } from '@/lib/enums'
import { logger } from '@/lib/logger'

/**
 * Entrega de imagens.
 *
 * Os arquivos ficam fora de /public exatamente para passarem por aqui: antes
 * de devolver o byte, conferimos se o anúncio dono da imagem está público. Se
 * não estiver (rascunho, em análise, pausado, rejeitado), só o próprio
 * anunciante e a administração recebem o arquivo. Sem isso, a foto de um
 * rascunho vazaria para quem adivinhasse a URL.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await context.params
  const key = segments.join('/')

  if (!isValidStorageKey(key)) {
    return new Response('Não encontrado', { status: 404 })
  }

  const image = await prisma.listingImage.findFirst({
    where: { OR: [{ storageKey: key }, { thumbKey: key }] },
    select: {
      listing: { select: { id: true, status: true, sellerId: true } },
    },
  })

  if (!image) {
    return new Response('Não encontrado', { status: 404 })
  }

  const isPublic = isPubliclyVisible(image.listing.status)
  let privateAccess = false

  if (!isPublic) {
    const user = await getCurrentUser()
    const allowed = user && (user.id === image.listing.sellerId || user.role === 'ADMIN')
    if (!allowed) {
      // 404 e não 403: não confirmamos sequer que o arquivo existe.
      return new Response('Não encontrado', { status: 404 })
    }
    privateAccess = true
  }

  const data = await getObject(key)
  if (!data) {
    logger.warn('registro de imagem sem arquivo no armazenamento', { key })
    return new Response('Não encontrado', { status: 404 })
  }

  // A chave contém um UUID e o conteúdo nunca muda: podemos usar ETag forte e
  // cache longo para as imagens públicas.
  const etag = `"${createHash('sha1').update(key).update(String(data.byteLength)).digest('base64url')}"`

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } })
  }

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(data.byteLength),
      ETag: etag,
      'Cache-Control': privateAccess
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  })
}
