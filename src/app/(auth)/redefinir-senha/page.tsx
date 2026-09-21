import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/forms'

export const metadata: Metadata = {
  title: 'Definir nova senha',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''

  // O token não é validado aqui de propósito: a verificação acontece na server
  // action, no momento do envio. Assim esta página não vira um oráculo para
  // descobrir quais tokens existem.
  if (!token) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold tracking-[-0.03em]">Link inválido</h1>
        <p className="mt-2 mb-8 text-sm text-fg-muted">
          Este endereço não tem um código de redefinição. Peça um novo link para continuar.
        </p>
        <Link
          href="/recuperar-senha"
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-accent-solid font-semibold text-accent-solid-fg"
        >
          Pedir novo link
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-[-0.03em]">Definir nova senha</h1>
      <p className="mt-2 mb-8 text-sm text-fg-muted">
        Escolha uma senha nova. Ao salvar, todas as sessões abertas nesta conta serão encerradas.
      </p>
      <ResetPasswordForm token={token} />
    </div>
  )
}
