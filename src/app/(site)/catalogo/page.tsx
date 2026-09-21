import type { Metadata } from 'next'
import Link from 'next/link'
import { X } from 'lucide-react'
import { ListingCard } from '@/components/listing-card'
import { SearchBar } from '@/components/layout/search-bar'
import { FiltersPanel } from '@/components/catalog/filters-panel'
import { SortSelect } from '@/components/catalog/sort-select'
import { Pagination } from '@/components/catalog/pagination'
import { Breadcrumbs, EmptyState, TickRule } from '@/components/ui/misc'
import { ButtonLink } from '@/components/ui/button'
import {
  catalogHref,
  describeActiveFilters,
  hasActiveFilters,
  parseFilters,
  PAGE_SIZE,
} from '@/lib/catalog'
import {
  getAvailableBrands,
  getAvailableStates,
  getBodyTypeCounts,
  searchListings,
} from '@/server/queries'
import { BODY_TYPE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/enums'
import { formatNumber, formatPriceShort, pluralize } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Catálogo de veículos',
  description: 'Busque por marca, modelo, preço, ano, quilometragem, câmbio, combustível e região.',
}

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Catálogo.
 *
 * Todo o estado (busca, filtros, ordenação, página) vem da URL e é lido no
 * servidor. Consequências práticas: a busca é compartilhável por link, o botão
 * "voltar" do navegador funciona, e o servidor nunca depende de algo que só
 * existe no cliente para decidir o que mostrar.
 */
export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const filters = parseFilters(params)

  const [result, brands, states, bodyCounts] = await Promise.all([
    searchListings(filters),
    getAvailableBrands(),
    getAvailableStates(),
    getBodyTypeCounts(),
  ])

  const chips = describeActiveFilters(filters, {
    fuel: FUEL_LABELS,
    transmission: TRANSMISSION_LABELS,
    bodyType: BODY_TYPE_LABELS,
    priceShort: formatPriceShort,
    number: formatNumber,
  })

  const primeiro = (filters.page - 1) * PAGE_SIZE + 1
  const ultimo = Math.min(filters.page * PAGE_SIZE, result.total)

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Catálogo' }]} />

      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl leading-tight font-extrabold tracking-[-0.03em] sm:text-4xl">
            Catálogo
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            {result.total > 0 ? (
              <>
                <span className="font-medium text-fg tabular">{formatNumber(result.total)}</span>{' '}
                {pluralize(result.total, 'veículo encontrado', 'veículos encontrados')}
                {result.total > PAGE_SIZE && (
                  <>
                    {' '}
                    · exibindo <span className="tabular">{primeiro}</span>–
                    <span className="tabular">{ultimo}</span>
                  </>
                )}
              </>
            ) : (
              'Nenhum veículo encontrado com esses filtros.'
            )}
          </p>
        </div>

        <div className="w-full max-w-md lg:w-auto">
          <SearchBar defaultValue={filters.q} id="busca-catalogo" />
        </div>
      </div>

      <TickRule className="mt-6" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[17rem_1fr] xl:grid-cols-[19rem_1fr]">
        {/* ── Coluna de filtros ───────────────────────────────────────── */}
        <aside aria-label="Filtros" className="lg:sticky lg:top-24 lg:self-start">
          <FiltersPanel
            filters={filters}
            brands={brands}
            states={states}
            bodyCounts={bodyCounts}
            resultCount={result.total}
          />
        </aside>

        {/* ── Resultados ──────────────────────────────────────────────── */}
        <section aria-label="Resultados da busca">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {hasActiveFilters(filters) && (
                <ul className="flex flex-wrap items-center gap-2">
                  <li className="text-xs text-fg-subtle">Filtros ativos:</li>
                  {chips.map((chip, index) => (
                    <li key={`${chip.label}-${index}`}>
                      <Link
                        href={catalogHref(chip.removed)}
                        className="alvo-toque inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface-2 py-1.5 pr-2 pl-3 text-sm text-fg transition-colors hover:border-danger/50 hover:text-danger"
                      >
                        {chip.label}
                        <X size={14} aria-hidden="true" />
                        <span className="apenas-leitor">Remover filtro {chip.label}</span>
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href="/catalogo"
                      className="alvo-toque inline-flex items-center px-2 py-1.5 text-sm font-medium text-fg-muted underline underline-offset-3 hover:text-fg"
                    >
                      Limpar todos
                    </Link>
                  </li>
                </ul>
              )}
            </div>
            <SortSelect value={filters.sort} />
          </div>

          <div className="mt-6">
            {result.items.length === 0 ? (
              <EmptyState
                title="Nenhum veículo com esses filtros"
                description={
                  hasActiveFilters(filters)
                    ? 'Tente remover algum filtro, ampliar a faixa de preço ou buscar por outro termo.'
                    : 'Ainda não há anúncios publicados no catálogo. Que tal ser o primeiro a anunciar?'
                }
                action={
                  hasActiveFilters(filters) ? (
                    <ButtonLink href="/catalogo" variant="contorno">
                      Limpar filtros
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/painel/anuncios/novo">Anunciar um veículo</ButtonLink>
                  )
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((listing, index) => (
                  <li key={listing.id}>
                    <ListingCard
                      listing={listing}
                      priority={index < 3}
                      sizes="(min-width: 1280px) 28vw, (min-width: 640px) 44vw, 92vw"
                      className="h-full"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Pagination filters={filters} page={result.page} pageCount={result.pageCount} />
        </section>
      </div>
    </div>
  )
}
