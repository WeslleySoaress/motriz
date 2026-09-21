import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { catalogHref, type CatalogFilters } from '@/lib/catalog'
import { cn } from '@/lib/cn'

/**
 * Paginação por links reais.
 *
 * Escolhida em vez de rolagem infinita porque mantém a posição compartilhável,
 * funciona com teclado e leitor de tela e não obriga o navegador a guardar
 * centenas de cards em memória.
 */
export function Pagination({
  filters,
  page,
  pageCount,
}: {
  filters: CatalogFilters
  page: number
  pageCount: number
}) {
  if (pageCount <= 1) return null

  const pages = pageWindow(page, pageCount)

  return (
    <nav aria-label="Paginação dos resultados" className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          <PageLink
            href={catalogHref({ ...filters, page: page - 1 })}
            disabled={page <= 1}
            label="Página anterior"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </PageLink>
        </li>

        {pages.map((p, index) =>
          p === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1.5 text-fg-subtle">
              …
            </li>
          ) : (
            <li key={p}>
              <PageLink
                href={catalogHref({ ...filters, page: p })}
                current={p === page}
                label={`Página ${p}`}
              >
                <span className="tabular">{p}</span>
              </PageLink>
            </li>
          ),
        )}

        <li>
          <PageLink
            href={catalogHref({ ...filters, page: page + 1 })}
            disabled={page >= pageCount}
            label="Próxima página"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </PageLink>
        </li>
      </ul>

      <p className="mt-3 text-center text-xs text-fg-subtle">
        Página <span className="tabular">{page}</span> de{' '}
        <span className="tabular">{pageCount}</span>
      </p>
    </nav>
  )
}

function PageLink({
  href,
  children,
  label,
  current = false,
  disabled = false,
}: {
  href: string
  children: React.ReactNode
  label: string
  current?: boolean
  disabled?: boolean
}) {
  const className = cn(
    'inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors',
    current
      ? 'border-accent-line bg-accent-soft text-accent'
      : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
    disabled && 'pointer-events-none opacity-40',
  )

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {children}
        <span className="apenas-leitor">{label}</span>
      </span>
    )
  }

  return (
    <Link href={href} className={className} aria-current={current ? 'page' : undefined}>
      {children}
      <span className="apenas-leitor">{label}</span>
    </Link>
  )
}

/** 1 … 4 [5] 6 … 12 — no máximo 7 posições, sempre com primeira e última. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)

  const pages = new Set<number>([1, pageCount, page])
  if (page - 1 > 1) pages.add(page - 1)
  if (page + 1 < pageCount) pages.add(page + 1)
  if (page <= 3) pages.add(2).add(3).add(4)
  if (page >= pageCount - 2) pages.add(pageCount - 1).add(pageCount - 2).add(pageCount - 3)

  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
  const out: (number | null)[] = []
  let previous = 0
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push(null)
    out.push(p)
    previous = p
  }
  return out
}
