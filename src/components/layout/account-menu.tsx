'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, UserRound } from 'lucide-react'
import { logoutAction } from '@/server/actions/auth'

/**
 * Menu da conta no cabeçalho (telas médias para cima).
 * Fecha ao clicar fora, ao pressionar Esc e ao navegar; o botão anuncia o
 * estado por `aria-expanded` e o menu usa papéis de menu para leitor de tela.
 */
export function AccountMenu({
  name,
  isAdmin,
  emailVerified,
}: {
  name: string
  isAdmin: boolean
  emailVerified: boolean
}) {
  const [open, setOpen] = useState(false)
  const [rotaVista, setRotaVista] = useState<string | null>(null)
  const menuId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Fechar ao navegar é estado derivado da rota, não sincronização com
  // sistema externo: ajustar durante a renderização evita a renderização
  // extra que um efeito com setState provocaria.
  if (rotaVista !== pathname) {
    setRotaVista(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const firstName = name.split(' ')[0] ?? name

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-fg transition-colors hover:border-line-strong"
      >
        <span className="relative">
          <UserRound size={17} aria-hidden="true" />
          {!emailVerified && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent-solid"
            />
          )}
        </span>
        <span className="max-w-24 truncate">{firstName}</span>
        <ChevronDown size={14} aria-hidden="true" className="text-fg-subtle" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Menu da conta"
          className="aparecer absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-line bg-surface-2 shadow-pop"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-fg">{name}</p>
            {!emailVerified && (
              <p className="mt-1 text-xs text-accent">E-mail ainda não confirmado</p>
            )}
          </div>

          <div className="p-1.5">
            <MenuLink href="/painel">Painel do anunciante</MenuLink>
            <MenuLink href="/favoritos">Favoritos</MenuLink>
            <MenuLink href="/conta">Minha conta</MenuLink>
            {isAdmin && (
              <MenuLink href="/admin" className="text-accent">
                Administração
              </MenuLink>
            )}
          </div>

          <div className="border-t border-line p-1.5">
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuLink({
  href,
  children,
  className = '',
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={`flex items-center rounded-md px-2.5 py-2 text-sm text-fg transition-colors hover:bg-surface-3 ${className}`}
    >
      {children}
    </Link>
  )
}
