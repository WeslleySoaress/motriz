import type { Metadata } from 'next'
import { RequestResetForm } from '@/components/auth/forms'

export const metadata: Metadata = {
  title: 'Recuperar senha',
  robots: { index: false, follow: false },
}

export default function RecoverPage() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-[-0.03em]">Recuperar senha</h1>
      <p className="mt-2 mb-8 text-sm text-fg-muted">
        Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
      </p>
      <RequestResetForm />
    </div>
  )
}
