import Link from 'next/link'
import { Heart, Plus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Logo } from '@/components/brand/logo'
import { SearchBar } from './search-bar'
import { MobileMenu } from './mobile-menu'
import { AccountMenu } from './account-menu'

const NAV = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/catalogo?carroceria=SUV', label: 'SUVs' },
  { href: '/catalogo?carroceria=PICAPE', label: 'Picapes' },
  { href: '/catalogo?ordenar=preco-asc', label: 'Menor preço' },
]

/**
 * Cabeçalho fixo.
 *
 * Renderizado no servidor: quem está conectado já recebe o HTML com seu nome e
 * a contagem de favoritos, sem piscar "Entrar" antes de hidratar.
 */
export async function Header({ showSearch = true }: { showSearch?: boolean }) {
  const user = await getCurrentUser()

  const favoriteCount = user
    ? await prisma.favorite.count({ where: { userId: user.id } })
    : 0

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:h-18 lg:gap-6 lg:px-10">
        <Link href="/" className="shrink-0" aria-label="Motriz — página inicial">
          <Logo />
        </Link>

        <nav aria-label="Navegação principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {showSearch && (
          <div className="ml-auto hidden max-w-sm flex-1 lg:block">
            <SearchBar id="busca-cabecalho" />
          </div>
        )}

        <div className={`flex items-center gap-2 ${showSearch ? 'ml-auto lg:ml-0' : 'ml-auto'}`}>
          <Link
            href="/favoritos"
            className="relative hidden size-11 items-center justify-center rounded-md border border-line text-fg-muted transition-colors hover:border-line-strong hover:text-fg sm:inline-flex"
          >
            <Heart size={18} aria-hidden="true" />
            <span className="apenas-leitor">
              Favoritos{favoriteCount > 0 ? ` (${favoriteCount})` : ''}
            </span>
            {favoriteCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent-solid px-1 text-[11px] font-bold text-accent-solid-fg tabular"
              >
                {favoriteCount > 99 ? '99+' : favoriteCount}
              </span>
            )}
          </Link>

          <Link
            href="/painel/anuncios/novo"
            className="hidden h-11 items-center gap-1.5 rounded-md bg-accent-solid px-4 text-sm font-semibold text-accent-solid-fg transition-colors hover:bg-[color-mix(in_srgb,var(--accent-solid)_88%,#fff)] md:inline-flex"
          >
            <Plus size={16} aria-hidden="true" />
            Anunciar
          </Link>

          {user ? (
            <div className="hidden lg:block">
              <AccountMenu
                name={user.name}
                isAdmin={user.role === 'ADMIN'}
                emailVerified={Boolean(user.emailVerifiedAt)}
              />
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link
                href="/entrar"
                className="inline-flex h-11 items-center rounded-md border border-line px-4 text-sm font-medium text-fg transition-colors hover:border-line-strong"
              >
                Entrar
              </Link>
            </div>
          )}

          <MobileMenu
            items={NAV}
            account={user ? { name: user.name, isAdmin: user.role === 'ADMIN' } : null}
          />
        </div>
      </div>
    </header>
  )
}
