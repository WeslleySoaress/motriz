import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { LISTING_STATUS_LABELS, type ListingStatus } from '@/lib/enums'

/** Selo de estado. Sem cor arbitrária: cada estado tem um tom fixo. */
export function StatusBadge({ status }: { status: string }) {
  const label = LISTING_STATUS_LABELS[status as ListingStatus] ?? status
  const tone: Record<string, string> = {
    PUBLISHED: 'border-success/40 bg-success-soft text-success',
    SOLD: 'border-line-strong bg-surface-3 text-fg-muted',
    PENDING: 'border-accent-line bg-accent-soft text-accent',
    DRAFT: 'border-line-strong bg-surface-3 text-fg-muted',
    PAUSED: 'border-line-strong bg-surface-3 text-fg-muted',
    REJECTED: 'border-danger/40 bg-danger-soft text-danger',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        tone[status] ?? 'border-line-strong bg-surface-3 text-fg-muted',
      )}
    >
      {label}
    </span>
  )
}

export function Badge({
  children,
  tone = 'neutro',
  className,
}: {
  children: ReactNode
  tone?: 'neutro' | 'destaque' | 'aviso'
  className?: string
}) {
  const tones = {
    neutro: 'border-line-strong bg-surface-3 text-fg-muted',
    destaque: 'border-accent-line bg-accent-soft text-accent',
    aviso: 'border-danger/40 bg-danger-soft text-danger',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 text-[11px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Aviso de conteúdo demonstrativo.
 * Todo dado criado pelo seed carrega este selo: nenhuma pessoa deve confundir
 * anúncio de demonstração com veículo realmente à venda.
 */
export function DemoBadge({
  className,
  sobreFoto = false,
}: {
  className?: string
  /** Sobre fotografia o âmbar translúcido desaparece em carros claros: aí
   *  usamos um chip opaco escuro, legível em qualquer imagem. */
  sobreFoto?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 text-[11px] font-semibold',
        sobreFoto
          ? 'border-white/25 bg-black/70 text-white backdrop-blur-sm'
          : 'border-accent-line bg-accent-soft text-accent',
        className,
      )}
      title="Anúncio de demonstração criado para avaliar a plataforma. O veículo não está à venda."
    >
      Demonstração
    </span>
  )
}

export function SectionTitle({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {kicker && <p className="rotulo mb-2">{kicker}</p>}
        <h2 className="text-2xl leading-tight sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm text-fg-muted sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function TickRule({ dense = false, className }: { dense?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(dense ? 'regua-tick-densa' : 'regua-tick', 'w-full', className)}
    />
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface-2 px-6 py-16 text-center">
      {icon && <div className="mb-4 text-fg-subtle">{icon}</div>}
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/** Bloco de erro com opção de tentar novamente (usado nos error.tsx). */
export function ErrorState({
  title = 'Algo deu errado',
  description,
  errorId,
  action,
}: {
  title?: string
  description: string
  errorId?: string
  action?: ReactNode
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger-soft px-6 py-14 text-center"
    >
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>
      {errorId && (
        <p className="mt-2 font-mono text-xs text-fg-subtle">
          Código para suporte: <span className="text-fg-muted">{errorId}</span>
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/** Linha "rótulo / valor" das fichas técnicas. */
export function SpecRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-fg tabular">{value}</dd>
    </div>
  )
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {item.href ? (
              <Link href={item.href} className="hover:text-fg">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-fg">
                {item.label}
              </span>
            )}
            {i < items.length - 1 && (
              <span aria-hidden="true" className="text-fg-subtle">
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
