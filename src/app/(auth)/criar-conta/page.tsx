import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SignupForm } from '@/components/auth/forms'

export const metadata: Metadata = {
  title: 'Criar conta',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const user = await getCurrentUser()
  if (user) redirect('/painel')

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-[-0.03em]">Criar conta</h1>
      <p className="mt-2 mb-8 text-sm text-fg-muted">
        Leva menos de um minuto. Você precisa confirmar o e-mail antes de publicar um anúncio.
      </p>
      <SignupForm />
    </div>
  )
}
