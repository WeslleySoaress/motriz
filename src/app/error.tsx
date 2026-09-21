'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Erro não tratado em qualquer rota.
 *
 * Mostra apenas uma mensagem em português e o identificador de correlação — o
 * detalhe técnico fica no log do servidor, nunca na tela de quem usa.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('erro não tratado', error.digest)
  }, [error])

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-surface-2 p-8 text-center">
        <p className="rotulo mb-3">Algo deu errado</p>
        <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
          Não conseguimos carregar esta página
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          Pode ter sido uma instabilidade momentânea. Tente novamente; se continuar acontecendo,
          volte daqui a alguns minutos.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-fg-subtle">
            Código para suporte: <span className="text-fg-muted">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="alvo-toque inline-flex h-11 items-center rounded-md bg-accent-solid px-5 text-sm font-semibold text-accent-solid-fg"
          >
            Tentar novamente
          </button>
          <Link
            href="/"
            className="alvo-toque inline-flex h-11 items-center rounded-md border border-line-strong px-5 text-sm font-semibold text-fg"
          >
            Ir para a página inicial
          </Link>
        </div>
      </div>
    </div>
  )
}
