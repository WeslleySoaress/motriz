import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { VehicleImage } from '@/components/vehicle-image'
import { ModerateListing, SuspendListing } from '@/components/admin/moderation-forms'
import { EmptyState, StatusBadge, TickRule } from '@/components/ui/misc'
import { LISTING_STATUSES, LISTING_STATUS_LABELS, type ListingStatus } from '@/lib/enums'
import { formatKm, formatPrice, formatRelative } from '@/lib/format'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 20

/**
 * Fila de moderação.
 *
 * Por padrão mostra o que está aguardando análise — é o trabalho pendente.
 * O filtro por situação permite auditar qualquer estado, inclusive rascunhos
 * (que aqui são visíveis por serem competência da administração, e apenas
 * aqui).
 */
export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams

  const bruto = typeof params.situacao === 'string' ? params.situacao.toUpperCase() : 'PENDING'
  const situacao = (LISTING_STATUSES as readonly string[]).includes(bruto)
    ? (bruto as ListingStatus)
    : 'PENDING'

  const pagina = Math.max(Number.parseInt(String(params.pagina ?? '1'), 10) || 1, 1)

  const [total, listings] = await Promise.all([
    prisma.listing.count({ where: { status: situacao } }),
    prisma.listing.findMany({
      where: { status: situacao },
      orderBy: { updatedAt: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        slug: true,
        brand: true,
        model: true,
        trim: true,
        modelYear: true,
        priceCents: true,
        mileageKm: true,
        city: true,
        state: true,
        status: true,
        rejectionReason: true,
        updatedAt: true,
        isDemo: true,
        seller: { select: { id: true, name: true, email: true, status: true } },
        _count: { select: { images: true, reports: true } },
        images: {
          where: { isCover: true },
          take: 1,
          select: { storageKey: true, thumbKey: true, width: true, height: true, alt: true },
        },
      },
    }),
  ])

  const paginas = Math.max(Math.ceil(total / POR_PAGINA), 1)

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Anúncios</h1>
      <p className="mt-1 text-sm text-fg-muted">
        <span className="tabular">{total}</span>{' '}
        {total === 1 ? 'anúncio' : 'anúncios'} com a situação{' '}
        <strong>{LISTING_STATUS_LABELS[situacao]}</strong>.
      </p>

      <nav aria-label="Filtrar por situação" className="mt-5">
        <ul className="trilha-x flex gap-2 overflow-x-auto pb-1">
          {LISTING_STATUSES.map((status) => (
            <li key={status}>
              <Link
                href={`/admin/anuncios?situacao=${status}`}
                aria-current={status === situacao ? 'page' : undefined}
                className={`alvo-toque inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  status === situacao
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                }`}
              >
                {LISTING_STATUS_LABELS[status]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <TickRule className="mt-5 mb-6" />

      {listings.length === 0 ? (
        <EmptyState
          title="Nada por aqui"
          description={`Nenhum anúncio com a situação "${LISTING_STATUS_LABELS[situacao]}" no momento.`}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {listings.map((listing) => (
            <li
              key={listing.id}
              className="grid gap-4 rounded-lg border border-line bg-surface-2 p-4 sm:grid-cols-[9rem_1fr]"
            >
              <div className="overflow-hidden rounded-md">
                <VehicleImage
                  photo={listing.images[0] ?? null}
                  sizes="144px"
                  ratio="aspect-[4/3]"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-fg">
                      {listing.brand} {listing.model}{' '}
                      <span className="font-normal text-fg-muted">{listing.trim}</span>
                    </h2>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {listing.modelYear} · {formatPrice(listing.priceCents)} ·{' '}
                      {formatKm(listing.mileageKm)} · {listing.city}/{listing.state}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {listing.isDemo && (
                      <span className="inline-flex items-center rounded-xs border border-line-strong px-2 py-0.5 text-[11px] text-fg-subtle">
                        Demonstração
                      </span>
                    )}
                    <StatusBadge status={listing.status} />
                  </div>
                </div>

                <p className="mt-2 text-xs text-fg-subtle">
                  Anunciante:{' '}
                  <Link href={`/admin/usuarios?q=${encodeURIComponent(listing.seller.email)}`} className="link-sublinhado">
                    {listing.seller.name}
                  </Link>
                  {listing.seller.status === 'SUSPENDED' && (
                    <span className="ml-1 text-danger">(conta suspensa)</span>
                  )}
                  {' · '}
                  <span className="tabular">{listing._count.images}</span> foto(s)
                  {listing._count.reports > 0 && (
                    <>
                      {' · '}
                      <span className="text-danger">
                        <span className="tabular">{listing._count.reports}</span> denúncia(s)
                      </span>
                    </>
                  )}
                  {' · '}Atualizado {formatRelative(listing.updatedAt)}
                </p>

                {listing.rejectionReason && (
                  <p className="mt-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
                    <strong>Motivo registrado:</strong> {listing.rejectionReason}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-start gap-3">
                  <Link
                    href={`/veiculo/${listing.slug}`}
                    className="alvo-toque inline-flex h-9 items-center rounded-md border border-line-strong px-3 text-sm font-medium text-fg transition-colors hover:border-accent-line"
                  >
                    Abrir anúncio
                  </Link>

                  {listing.status === 'PENDING' && <ModerateListing listingId={listing.id} />}
                  {listing.status === 'PUBLISHED' && <SuspendListing listingId={listing.id} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && (
        <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-2">
          {pagina > 1 && (
            <Link
              href={`/admin/anuncios?situacao=${situacao}&pagina=${pagina - 1}`}
              className="alvo-toque inline-flex h-10 items-center rounded-md border border-line px-4 text-sm"
            >
              Anterior
            </Link>
          )}
          <span className="text-sm text-fg-muted tabular">
            {pagina} / {paginas}
          </span>
          {pagina < paginas && (
            <Link
              href={`/admin/anuncios?situacao=${situacao}&pagina=${pagina + 1}`}
              className="alvo-toque inline-flex h-10 items-center rounded-md border border-line px-4 text-sm"
            >
              Próxima
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
