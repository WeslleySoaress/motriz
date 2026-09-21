import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { TickRule } from '@/components/ui/misc'

/**
 * Telas de conta.
 * Layout próprio, sem o cabeçalho completo: menos distração e menos chance de
 * a pessoa se perder no meio de um cadastro ou de uma recuperação de senha.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Motriz — página inicial">
            <Logo />
          </Link>
          <Link href="/catalogo" className="text-sm text-fg-muted transition-colors hover:text-fg">
            Ver catálogo
          </Link>
        </div>
      </header>

      <main id="conteudo" className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-line">
        <TickRule className="opacity-50" />
        <p className="mx-auto max-w-5xl px-4 py-5 text-xs text-fg-subtle sm:px-6">
          Motriz — projeto de demonstração. Não use uma senha que você já usa em outro serviço.
        </p>
      </footer>
    </div>
  )
}
