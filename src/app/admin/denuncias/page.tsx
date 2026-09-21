import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ResolveReport } from '@/components/admin/moderation-forms'
import { Badge, EmptyState, StatusBadge, TickRule } from '@/components/ui/misc'
import {
  REPORT_REASON_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  type ReportReason,
  type ReportStatus,
} from '@/lib/enums'
import { formatDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

/** Fila de denúncias. Cada decisão gera uma linha na auditoria. */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams

  const bruto = typeof params.situacao === 'string' ? params.situacao.toUpperCase() : 'OPEN'
  const situacao = (REPORT_STATUSES as readonly string[]).includes(bruto)
    ? (bruto as ReportStatus)
    : 'OPEN'

  const reports = await prisma.report.findMany({
    where: { status: situacao },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
      handledAt: true,
      resolutionNote: true,
      reporter: { select: { name: true } },
      handler: { select: { name: true } },
      listing: {
        select: {
          id: true,
          slug: true,
          brand: true,
          model: true,
          trim: true,
          status: true,
          seller: { select: { name: true } },
        },
      },
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Denúncias</h1>
      <p className="mt-1 text-sm text-fg-muted">
        <span className="tabular">{reports.length}</span>{' '}
        {reports.length === 1 ? 'denúncia' : 'denúncias'} com a situação{' '}
        <strong>{REPORT_STATUS_LABELS[situacao]}</strong>.
      </p>

      <nav aria-label="Filtrar por situação" className="mt-5">
        <ul className="flex flex-wrap gap-2">
          {REPORT_STATUSES.map((status) => (
            <li key={status}>
              <Link
                href={`/admin/denuncias?situacao=${status}`}
                aria-current={status === situacao ? 'page' : undefined}
                className={`alvo-toque inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors ${
                  status === situacao
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                }`}
              >
                {REPORT_STATUS_LABELS[status]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <TickRule className="mt-5 mb-6" />

      {reports.length === 0 ? (
        <EmptyState
          title="Nenhuma denúncia nesta situação"
          description="Quando alguém denunciar um anúncio, ele aparece aqui para análise."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {reports.map((report) => (
            <li key={report.id} className="rounded-lg border border-line bg-surface-2 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-fg">
                    {REPORT_REASON_LABELS[report.reason as ReportReason] ?? report.reason}
                  </h2>
                  <p className="mt-1 text-xs text-fg-muted">
                    Anúncio:{' '}
                    <Link href={`/veiculo/${report.listing.slug}`} className="link-sublinhado">
                      {report.listing.brand} {report.listing.model} {report.listing.trim}
                    </Link>{' '}
                    · anunciante {report.listing.seller.name} · recebida em{' '}
                    {formatDateTime(report.createdAt)}
                    {report.reporter ? ` · por ${report.reporter.name}` : ' · denúncia anônima'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={report.listing.status} />
                  <Badge tone={report.status === 'OPEN' ? 'destaque' : 'neutro'}>
                    {REPORT_STATUS_LABELS[report.status as ReportStatus] ?? report.status}
                  </Badge>
                </div>
              </div>

              {report.details && (
                <p className="mt-3 rounded-md border border-line bg-surface p-3 text-sm leading-relaxed text-fg-muted">
                  {report.details}
                </p>
              )}

              {report.status === 'OPEN' ? (
                <div className="mt-4">
                  <ResolveReport reportId={report.id} />
                </div>
              ) : (
                <p className="mt-3 text-xs text-fg-subtle">
                  Resolvida por {report.handler?.name ?? 'equipe'} em{' '}
                  {report.handledAt ? formatDateTime(report.handledAt) : '—'}
                  {report.resolutionNote && ` — ${report.resolutionNote}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
