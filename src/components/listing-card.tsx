import Link from 'next/link'
import { Gauge, MapPin } from 'lucide-react'
import { VehicleImage } from '@/components/vehicle-image'
import { FavoriteButton } from '@/components/favorite-button'
import { DemoBadge } from '@/components/ui/misc'
import { formatKm, formatLocation, formatPrice, formatYearPair } from '@/lib/format'
import { FUEL_LABELS, TRANSMISSION_LABELS, type Fuel, type Transmission } from '@/lib/enums'
import type { ListingCard as ListingCardData } from '@/server/queries'
import { cn } from '@/lib/cn'

/**
 * Card do veículo.
 *
 * Hierarquia fixa, igual em todas as listagens: foto → marca+modelo → versão →
 * preço → dados essenciais → local. O preço fica sempre na mesma linha visual
 * para que a coluna de preços possa ser lida de cima a baixo.
 *
 * O card inteiro é um link; o botão de favoritar fica por cima, fora do <a>,
 * para não virar "link dentro de link" (inválido e confuso no teclado).
 */
export function ListingCard({
  listing,
  priority = false,
  sizes = '(min-width: 1280px) 22vw, (min-width: 768px) 45vw, 92vw',
  className,
}: {
  listing: ListingCardData
  priority?: boolean
  sizes?: string
  className?: string
}) {
  const title = `${listing.brand} ${listing.model}`
  const isSold = listing.status === 'SOLD'

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface-2 transition-[border-color,transform] duration-200',
        'hover:border-line-strong focus-within:border-accent-line motion-safe:hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="relative">
        <VehicleImage
          photo={listing.cover}
          sizes={sizes}
          priority={priority}
          ratio="aspect-[4/3]"
          imgClassName="transition-transform duration-300 motion-safe:group-hover:scale-[1.02]"
        />

        {/* Faixa âmbar que aparece no topo da foto ao focar/passar o mouse:
            o mesmo gesto da régua de instrumento da marca. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-accent-solid transition-transform duration-200 group-hover:scale-x-100 group-focus-within:scale-x-100"
        />

        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {listing.isDemo && <DemoBadge sobreFoto />}
          {isSold && (
            <span className="inline-flex items-center rounded-xs border border-white/25 bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white uppercase">
              Vendido
            </span>
          )}
          {listing.cover?.isIllustrative && (
            <span
              className="inline-flex items-center rounded-xs border border-white/25 bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white"
              title="Foto ilustrativa: não foi possível confirmar que corresponde exatamente a esta versão/ano."
            >
              Foto ilustrativa
            </span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5">
          <FavoriteButton
            listingId={listing.id}
            initialFavorited={listing.favorited}
            label={`${title} ${listing.modelYear}`}
            returnTo={`/veiculo/${listing.slug}`}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base leading-snug font-semibold text-fg">
          <Link
            href={`/veiculo/${listing.slug}`}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {title}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted" title={listing.trim}>
          {listing.trim}
        </p>

        <p className="preco mt-3 text-xl text-fg">{formatPrice(listing.priceCents)}</p>

        <dl className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          <div className="flex items-center gap-1">
            <dt className="apenas-leitor">Ano</dt>
            <dd className="tabular">{formatYearPair(listing.year, listing.modelYear)}</dd>
          </div>
          <span aria-hidden="true" className="text-fg-subtle">
            ·
          </span>
          <div className="flex items-center gap-1">
            <Gauge size={13} aria-hidden="true" />
            <dt className="apenas-leitor">Quilometragem</dt>
            <dd className="tabular">{formatKm(listing.mileageKm)}</dd>
          </div>
          <span aria-hidden="true" className="text-fg-subtle">
            ·
          </span>
          <div>
            <dt className="apenas-leitor">Câmbio</dt>
            <dd>{TRANSMISSION_LABELS[listing.transmission as Transmission] ?? listing.transmission}</dd>
          </div>
          <span aria-hidden="true" className="text-fg-subtle">
            ·
          </span>
          <div>
            <dt className="apenas-leitor">Combustível</dt>
            <dd>{FUEL_LABELS[listing.fuel as Fuel] ?? listing.fuel}</dd>
          </div>
        </dl>

        <p className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-fg-subtle">
          <MapPin size={13} aria-hidden="true" />
          {formatLocation(listing.city, listing.state)}
        </p>
      </div>
    </article>
  )
}

/** Esqueleto com a mesma altura do card, para não deslocar a grade. */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-2">
      <div className="esqueleto aspect-[4/3] w-full" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="esqueleto h-4 w-3/5 rounded-xs" />
        <div className="esqueleto h-3 w-4/5 rounded-xs" />
        <div className="esqueleto mt-2 h-6 w-2/5 rounded-xs" />
        <div className="esqueleto h-3 w-full rounded-xs" />
        <div className="esqueleto h-3 w-1/3 rounded-xs" />
      </div>
    </div>
  )
}
