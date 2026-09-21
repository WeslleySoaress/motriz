'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Busca por marca, modelo ou versão.
 *
 * É um <form> de verdade com método GET: funciona com Enter, com o botão de
 * busca do teclado do celular e, se o JavaScript falhar, o navegador ainda
 * navega para /catalogo com o termo. O `router.push` só melhora a transição.
 */
export function SearchBar({
  defaultValue = '',
  size = 'md',
  autoFocus = false,
  className,
  placeholder = 'Busque por marca, modelo ou versão',
  id = 'busca',
}: {
  defaultValue?: string
  size?: 'md' | 'lg'
  autoFocus?: boolean
  className?: string
  placeholder?: string
  id?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <form
      action="/catalogo"
      method="get"
      role="search"
      className={cn('relative w-full', className)}
      onSubmit={(event) => {
        event.preventDefault()
        const value = inputRef.current?.value.trim() ?? ''
        router.push(value ? `/catalogo?q=${encodeURIComponent(value)}` : '/catalogo')
      }}
    >
      <label htmlFor={id} className="apenas-leitor">
        Buscar veículos
      </label>
      <Search
        aria-hidden="true"
        size={size === 'lg' ? 20 : 17}
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-subtle',
          size === 'lg' ? 'left-5' : 'left-3.5',
        )}
      />
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-line bg-surface-2 text-fg placeholder:text-fg-subtle',
          'transition-colors duration-150 hover:border-line-strong focus:border-accent-solid',
          size === 'lg'
            ? 'h-14 pl-13 pr-30 text-base sm:h-16 sm:pl-14 sm:pr-34'
            : 'h-11 pl-10 pr-4 text-sm',
        )}
      />
      {size === 'lg' && (
        <button
          type="submit"
          className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-md bg-accent-solid px-4 text-sm font-semibold text-accent-solid-fg transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent-solid)_88%,#fff)] sm:h-12 sm:px-6"
        >
          Buscar
        </button>
      )}
    </form>
  )
}
