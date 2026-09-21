import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { TickRule } from '@/components/ui/misc'

/**
 * Área do anunciante.
 *
 * `requireUser` roda no servidor a cada requisição desta subárvore. É a
 * primeira barreira — mas não a única: cada ação e cada consulta abaixo repete
 * a checagem de propriedade, porque uma server action é um endpoint próprio e
 * não herda a proteção do layout.
 */
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/painel')

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rotulo mb-2">Painel do anunciante</p>
          <h1 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Olá, {user.name.split(' ')[0]}
          </h1>
        </div>
        <nav aria-label="Seções da conta">
          <ul className="flex flex-wrap gap-1">
            <li>
              <Link
                href="/painel"
                className="alvo-toque inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                Meus anúncios
              </Link>
            </li>
            <li>
              <Link
                href="/favoritos"
                className="alvo-toque inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                Favoritos
              </Link>
            </li>
            <li>
              <Link
                href="/conta"
                className="alvo-toque inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                Minha conta
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {!user.emailVerifiedAt && (
        <div
          role="status"
          className="mt-6 rounded-lg border border-accent-line bg-accent-soft p-4 text-sm"
        >
          <p className="font-semibold text-accent">Confirme seu e-mail para publicar anúncios</p>
          <p className="mt-1 text-fg-muted">
            Enviamos um link para <strong>{user.email}</strong>. Você pode montar o anúncio e
            salvar rascunho agora, mas a publicação só é liberada depois da confirmação.
          </p>
          <p className="mt-2">
            <Link href="/conta" className="link-sublinhado font-medium text-accent">
              Reenviar o e-mail de confirmação
            </Link>
          </p>
        </div>
      )}

      <TickRule className="mt-6" />

      <div className="mt-8">{children}</div>
    </div>
  )
}
