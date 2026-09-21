'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toggleFavoriteAction } from '@/server/actions/listings'
import { cn } from '@/lib/cn'

/**
 * Botão de favoritar.
 *
 * O estado muda na hora (otimista) e volta atrás se o servidor recusar — a
 * verdade continua sendo a resposta do servidor. Visitante não logado é levado
 * para a tela de entrada, guardando a página de origem para voltar depois.
 */
export function FavoriteButton({
  listingId,
  initialFavorited,
  label,
  variant = 'icone',
  returnTo,
  className,
}: {
  listingId: string
  initialFavorited: boolean
  label: string
  variant?: 'icone' | 'completo'
  returnTo?: string
  className?: string
}) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleClick() {
    const previous = favorited
    setFavorited(!previous)
    setError(null)

    startTransition(async () => {
      const result = await toggleFavoriteAction(listingId)

      if (result.requiresLogin) {
        setFavorited(previous)
        const next = returnTo ?? window.location.pathname + window.location.search
        router.push(`/entrar?proximo=${encodeURIComponent(next)}`)
        return
      }

      if (!result.ok) {
        setFavorited(previous)
        setError(result.message ?? 'Não foi possível salvar o favorito.')
        return
      }

      setFavorited(Boolean(result.favorited))
      router.refresh()
    })
  }

  const accessibleLabel = favorited
    ? `Remover ${label} dos favoritos`
    : `Salvar ${label} nos favoritos`

  if (variant === 'completo') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          aria-pressed={favorited}
          className={cn(
            'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors duration-150 disabled:opacity-60',
            favorited
              ? 'border-accent-line bg-accent-soft text-accent'
              : 'border-line-strong text-fg hover:border-accent-line',
          )}
        >
          <Heart
            size={17}
            aria-hidden="true"
            className={favorited ? 'fill-current' : undefined}
          />
          {favorited ? 'Salvo nos favoritos' : 'Salvar nos favoritos'}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md border backdrop-blur-sm transition-colors duration-150 disabled:opacity-60',
        favorited
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-white/20 bg-black/45 text-white hover:border-white/45',
        className,
      )}
    >
      <Heart size={16} aria-hidden="true" className={favorited ? 'fill-current' : undefined} />
    </button>
  )
}
