import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, MapPin } from 'lucide-react'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { getClientIp, getCurrentUser, getUserAgent } from '@/lib/auth'
import {
  getListingBySlug,
  getRelatedListings,
  getFavoriteIds,
  parseFeatures,
  publicSeller,
} from '@/server/queries'
import { canView } from '@/server/listing-rules'
import { VehicleGallery } from '@/components/vehicle-gallery'
import { ListingCard } from '@/components/listing-card'
import { FavoriteButton } from '@/components/favorite-button'
import { ReportButton, ShareButton } from '@/components/listing-actions'
import { ContactSeller } from '@/components/contact-seller'
import {
  Badge,
  Breadcrumbs,
  DemoBadge,
  SectionTitle,
  SpecRow,
  StatusBadge,
  TickRule,
} from '@/components/ui/misc'
import {
  BODY_TYPE_LABELS,
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  type BodyType,
  type Fuel,
  type Transmission,
} from '@/lib/enums'
import {
  formatDate,
  formatKm,
  formatLocation,
  formatPrice,
  formatRelative,
  formatYearPair,
} from '@/lib/format'

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const listing = await getListingBySlug(slug)

  // Anúncio não público não ganha metadados: nem título, nem descrição vazam
  // para prévia de link ou buscador.
  if (!listing || !['PUBLISHED', 'SOLD'].includes(listing.status)) {
    return { title: 'Anúncio não encontrado', robots: { index: false, follow: false } }
  }

  const titulo = `${listing.brand} ${listing.model} ${listing.trim} ${listing.modelYear}`
  return {
    title: `${titulo} — ${formatPrice(listing.priceCents)}`,
    description: `${titulo} com ${formatKm(listing.mileageKm)} em ${formatLocation(listing.city, listing.state)}. ${listing.description.slice(0, 120)}`,
    alternates: { canonical: `/veiculo/${listing.slug}` },
  }
}

/**
 * Página do anúncio.
 *
 * A checagem de visibilidade acontece aqui, no servidor, com `canView`: um
 * rascunho, um anúncio em análise, pausado ou rejeitado devolve 404 para
 * qualquer pessoa que não seja o dono ou a administração — inclusive quem
 * tenha o link exato.
 */
