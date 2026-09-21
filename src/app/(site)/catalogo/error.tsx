'use client'

import { useEffect } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/misc'

/**
 * Falha ao carregar o catálogo (banco fora do ar, consulta inválida...).
 * O usuário vê uma mensagem em português e um botão para tentar de novo; o
 * detalhe técnico fica no log do servidor, nunca na tela.
 */
export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('falha ao carregar o catálogo', error.digest)
  }, [error])

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <ErrorState
        title="Não conseguimos carregar o catálogo"
        description="Pode ter sido uma instabilidade momentânea. Tente novamente; se continuar, volte daqui a alguns minutos."
        errorId={error.digest}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Tentar novamente</Button>
            <ButtonLink href="/" variant="contorno">
              Ir para a página inicial
            </ButtonLink>
          </div>
        }
      />
    </div>
  )
}
