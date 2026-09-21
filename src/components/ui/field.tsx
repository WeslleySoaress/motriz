import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Campos de formulário acessíveis.
 *
 * Cada campo tem: rótulo visível ligado pelo `id`, instrução opcional e
 * mensagem de erro. Erro e instrução entram em `aria-describedby`, e o campo
 * com erro recebe `aria-invalid` — assim o leitor de tela anuncia o problema
 * junto com o campo, não só visualmente.
 */

const controlBase =
  'w-full rounded-md border bg-surface-2 px-3.5 text-fg placeholder:text-fg-subtle ' +
  'transition-colors duration-150 border-line ' +
  'hover:border-line-strong focus:border-accent-solid ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  children: (props: {
    id: string
    'aria-describedby'?: string
    'aria-invalid'?: true
    'aria-required'?: true
  }) => ReactNode
  className?: string
}) {
  const hintId = hint ? `${id}-dica` : undefined
  const errorId = error ? `${id}-erro` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {/* O asterisco é decorativo: quem anuncia a obrigatoriedade para o
            leitor de tela é o aria-required no próprio campo. Texto extra
            aqui entraria no nome acessível do rótulo ("Senha (obrigatório)"),
            atrapalhando quem procura o campo pelo nome. */}
        {required && (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="text-xs leading-relaxed text-fg-muted">
          {hint}
        </p>
      )}

      {children({
        id,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(required ? { 'aria-required': true as const } : {}),
      })}

      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-medium text-danger">
          <span aria-hidden="true">▲</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        controlBase,
        'h-11',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        controlBase,
        'min-h-32 resize-y py-2.5 leading-relaxed',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        controlBase,
        'h-11 appearance-none pr-9',
        "bg-[image:var(--seta)] bg-[length:10px] bg-[position:right_0.9rem_center] bg-no-repeat",
        'aria-[invalid=true]:border-danger',
        className,
      )}
      style={{
        // Seta desenhada em SVG inline para acompanhar a cor do texto em
        // qualquer superfície (clara ou escura).
        ['--seta' as string]:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238a8e96' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  )
}

export function Checkbox({
  id,
  label,
  description,
  className,
  ...props
}: { id: string; label: ReactNode; description?: string } & ComponentProps<'input'>) {
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4.5 shrink-0 cursor-pointer rounded-xs border border-line-strong bg-surface-2 accent-[var(--accent-solid)]"
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-fg">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
      </div>
    </div>
  )
}

/** Caixa de erro geral do formulário (erro que não pertence a um campo). */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      {children}
    </div>
  )
}

export function FormSuccess({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="status"
      className="rounded-md border border-success/40 bg-success-soft px-4 py-3 text-sm text-success"
    >
      {children}
    </div>
  )
}

export { controlBase }
