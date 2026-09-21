import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { TickRule } from '@/components/ui/misc'
import { ADMIN_ACTION_LABELS, type AdminActionType } from '@/lib/enums'
import { formatDateTime, formatNumber } from '@/lib/format'

export const dynamic = 'force-dynamic'

/** Visão geral: números reais, sem estimativa nem projeção. */
export default async function AdminHome() {
  await requireAdmin()

  const [porStatus, denunciasAbertas, contas, suspensas, ultimasAcoes] = await Promise.all([
    prisma.listing.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.user.count(),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.adminAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        reason: true,
        createdAt: true,
        admin: { select: { name: true } },
      },
    }),
  ])

  const contagem = Object.fromEntries(porStatus.map((r) => [r.status, r._count.status]))

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Visão geral</h1>
      <TickRule className="mt-4 mb-8" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          titulo="Aguardando análise"
          valor={contagem.PENDING ?? 0}
          href="/admin/anuncios?situacao=PENDING"
          destaque={(contagem.PENDING ?? 0) > 0}
        />
        <Cartao
          titulo="Denúncias em aberto"
          valor={denunciasAbertas}
          href="/admin/denuncias"
          destaque={denunciasAbertas > 0}
        />
        <Cartao titulo="Anúncios publicados" valor={contagem.PUBLISHED ?? 0} href="/admin/anuncios?situacao=PUBLISHED" />
        <Cartao titulo="Contas" valor={contas} href="/admin/usuarios" nota={suspensas > 0 ? `${suspensas} suspensa(s)` : undefined} />
      </div>

      <section aria-labelledby="ultimas" className="mt-12">
        <h2 id="ultimas" className="rotulo mb-3">
          Últimas ações administrativas
        </h2>
        <TickRule className="mb-4" />

        {ultimasAcoes.length === 0 ? (
          <p className="text-sm text-fg-muted">Nenhuma ação registrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ultimasAcoes.map((acao) => (
              <li
                key={acao.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-line bg-surface-2 px-4 py-3 text-sm"
              >
                <span className="text-fg">
                  {ADMIN_ACTION_LABELS[acao.action as AdminActionType] ?? acao.action}
                  <span className="text-fg-muted"> por {acao.admin.name}</span>
                  {acao.reason && <span className="text-fg-subtle"> — {acao.reason}</span>}
                </span>
                <span className="text-xs text-fg-subtle">{formatDateTime(acao.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-sm">
          <Link href="/admin/auditoria" className="link-sublinhado text-accent">
            Ver histórico completo
          </Link>
        </p>
      </section>
    </div>
  )
}

function Cartao({
  titulo,
  valor,
  href,
  nota,
  destaque = false,
}: {
  titulo: string
  valor: number
  href: string
  nota?: string
  destaque?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-5 transition-colors ${
        destaque
          ? 'border-accent-line bg-accent-soft hover:border-accent-solid'
          : 'border-line bg-surface-2 hover:border-line-strong'
      }`}
    >
      <p className="rotulo">{titulo}</p>
      <p className={`preco mt-2 text-3xl ${destaque ? 'text-accent' : 'text-fg'}`}>
        {formatNumber(valor)}
      </p>
      {nota && <p className="mt-1 text-xs text-fg-subtle">{nota}</p>}
    </Link>
  )
}
