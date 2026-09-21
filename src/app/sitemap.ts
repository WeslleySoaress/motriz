import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { PUBLICLY_VISIBLE_STATUSES } from '@/lib/enums'

export const dynamic = 'force-dynamic'

/**
 * Mapa do site.
 *
 * Só entram anúncios com situação pública — a mesma constante usada no
 * catálogo. Um rascunho não pode aparecer nem aqui.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL

  const fixas: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/sobre`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/seguranca`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  try {
    const anuncios = await prisma.listing.findMany({
      where: { status: { in: [...PUBLICLY_VISIBLE_STATUSES] } },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    })

    return [
      ...fixas,
      ...anuncios.map((a) => ({
        url: `${base}/veiculo/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ]
  } catch {
    // Banco indisponível não deve derrubar o sitemap inteiro.
    return fixas
  }
}
