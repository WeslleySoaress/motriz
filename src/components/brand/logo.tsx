import { cn } from '@/lib/cn'

/**
 * Marca Motriz.
 *
 * O símbolo é um conta-giros reduzido ao essencial: o arco é a escala, o traço
 * âmbar é o ponteiro na faixa de potência. É o mesmo gesto da "régua de tick"
 * que separa as seções do site — símbolo e layout falam a mesma língua.
 */

export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25" className="stroke-line-strong" strokeWidth="1.5" />
      {/* escala do conta-giros */}
      <path
        d="M8 21.5a9 9 0 1 1 16 0"
        className="stroke-fg-subtle"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* marcas da escala */}
      <path d="M9.6 14.2 7.8 13.4M12.6 10.6l-1-1.8M16 9.3V7.3M19.4 10.6l1-1.8M22.4 14.2l1.8-.8"
        className="stroke-line-strong" strokeWidth="1.4" strokeLinecap="round" />
      {/* ponteiro na faixa de potência */}
      <path
        d="M16 21 21.2 12.4"
        stroke="var(--accent-solid)"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <circle cx="16" cy="21.4" r="2" fill="var(--accent-solid)" />
    </svg>
  )
}

export function Logo({
  className,
  markSize = 28,
  showWord = true,
}: {
  className?: string
  markSize?: number
  showWord?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={markSize} />
      {showWord && (
        <span className="font-[family-name:var(--font-display)] text-[1.0625rem] font-extrabold tracking-[-0.03em] text-fg">
          Motriz
        </span>
      )}
      <span className="apenas-leitor">Motriz — marketplace de veículos</span>
    </span>
  )
}
