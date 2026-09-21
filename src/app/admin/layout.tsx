import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Logo } from '@/components/brand/logo'
import { TickRule } from '@/components/ui/misc'
import { logoutAction } from '@/server/actions/auth'

export const dynamic = 'force-dynamic'

/**
 * Área administrativa.
 *
 * `requireAdmin` roda no servidor a cada requisição e devolve 404 (não 403)
 * para quem não é administrador: não confirmamos sequer que a área existe.
 * Cada server action de moderação repete a checagem — o layout sozinho não
 * protege um endpoint.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()

  const [pendentes, denuncias] = await Promise.all([
    prisma.listing.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
  ])

  const itens = [
    { href: '/admin', label: 'Visão geral' },
    { href: '/admin/anuncios', label: 'Anúncios', badge: pendentes },
    { href: '/admin/denuncias', label: 'Denúncias', badge: denuncias },
    { href: '/admin/usuarios', label: 'Contas' },
    { href: '/admin/auditoria', label: 'Auditoria' },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Motriz — página inicial">
              <Logo showWord={false} markSize={26} />
            </Link>
            <span className="rotulo text-accent">Administração</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-fg-muted sm:inline">{admin.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="alvo-toque inline-flex h-10 items-center rounded-md border border-line px-3 text-sm text-fg-muted transition-colors hover:text-fg"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Seções da administração" className="border-t border-line">
          <ul className="trilha-x mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-10">
            {itens.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="alvo-toque inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  {item.label}
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent-solid px-1 text-[11px] font-bold text-accent-solid-fg tabular">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <TickRule />

      <main id="conteudo" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 lg:px-10">
        {children}
      </main>
    </div>
  )
}
