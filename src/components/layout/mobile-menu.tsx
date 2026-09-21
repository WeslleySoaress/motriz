'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { SearchBar } from './search-bar'
import { logoutAction } from '@/server/actions/auth'

type NavItem = { href: string; label: string }

/**
 * Menu de navegação para telas pequenas.
 *
 * Acessibilidade tratada à mão porque é um painel sobreposto:
 *  - `aria-expanded`/`aria-controls` no botão;
 *  - foco vai para o painel ao abrir e volta ao botão ao fechar;
 *  - Esc fecha;
 *  - Tab circula dentro do painel enquanto ele está aberto;
 *  - a rolagem do fundo é travada.
 */
export function MobileMenu({
  items,
  account,
}: {
  items: NavItem[]
  account: { name: string; isAdmin: boolean } | null
}) {
  const [open, setOpen] = useState(false)
  const [rotaVista, setRotaVista] = useState<string | null>(null)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Navegou? Fecha — senão o painel fica aberto por cima da página nova.
  // É estado derivado da rota, então ajustamos durante a renderização em vez
  // de usar efeito com setState, que causaria uma renderização extra.
  if (rotaVista !== pathname) {
    setRotaVista(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex size-11 items-center justify-center rounded-md border border-line text-fg-muted hover:text-fg lg:hidden"
      >
        <Menu size={20} aria-hidden="true" />
        <span className="apenas-leitor">Abrir menu</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            tabIndex={-1}
            className="absolute inset-x-0 top-0 max-h-dvh overflow-y-auto border-b border-line bg-surface px-4 pt-4 pb-8 shadow-pop outline-none"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 items-center justify-center rounded-md border border-line text-fg-muted hover:text-fg"
              >
                <X size={20} aria-hidden="true" />
                <span className="apenas-leitor">Fechar menu</span>
              </button>
            </div>

            <div className="mt-5">
              <SearchBar id="busca-menu" />
            </div>

            <nav aria-label="Navegação principal" className="mt-6">
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex min-h-12 items-center rounded-md px-3 text-base font-medium text-fg hover:bg-surface-3"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-6 border-t border-line pt-6">
              {account ? (
                <ul className="flex flex-col gap-1">
                  <li className="px-3 pb-2 text-sm text-fg-muted">
                    Conectado como <span className="font-medium text-fg">{account.name}</span>
                  </li>
                  <li>
                    <Link
                      href="/painel"
                      className="flex min-h-12 items-center rounded-md px-3 font-medium text-fg hover:bg-surface-3"
                    >
                      Painel do anunciante
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/favoritos"
                      className="flex min-h-12 items-center rounded-md px-3 font-medium text-fg hover:bg-surface-3"
                    >
                      Favoritos
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/conta"
                      className="flex min-h-12 items-center rounded-md px-3 font-medium text-fg hover:bg-surface-3"
                    >
                      Minha conta
                    </Link>
                  </li>
                  {account.isAdmin && (
                    <li>
                      <Link
                        href="/admin"
                        className="flex min-h-12 items-center rounded-md px-3 font-medium text-accent hover:bg-surface-3"
                      >
                        Administração
                      </Link>
                    </li>
                  )}
                  <li>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="flex min-h-12 w-full items-center rounded-md px-3 text-left font-medium text-fg-muted hover:bg-surface-3 hover:text-fg"
                      >
                        Sair
                      </button>
                    </form>
                  </li>
                </ul>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <Link
                    href="/entrar"
                    className="flex h-12 items-center justify-center rounded-md border border-line-strong font-semibold text-fg"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/criar-conta"
                    className="flex h-12 items-center justify-center rounded-md bg-accent-solid font-semibold text-accent-solid-fg"
                  >
                    Criar conta
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
