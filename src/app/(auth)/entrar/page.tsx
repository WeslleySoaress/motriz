import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { LoginForm } from '@/components/auth/forms'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/** Só aceitamos destino interno, para não virar ponte de redirecionamento. */
function safeNext(value: unknown): string | undefined {
  const raw = typeof value === 'string' ? value : undefined
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return undefined
  return raw
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = safeNext(params.proximo)

  // Quem já está autenticado não precisa ver esta tela.
  const user = await getCurrentUser()
  if (user) redirect(next ?? '/painel')

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-[-0.03em]">Entrar</h1>
      <p className="mt-2 mb-8 text-sm text-fg-muted">
        Acesse sua conta para anunciar, salvar favoritos e falar com anunciantes.
      </p>
      <LoginForm next={next} />
    </div>
  )
}
