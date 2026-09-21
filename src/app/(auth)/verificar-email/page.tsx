import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { verifyEmailToken } from '@/server/actions/auth'

export const metadata: Metadata = {
  title: 'Confirmação de e-mail',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Confirmação de e-mail.
 * O token é de uso único e expira em 24 h; a validação acontece no servidor.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''
  const resultado = await verifyEmailToken(token)

  const conteudo = {
    ok: {
      icone: <CircleCheck size={32} className="text-success" aria-hidden="true" />,
      titulo: 'E-mail confirmado',
      texto: 'Sua conta está pronta. Você já pode publicar anúncios.',
      destino: '/painel',
      rotulo: 'Ir para o painel',
    },
    'ja-verificado': {
      icone: <CircleCheck size={32} className="text-success" aria-hidden="true" />,
      titulo: 'Este e-mail já estava confirmado',
      texto: 'Não é preciso fazer nada. Você pode entrar normalmente.',
      destino: '/entrar',
      rotulo: 'Ir para o login',
    },
    invalido: {
      icone: <CircleAlert size={32} className="text-danger" aria-hidden="true" />,
      titulo: 'Link inválido ou expirado',
      texto:
        'Links de confirmação valem por 24 horas e só podem ser usados uma vez. Entre na sua conta e peça um novo envio.',
      destino: '/entrar',
      rotulo: 'Ir para o login',
    },
  }[resultado]

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface-2 p-8 text-center">
      {conteudo.icone}
      <h1 className="text-xl font-semibold">{conteudo.titulo}</h1>
      <p className="text-sm leading-relaxed text-fg-muted">{conteudo.texto}</p>
      <Link
        href={conteudo.destino}
        className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-md bg-accent-solid font-semibold text-accent-solid-fg"
      >
        {conteudo.rotulo}
      </Link>
    </div>
  )
}
