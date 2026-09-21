import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { UserStatusForm } from '@/components/admin/moderation-forms'
import { Badge, EmptyState, TickRule } from '@/components/ui/misc'
import { Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Contas.
 *
 * A busca é por e-mail ou nome. O e-mail aparece aqui porque a administração
 * precisa dele para moderar — em nenhuma página pública ele é exibido sem a
 * autorização explícita do dono.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const admin = await requireAdmin()
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 80) : ''

  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : undefined,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      suspendedReason: true,
      suspendedAt: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { listings: true, reportsMade: true } },
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Contas</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Suspender uma conta encerra as sessões dela na hora e pausa os anúncios publicados.
      </p>

      <form action="/admin/usuarios" method="get" className="mt-5 flex max-w-md gap-2">
        <label htmlFor="busca-usuarios" className="apenas-leitor">
          Buscar por nome ou e-mail
        </label>
        <Input
          id="busca-usuarios"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou e-mail"
          type="search"
        />
        <Button type="submit" variant="secundario">
          Buscar
        </Button>
      </form>

      <TickRule className="mt-5 mb-6" />

      {users.length === 0 ? (
        <EmptyState
          title="Nenhuma conta encontrada"
          description={q ? `Nada corresponde a "${q}".` : 'Ainda não há contas cadastradas.'}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {users.map((user) => (
            <li key={user.id} className="rounded-lg border border-line bg-surface-2 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-fg">{user.name}</h2>
                  <p className="mt-0.5 text-xs break-all text-fg-muted">{user.email}</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    Cadastro em {formatDateTime(user.createdAt)} ·{' '}
                    <span className="tabular">{user._count.listings}</span> anúncio(s) ·{' '}
                    <span className="tabular">{user._count.reportsMade}</span> denúncia(s) feita(s)
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {user.role === 'ADMIN' && <Badge tone="destaque">Administração</Badge>}
                  <Badge tone={user.status === 'SUSPENDED' ? 'aviso' : 'neutro'}>
                    {user.status === 'SUSPENDED' ? 'Suspensa' : 'Ativa'}
                  </Badge>
                  <Badge tone={user.emailVerifiedAt ? 'neutro' : 'aviso'}>
                    {user.emailVerifiedAt ? 'E-mail confirmado' : 'E-mail não confirmado'}
                  </Badge>
                </div>
              </div>

              {user.status === 'SUSPENDED' && user.suspendedReason && (
                <p className="mt-3 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
                  <strong>Suspensa em {user.suspendedAt ? formatDateTime(user.suspendedAt) : '—'}:</strong>{' '}
                  {user.suspendedReason}
                </p>
              )}

              <div className="mt-4">
                {user.id === admin.id ? (
                  <p className="text-xs text-fg-subtle">Esta é a sua própria conta.</p>
                ) : user.role === 'ADMIN' ? (
                  <p className="text-xs text-fg-subtle">
                    Contas administradoras não podem ser suspensas por esta tela. A alteração de
                    papel exige acesso ao banco de dados.
                  </p>
                ) : (
                  <UserStatusForm userId={user.id} status={user.status} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
