import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { SearchBar } from '@/components/layout/search-bar'
import { TickRule } from '@/components/ui/misc'

export const metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: false },
}

/**
 * 404 da aplicação inteira.
 *
 * Também é o que aparece quando alguém tenta abrir um anúncio que não é
 * público ou que pertence a outra pessoa — por isso o texto não afirma que a
 * página "não existe", apenas que não foi encontrada.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <Link href="/" aria-label="Motriz — página inicial">
            <Logo />
          </Link>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6 sm:py-24">
        <p className="rotulo mb-3">Erro 404</p>
        <h1 className="text-4xl leading-tight font-extrabold tracking-[-0.03em] sm:text-5xl">
          Não encontramos esta página
        </h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-fg-muted">
          O endereço pode ter mudado, o anúncio pode ter saído do ar ou o link pode estar
          incompleto. Tente buscar pelo veículo que você procura.
        </p>

        <TickRule className="mt-8 mb-8" />

        <SearchBar size="lg" id="busca-404" />

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/catalogo"
            className="alvo-toque inline-flex h-12 items-center rounded-md bg-accent-solid px-6 font-semibold text-accent-solid-fg"
          >
            Ver o catálogo
          </Link>
          <Link
            href="/"
            className="alvo-toque inline-flex h-12 items-center rounded-md border border-line-strong px-6 font-semibold text-fg"
          >
            Ir para a página inicial
          </Link>
        </div>
      </main>
    </div>
  )
}
