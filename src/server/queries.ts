import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { PUBLICLY_VISIBLE_STATUSES, type Feature } from '@/lib/enums'
import { FEATURES } from '@/lib/enums'
import { buildOrderBy, buildWhere, PAGE_SIZE, type CatalogFilters } from '@/lib/catalog'
import type { VehiclePhoto } from '@/components/vehicle-image'

/**
 * Leituras públicas do catálogo.
 *
 * Um único `select` é usado para card de anúncio em toda a aplicação, então
 * nenhum campo privado do vendedor (e-mail, telefone, id) escapa por engano
 * para uma listagem.
 */

const cardSelect = {
  id: true,
  slug: true,
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
  city: true,
  state: true,
  status: true,
  publishedAt: true,
  isDemo: true,
  images: {
    where: { isCover: true },
    take: 1,
    select: {
      storageKey: true,
      thumbKey: true,
      width: true,
      height: true,
      alt: true,
      isIllustrative: true,
    },
  },
} as const

export type ListingCard = {
  id: string
  slug: string
  brand: string
  model: string
  trim: string
  year: number
  modelYear: number
  priceCents: number
  mileageKm: number
  fuel: string
  transmission: string
  bodyType: string
  city: string
  state: string
  status: string
  publishedAt: Date | null
  isDemo: boolean
  cover: VehiclePhoto | null
  favorited: boolean
}

type RawCard = {
  id: string
  slug: string
  brand: string
  model: string
  trim: string
  year: number
  modelYear: number
  priceCents: number
  mileageKm: number
  fuel: string
  transmission: string
  bodyType: string
  city: string
  state: string
  status: string
  publishedAt: Date | null
  isDemo: boolean
  images: {
    storageKey: string
    thumbKey: string
    width: number
    height: number
    alt: string
    isIllustrative: boolean
  }[]
}

function toCard(raw: RawCard, favoriteIds: Set<string>): ListingCard {
  const cover = raw.images[0]
  return {
    ...raw,
    cover: cover ?? null,
    favorited: favoriteIds.has(raw.id),
  }
}

/**
 * Ids favoritados pelo usuário atual. Buscar de uma vez evita uma consulta por
 * card; para visitante, devolve conjunto vazio sem tocar no banco.
 */
export const getFavoriteIds = cache(async (): Promise<Set<string>> => {
  const user = await getCurrentUser()
  if (!user) return new Set()
  const rows = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { listingId: true },
  })
  return new Set(rows.map((r) => r.listingId))
})

export async function searchListings(filters: CatalogFilters): Promise<{
  items: ListingCard[]
  total: number
  page: number
  pageCount: number
}> {
  const where = buildWhere(filters)
  const skip = (filters.page - 1) * PAGE_SIZE

  const [total, rows, favoriteIds] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip,
      take: PAGE_SIZE,
      select: cardSelect,
    }),
    getFavoriteIds(),
  ])

  return {
    items: rows.map((r) => toCard(r as RawCard, favoriteIds)),
    total,
    page: filters.page,
    pageCount: Math.max(Math.ceil(total / PAGE_SIZE), 1),
  }
}

export async function getFeaturedListings(limit = 6): Promise<ListingCard[]> {
  const [rows, favoriteIds] = await Promise.all([
    prisma.listing.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: limit,
      select: cardSelect,
    }),
    getFavoriteIds(),
  ])
  return rows.map((r) => toCard(r as RawCard, favoriteIds))
}

/** Marcas com anúncios publicados, para montar o filtro sem lista fixa. */
export const getAvailableBrands = cache(async (): Promise<{ brand: string; count: number }[]> => {
  const rows = await prisma.listing.groupBy({
    by: ['brand'],
    where: { status: { in: [...PUBLICLY_VISIBLE_STATUSES] } },
    _count: { brand: true },
    orderBy: { brand: 'asc' },
  })
  return rows
    .filter((r) => r.brand.trim().length > 0)
    .map((r) => ({ brand: r.brand, count: r._count.brand }))
})

export const getAvailableStates = cache(async (): Promise<{ state: string; count: number }[]> => {
  const rows = await prisma.listing.groupBy({
    by: ['state'],
    where: { status: { in: [...PUBLICLY_VISIBLE_STATUSES] } },
    _count: { state: true },
    orderBy: { state: 'asc' },
  })
  return rows.filter((r) => r.state.trim().length > 0).map((r) => ({ state: r.state, count: r._count.state }))
})

export const getBodyTypeCounts = cache(async (): Promise<Record<string, number>> => {
  const rows = await prisma.listing.groupBy({
    by: ['bodyType'],
    where: { status: { in: [...PUBLICLY_VISIBLE_STATUSES] } },
    _count: { bodyType: true },
  })
  return Object.fromEntries(rows.map((r) => [r.bodyType, r._count.bodyType]))
})

/** Números reais para a página inicial. Nada é estimado ou inventado. */
export const getPlatformStats = cache(async () => {
  const [published, brands, demo] = await Promise.all([
    prisma.listing.count({ where: { status: { in: [...PUBLICLY_VISIBLE_STATUSES] } } }),
    prisma.listing.groupBy({
      by: ['brand'],
      where: { status: { in: [...PUBLICLY_VISIBLE_STATUSES] } },
    }),
    prisma.listing.count({ where: { isDemo: true, status: { in: [...PUBLICLY_VISIBLE_STATUSES] } } }),
  ])
  return {
    publishedCount: published,
    brandCount: brands.filter((b) => b.brand.trim().length > 0).length,
    demoCount: demo,
  }
})

