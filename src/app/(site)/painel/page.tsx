import type { Metadata } from 'next'
import Link from 'next/link'
import { Eye, Heart, ImageIcon, Plus } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { getSellerListings } from '@/server/queries'
import { VehicleImage } from '@/components/vehicle-image'
import { ListingRowActions } from '@/components/painel/listing-actions'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, StatusBadge } from '@/components/ui/misc'
import { formatKm, formatNumber, formatPrice, formatRelative } from '@/lib/format'
import { LISTING_STATUS_LABELS, type ListingStatus } from '@/lib/enums'

export const metadata: Metadata = {
  title: 'Meus anúncios',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Lista de anúncios do próprio usuário.
 *
 * A consulta filtra por `sellerId` vindo da sessão — nunca de parâmetro de
 * URL. Não existe caminho aqui que devolva anúncio de outra pessoa.
 */
export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser('/painel')
  const params = await searchParams
  const listings = await getSellerListings(user.id)

  const porStatus = listings.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      {params.removido === '1' && (
        <div
          role="status"
          className="mb-6 rounded-md border border-success/40 bg-success-soft px-4 py-3 text-sm text-success"
        >
          Anúncio excluído.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="text-sm text-fg-muted">
            <span className="font-semibold text-fg tabular">{listings.length}</span>{' '}
            {listings.length === 1 ? 'anúncio' : 'anúncios'}
          </p>
          {(Object.keys(porStatus) as ListingStatus[]).map((status) => (
            <p key={status} className="text-xs text-fg-subtle">
              {LISTING_STATUS_LABELS[status] ?? status}:{' '}
              <span className="tabular">{porStatus[status]}</span>
            </p>
          ))}
        </div>

        <ButtonLink href="/painel/anuncios/novo">
          <Plus size={16} aria-hidden="true" />
          Novo anúncio
        </ButtonLink>
      </div>

      <div className="mt-6">
        {listings.length === 0 ? (
          <EmptyState
            title="Você ainda não tem anúncios"
            description="Crie o primeiro anúncio: preencha a ficha do veículo, envie as fotos e publique."
            action={<ButtonLink href="/painel/anuncios/novo">Anunciar um veículo</ButtonLink>}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {listings.map((listing) => {
              const cover = listing.images[0] ?? null
              const titulo = `${listing.brand} ${listing.model} ${listing.trim}`.trim() || 'Rascunho sem título'

              return (
                <li
                  key={listing.id}
                  className="grid gap-4 rounded-lg border border-line bg-surface-2 p-4 sm:grid-cols-[10rem_1fr]"
                >
                  <div className="overflow-hidden rounded-md">
                    <VehicleImage photo={cover} sizes="160px" ratio="aspect-[4/3]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-fg">{titulo}</h3>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          {listing.modelYear} ·{' '}
                          {listing.priceCents > 0 ? formatPrice(listing.priceCents) : 'sem preço'} ·{' '}
                          {formatKm(listing.mileageKm)}
                        </p>
                      </div>
                      <StatusBadge status={listing.status} />
                    </div>

                    {listing.status === 'REJECTED' && listing.rejectionReason && (
                      <p className="mt-3 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
                        <strong>Motivo da recusa:</strong> {listing.rejectionReason}
                      </p>
                    )}

                    <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-fg-subtle">
                      <div className="flex items-center gap-1.5">
                        <ImageIcon size={13} aria-hidden="true" />
                        <dt className="apenas-leitor">Fotos</dt>
                        <dd className="tabular">{listing._count.images}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Heart size={13} aria-hidden="true" />
                        <dt className="apenas-leitor">Favoritado por</dt>
                        <dd className="tabular">{listing._count.favorites}</dd>
                      </div>
                      {/* Métrica real: só é contada em anúncio publicado. */}
                      <div className="flex items-center gap-1.5">
                        <Eye size={13} aria-hidden="true" />
                        <dt className="apenas-leitor">Visualizações</dt>
                        <dd className="tabular">{formatNumber(listing.viewCount)}</dd>
                      </div>
                      <div>
                        <dt className="apenas-leitor">Atualizado</dt>
                        <dd>Atualizado {formatRelative(listing.updatedAt)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4">
                      <ListingRowActions
                        listingId={listing.id}
                        slug={listing.slug}
                        status={listing.status}
                        title={titulo}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-fg-subtle">
        As visualizações são contadas quando alguém abre a página do anúncio publicado, no máximo
        uma vez por dia para o mesmo visitante.{' '}
        <Link href="/catalogo" className="link-sublinhado">
          Ver como o catálogo exibe seus anúncios
        </Link>
        .
      </p>
    </div>
  )
}
