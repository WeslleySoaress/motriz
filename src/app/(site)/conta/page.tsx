import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  ChangePasswordForm,
  DeleteAccountForm,
  ProfileForm,
  ResendVerification,
} from '@/components/account/account-forms'
import { TickRule } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Minha conta',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const sessionUser = await requireUser('/conta')

  const [profile, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: {
        name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        bio: true,
        showPhone: true,
        showEmail: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    }),
    prisma.session.findMany({
      where: { userId: sessionUser.id },
      orderBy: { lastUsedAt: 'desc' },
      take: 10,
      select: { id: true, createdAt: true, lastUsedAt: true, userAgent: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <p className="rotulo mb-2">Configurações</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Minha conta</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Na plataforma desde {formatDateTime(profile.createdAt)}.
      </p>

      <TickRule className="mt-6" />

      {!profile.emailVerifiedAt && (
        <div className="mt-8">
          <ResendVerification email={profile.email} />
        </div>
      )}

      <section aria-labelledby="perfil" className="mt-10">
        <h2 id="perfil" className="text-lg font-semibold">
          Perfil e privacidade
        </h2>
        <p className="mt-1 mb-6 text-sm text-fg-muted">
          Estes dados aparecem nos seus anúncios. Telefone e e-mail ficam ocultos até você liberar.
        </p>
        <ProfileForm
          profile={{
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            city: profile.city,
            state: profile.state,
            bio: profile.bio,
            showPhone: profile.showPhone,
            showEmail: profile.showEmail,
            emailVerified: Boolean(profile.emailVerifiedAt),
          }}
        />
      </section>

      <section aria-labelledby="senha" className="mt-14">
        <h2 id="senha" className="text-lg font-semibold">
          Senha
        </h2>
        <p className="mt-1 mb-6 text-sm text-fg-muted">
          Troque periodicamente e não reaproveite senhas de outros serviços.
        </p>
        <ChangePasswordForm />
      </section>

      <section aria-labelledby="sessoes" className="mt-14">
        <h2 id="sessoes" className="text-lg font-semibold">
          Sessões abertas
        </h2>
        <p className="mt-1 mb-4 text-sm text-fg-muted">
          Aparelhos com acesso ativo a esta conta. Trocar a senha encerra todos os outros.
        </p>
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-line bg-surface-2 px-4 py-3 text-sm"
            >
              <span className="min-w-0 truncate text-fg" title={session.userAgent ?? undefined}>
                {resumirAgente(session.userAgent)}
              </span>
              <span className="text-xs text-fg-subtle">
                Último uso: {formatDateTime(session.lastUsedAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="excluir" className="mt-14">
        <h2 id="excluir" className="text-lg font-semibold">
          Excluir conta
        </h2>
        <p className="mt-1 mb-6 text-sm text-fg-muted">
          Encerramento definitivo, com remoção dos anúncios e das fotos enviadas.
        </p>
        <DeleteAccountForm />
      </section>

      <p className="mt-12 text-xs leading-relaxed text-fg-subtle">
        Guardamos apenas o necessário para operar a plataforma: dados de conta, anúncios, fotos,
        favoritos e registros de sessão. Este projeto é uma demonstração técnica e não substitui
        uma revisão jurídica de adequação à LGPD — ver docs/PRIVACIDADE.md.
      </p>
    </div>
  )
}

/** Resumo legível do navegador, sem despejar o user-agent inteiro na tela. */
function resumirAgente(userAgent: string | null): string {
  if (!userAgent) return 'Aparelho não identificado'
  const navegador = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Safari\//.test(userAgent) && !/Chrome/.test(userAgent)
        ? 'Safari'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : 'Navegador'
  const sistema = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'sistema desconhecido'
  return `${navegador} · ${sistema}`
}
