import { ListingCardSkeleton } from '@/components/listing-card'
import { TickRule } from '@/components/ui/misc'

/**
 * Estado de carregamento do catálogo.
 * Reproduz a mesma grade da página final para que o conteúdo real entre no
 * lugar dos esqueletos sem empurrar nada.
 */
export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="esqueleto h-3 w-40 rounded-xs" />
      <div className="esqueleto mt-5 h-9 w-56 rounded-sm" />
      <div className="esqueleto mt-3 h-4 w-72 rounded-xs" />

      <TickRule className="mt-6" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[17rem_1fr] xl:grid-cols-[19rem_1fr]">
        <div className="hidden flex-col gap-7 lg:flex" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <div className="esqueleto h-3 w-24 rounded-xs" />
              <div className="esqueleto h-9 w-full rounded-sm" />
              <div className="esqueleto h-9 w-full rounded-sm" />
            </div>
          ))}
        </div>

        <div>
          <span className="apenas-leitor" role="status">
            Carregando resultados do catálogo
          </span>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <li key={i}>
                <ListingCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
