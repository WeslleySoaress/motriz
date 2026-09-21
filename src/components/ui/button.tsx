import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Botão e link com a mesma aparência. `Link` é usado para navegação e `button`
 * para ação — nunca o contrário, para que teclado, leitor de tela e "abrir em
 * nova aba" funcionem como a pessoa espera.
 */

export type ButtonVariant = 'primario' | 'secundario' | 'contorno' | 'fantasma' | 'perigo'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap ' +
  'transition-[background-color,border-color,color,transform] duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-50 active:translate-y-px select-none'

const variants: Record<ButtonVariant, string> = {
  primario:
    'bg-accent-solid text-accent-solid-fg hover:bg-[color-mix(in_srgb,var(--accent-solid)_88%,#fff)]',
  secundario: 'bg-surface-3 text-fg hover:bg-line border border-line-strong',
  contorno: 'border border-line-strong text-fg hover:border-accent-line hover:text-accent',
  fantasma: 'text-fg-muted hover:text-fg hover:bg-surface-3',
  perigo: 'border border-danger/40 text-danger hover:bg-danger-soft',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
}

type CommonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

export function Button({
  variant = 'primario',
  size = 'md',
  className,
  children,
  ...props
}: CommonProps & ComponentProps<'button'>) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primario',
  size = 'md',
  className,
  children,
  ...props
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  )
}

export { base as buttonBase, variants as buttonVariants, sizes as buttonSizes }
