import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { EmptyState, TickRule } from '@/components/ui/misc'
import { ADMIN_ACTION_LABELS, type AdminActionType } from '@/lib/enums'
import { formatDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 40

/**
 * Trilha de auditoria.
 *
 * Somente leitura: não existe tela para editar nem apagar uma linha. Toda ação
 * de moderação grava aqui autor, alvo, motivo e estado anterior — é o que
 * permite revisar uma decisão depois.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const pagina = Math.max(Number.parseInt(String(params.pagina ?? '1'), 10) || 1, 1)

  const [total, acoes] = await Promise.all([
    prisma.adminAction.count(),
    prisma.adminAction.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        reason: true,
        metadata: true,
        createdAt: true,
        admin: { select: { name: true } },
      },
    }),
  ])

  const paginas = Math.max(Math.ceil(total / POR_PAGINA), 1)

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Auditoria</h1>
      <p className="mt-1 text-sm text-fg-muted">
        <span className="tabular">{total}</span> registro(s). Histórico somente leitura.
      </p>

      <TickRule className="mt-5 mb-6" />

      {acoes.length === 0 ? (
        <EmptyState
          title="Nenhuma ação registrada"
          description="Aprovações, rejeições, suspensões e decisões sobre denúncias aparecem aqui."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <caption className="apenas-leitor">Histórico de ações administrativas</caption>
            <thead>
              <tr className="border-b border-line bg-surface-3 text-left">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Quando
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Ação
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Alvo
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Responsável
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Motivo / contexto
                </th>
              </tr>
            </thead>
            <tbody>
              {acoes.map((acao) => (
                <tr key={acao.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 align-top whitespace-nowrap text-fg-muted tabular">
                    {formatDateTime(acao.createdAt)}
                  </td>
                  <td className="px-4 py-3 align-top font-medium">
                    {ADMIN_ACTION_LABELS[acao.action as AdminActionType] ?? acao.action}
                  </td>
                  <td className="px-4 py-3 align-top text-fg-muted">
                    <span className="rotulo">{acao.targetType}</span>
                    <br />
                    <code className="font-mono text-xs">{acao.targetId}</code>
                  </td>
                  <td className="px-4 py-3 align-top text-fg-muted">{acao.admin.name}</td>
                  <td className="px-4 py-3 align-top text-fg-muted">
                    {acao.reason ?? '—'}
                    {acao.metadata !== '{}' && (
                      <code className="mt-1 block font-mono text-[11px] text-fg-subtle">
                        {acao.metadata}
                      </code>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav aria-label="Paginação" className="mt-6 flex items-center justify-center gap-3">
          {pagina > 1 && (
            <Link
              href={`/admin/auditoria?pagina=${pagina - 1}`}
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
              href={`/admin/auditoria?pagina=${pagina + 1}`}
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