export default async function VehiclePage({ params }: { params: Params }) {
  const { slug } = await params
  const [listing, user] = await Promise.all([getListingBySlug(slug), getCurrentUser()])

  if (!listing) notFound()
  if (!canView(listing, user)) notFound()

  const isPublic = ['PUBLISHED', 'SOLD'].includes(listing.status)
  const isOwner = user?.id === listing.sellerId
  const seller = publicSeller(listing.seller)
  const features = parseFeatures(listing.features)
  const titulo = `${listing.brand} ${listing.model}`
  const tituloCompleto = `${titulo} ${listing.trim} ${listing.modelYear}`

  // Visualização só é contada em anúncio público, e uma vez por visitante/dia.
  if (isPublic && !isOwner) {
    await registerView(listing.id).catch(() => {})
  }

  const [related, favoriteIds] = await Promise.all([
    isPublic
      ? getRelatedListings({
          id: listing.id,
          bodyType: listing.bodyType,
          brand: listing.brand,
          priceCents: listing.priceCents,
        })
      : Promise.resolve([]),
    getFavoriteIds(),
  ])

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs
        items={[
          { label: 'Início', href: '/' },
          { label: 'Catálogo', href: '/catalogo' },
          { label: BODY_TYPE_LABELS[listing.bodyType as BodyType] ?? 'Veículo', href: `/catalogo?carroceria=${listing.bodyType}` },
          { label: titulo },
        ]}
      />

      {/* Aviso para o dono quando o anúncio não está público. */}
      {!isPublic && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-accent-line bg-accent-soft p-4 text-sm"
        >
          <p className="font-semibold text-accent">
            Esta é uma pré-visualização — o anúncio não está público.
          </p>
          <p className="mt-1 text-fg-muted">
            Situação atual: <StatusBadge status={listing.status} />
            {listing.rejectionReason && (
              <>
                {' '}
                Motivo informado pela moderação: <strong>{listing.rejectionReason}</strong>
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:gap-12">
        {/* ── Coluna principal ─────────────────────────────────────────── */}
        <div className="min-w-0">
          <VehicleGallery photos={listing.images} title={tituloCompleto} />

          <section aria-labelledby="ficha" className="mt-10">
            <h2 id="ficha" className="rotulo mb-3">
              Ficha técnica
            </h2>
            <TickRule className="mb-4" />
            <dl className="grid gap-x-10 sm:grid-cols-2">
              <SpecRow label="Marca" value={listing.brand} />
              <SpecRow label="Modelo" value={listing.model} />
              <SpecRow label="Versão" value={listing.trim} />
              <SpecRow
                label="Ano fabricação / modelo"
                value={formatYearPair(listing.year, listing.modelYear)}
              />
              <SpecRow label="Quilometragem" value={formatKm(listing.mileageKm)} />
              <SpecRow
                label="Câmbio"
                value={TRANSMISSION_LABELS[listing.transmission as Transmission] ?? listing.transmission}
              />
              <SpecRow
                label="Combustível"
                value={FUEL_LABELS[listing.fuel as Fuel] ?? listing.fuel}
              />
              <SpecRow
                label="Carroceria"
                value={BODY_TYPE_LABELS[listing.bodyType as BodyType] ?? listing.bodyType}
              />
              <SpecRow label="Cor" value={listing.color} />
              <SpecRow label="Portas" value={listing.doors} />
              <SpecRow label="Cidade / UF" value={formatLocation(listing.city, listing.state)} />
              {listing.publishedAt && (
                <SpecRow
                  label="Publicado"
                  value={
                    <span title={formatDate(listing.publishedAt)}>
                      {formatRelative(listing.publishedAt)}
                    </span>
                  }
                />
              )}
            </dl>
          </section>

          <section aria-labelledby="descricao" className="mt-10">
            <h2 id="descricao" className="rotulo mb-3">
              Descrição do anunciante
            </h2>
            <TickRule className="mb-4" />
            <div className="max-w-prose text-sm leading-relaxed whitespace-pre-line text-fg-muted sm:text-base">
              {listing.description}
            </div>
          </section>

          {features.length > 0 && (
            <section aria-labelledby="opcionais" className="mt-10">
              <h2 id="opcionais" className="rotulo mb-3">
                Opcionais e itens de série
              </h2>
              <TickRule className="mb-4" />
              <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-fg">
                    <Check size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="anunciante" className="mt-10">
            <h2 id="anunciante" className="rotulo mb-3">
              Anunciante
            </h2>
            <TickRule className="mb-4" />
            <div className="rounded-lg border border-line bg-surface-2 p-5">
              <p className="text-base font-semibold text-fg">{seller.name}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                {seller.city && seller.state && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} aria-hidden="true" />
                    {formatLocation(seller.city, seller.state)}
                  </span>
                )}
                <span>Na plataforma desde {formatDate(seller.memberSince)}</span>
              </p>
              {seller.bio && (
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-fg-muted">
                  {seller.bio}
                </p>
              )}
              <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
                A Motriz não verifica a procedência dos veículos nem a identidade dos anunciantes.
                Combine a visita em local seguro e confira a documentação antes de fechar negócio.
              </p>
            </div>
          </section>
        </div>

        {/* ── Coluna lateral: preço e ações ────────────────────────────── */}
        <aside
          aria-label="Resumo e ações do anúncio"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <div className="rounded-lg border border-line bg-surface-2 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {listing.isDemo && <DemoBadge />}
              {listing.status === 'SOLD' && <Badge>Vendido</Badge>}
              {!isPublic && <StatusBadge status={listing.status} />}
            </div>

            <h1 className="mt-3 text-2xl leading-tight font-extrabold tracking-[-0.03em] sm:text-3xl">
              {titulo}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">{listing.trim}</p>

            <p className="preco mt-4 text-3xl text-fg sm:text-4xl">
              {formatPrice(listing.priceCents)}
            </p>

            <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
              <div className="flex gap-1.5">
                <dt className="apenas-leitor">Ano</dt>
                <dd className="tabular">{formatYearPair(listing.year, listing.modelYear)}</dd>
              </div>
              <span aria-hidden="true">·</span>
              <div className="flex gap-1.5">
                <dt className="apenas-leitor">Quilometragem</dt>
                <dd className="tabular">{formatKm(listing.mileageKm)}</dd>
              </div>
              <span aria-hidden="true">·</span>
              <div className="flex gap-1.5">
                <dt className="apenas-leitor">Local</dt>
                <dd>{formatLocation(listing.city, listing.state)}</dd>
              </div>
            </dl>

            {isPublic && (
              <div className="mt-5 flex flex-col gap-2.5">
                <FavoriteButton
                  listingId={listing.id}
                  initialFavorited={favoriteIds.has(listing.id)}
                  label={tituloCompleto}
                  variant="completo"
                  returnTo={`/veiculo/${listing.slug}`}
                />
                <ShareButton title={tituloCompleto} />
              </div>
            )}
          </div>

          {isPublic && (
            <div className="mt-4">
              <ContactSeller
                listingId={listing.id}
                sellerName={seller.name}
                contactChannel={listing.contactChannel}
                contactPhone={listing.contactPhone}
                publicPhone={seller.phone}
                publicEmail={seller.email}
                isLoggedIn={Boolean(user)}
                isOwner={Boolean(isOwner)}
                listingTitle={tituloCompleto}
                returnTo={`/veiculo/${listing.slug}`}
              />
            </div>
          )}

          {isPublic && !isOwner && (
            <div className="mt-4 flex justify-center">
              <ReportButton listingId={listing.id} title={tituloCompleto} />
            </div>
          )}

          {isOwner && (
            <div className="mt-4 rounded-lg border border-line bg-surface-2 p-5">
              <p className="text-sm text-fg-muted">
                <Link href="/painel" className="link-sublinhado font-medium text-accent">
                  Gerenciar este anúncio
                </Link>{' '}
                no painel do anunciante.
              </p>
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="relacionados" className="mt-16 lg:mt-24">
          <SectionTitle
            kicker="Talvez interesse"
            title="Veículos parecidos"
            description="Mesma carroceria e faixa de preço próxima."
          />
          <TickRule className="mt-6 mb-8" />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <ListingCard listing={item} className="h-full" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * Contagem de visualizações realmente coletada (não é número decorativo).
 *
 * Deduplicação: um hash de IP + navegador, por anúncio e por dia. Não usamos
 * cookie de visitante porque um componente de servidor não pode gravar cookie
 * durante a renderização — e porque o hash não guarda dado pessoal legível
 * (o IP nunca é gravado em claro).
 *
 * Limitação assumida: pessoas atrás do mesmo IP e navegador contam uma vez só.
 * É uma métrica de tendência, e a interface a apresenta como tal.
 */
async function registerView(listingId: string) {
  const day = new Date().toISOString().slice(0, 10)
  const [ip, agent] = await Promise.all([getClientIp(), getUserAgent()])
  const fingerprint = createHash('sha256')
    .update(`${ip}|${agent ?? ''}|${env.AUTH_SECRET}`)
    .digest('base64url')
    .slice(0, 22)

  const primeiraVezHoje = await marcarVisita(`view:${listingId}:${day}:${fingerprint}`)
  if (!primeiraVezHoje) return

  await prisma.$transaction([
    prisma.listing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    }),
    prisma.listingViewDay.upsert({
      where: { listingId_day: { listingId, day } },
      create: { listingId, day, count: 1 },
      update: { count: { increment: 1 } },
    }),
  ])
}

/** true na primeira vez que a chave aparece em 24 h; false depois. */
async function marcarVisita(key: string): Promise<boolean> {
  const agora = new Date()
  const existente = await prisma.rateLimit.findUnique({ where: { key } })

  if (existente && agora.getTime() - existente.windowStart.getTime() < 1000 * 60 * 60 * 24) {
    return false
  }

  await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, windowStart: agora },
    update: { count: 1, windowStart: agora },
  })
  return true
}