// ─── Detalhe ─────────────────────────────────────────────────────────────────

export type ListingDetail = Awaited<ReturnType<typeof getListingBySlug>>

export async function getListingBySlug(slug: string) {
  const listing = await prisma.listing.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
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
      status: true,
      rejectionReason: true,
      publishedAt: true,
      soldAt: true,
      contactChannel: true,
      contactPhone: true,
      isDemo: true,
      viewCount: true,
      sellerId: true,
      createdAt: true,
      images: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          storageKey: true,
          thumbKey: true,
          width: true,
          height: true,
          alt: true,
          isIllustrative: true,
          sourceUrl: true,
          sourceAuthor: true,
          sourceLicense: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          bio: true,
          createdAt: true,
          // Campos de contato só saem daqui se o próprio usuário liberou.
          showPhone: true,
          showEmail: true,
          phone: true,
          email: true,
        },
      },
    },
  })

  return listing
}

/**
 * Monta a visão pública do anunciante, respeitando as escolhas de privacidade.
 * Chamar isto (e não usar `seller` direto) é o que impede o e-mail de alguém
 * aparecer numa página por descuido.
 */
export function publicSeller(seller: {
  id: string
  name: string
  city: string | null
  state: string | null
  bio: string | null
  createdAt: Date
  showPhone: boolean
  showEmail: boolean
  phone: string | null
  email: string
}) {
  return {
    id: seller.id,
    name: seller.name,
    city: seller.city,
    state: seller.state,
    bio: seller.bio,
    memberSince: seller.createdAt,
    phone: seller.showPhone ? seller.phone : null,
    email: seller.showEmail ? seller.email : null,
  }
}

export function parseFeatures(json: string): Feature[] {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    const allowed = new Set<string>(FEATURES)
    return parsed.filter((f): f is Feature => typeof f === 'string' && allowed.has(f))
  } catch {
    return []
  }
}

export async function getRelatedListings(listing: {
  id: string
  bodyType: string
  brand: string
  priceCents: number
}): Promise<ListingCard[]> {
  const favoriteIds = await getFavoriteIds()

  // Primeiro tenta veículos parecidos (mesma carroceria e faixa de preço).
  const near = await prisma.listing.findMany({
    where: {
      status: 'PUBLISHED',
      NOT: { id: listing.id },
      bodyType: listing.bodyType,
      priceCents: {
        gte: Math.round(listing.priceCents * 0.65),
        lte: Math.round(listing.priceCents * 1.35),
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 4,
    select: cardSelect,
  })

  if (near.length >= 3) return near.map((r) => toCard(r as RawCard, favoriteIds))

  // Se sobrou espaço, completa com anúncios recentes da mesma marca ou quaisquer.
  const fill = await prisma.listing.findMany({
    where: {
      status: 'PUBLISHED',
      NOT: { id: { in: [listing.id, ...near.map((n) => n.id)] } },
    },
    orderBy: [{ brand: listing.brand ? 'asc' : 'desc' }, { publishedAt: 'desc' }],
    take: 4 - near.length,
    select: cardSelect,
  })

  return [...near, ...fill].map((r) => toCard(r as RawCard, favoriteIds))
}

// ─── Favoritos ───────────────────────────────────────────────────────────────

export async function getFavoriteListings(userId: string): Promise<ListingCard[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { listing: { select: cardSelect } },
  })

  const favoriteIds = new Set(rows.map((r) => r.listing.id))
  return rows
    .map((r) => r.listing as RawCard)
    // Um anúncio que saiu do ar depois de favoritado não pode reaparecer aqui
    // com os dados completos.
    .filter((l) => (PUBLICLY_VISIBLE_STATUSES as readonly string[]).includes(l.status))
    .map((l) => toCard(l, favoriteIds))
}

// ─── Painel do anunciante ────────────────────────────────────────────────────

export async function getSellerListings(sellerId: string) {
  return prisma.listing.findMany({
    where: { sellerId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      brand: true,
      model: true,
      trim: true,
      modelYear: true,
      priceCents: true,
      mileageKm: true,
      status: true,
      rejectionReason: true,
      publishedAt: true,
      updatedAt: true,
      viewCount: true,
      _count: { select: { favorites: true, images: true } },
      images: {
        where: { isCover: true },
        take: 1,
        select: { storageKey: true, thumbKey: true, width: true, height: true, alt: true },
      },
    },
  })
}

export async function getListingForEdit(listingId: string, sellerId: string) {
  return prisma.listing.findFirst({
    // O filtro por sellerId faz parte da consulta: não existe "carregar e
    // depois checar", que é onde costumam nascer falhas de autorização.
    where: { id: listingId, sellerId },
    select: {
      id: true,
      slug: true,
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
      status: true,
      rejectionReason: true,
      contactChannel: true,
      contactPhone: true,
      viewCount: true,
      images: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          storageKey: true,
          thumbKey: true,
          width: true,
          height: true,
          alt: true,
          isCover: true,
          position: true,
        },
      },
    },
  })
}

/** Visualizações por dia dos últimos 30 dias — métrica realmente coletada. */
export async function getListingViewSeries(listingId: string, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceKey = since.toISOString().slice(0, 10)

  return prisma.listingViewDay.findMany({
    where: { listingId, day: { gte: sinceKey } },
    orderBy: { day: 'asc' },
    select: { day: true, count: true },
  })
}
