import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { TickRule } from '@/components/ui/misc'
import { BODY_TYPE_LABELS, BODY_TYPES } from '@/lib/enums'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="superficie-escura border-t border-line bg-surface">
      <TickRule className="opacity-60" />

      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo markSize={30} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-muted">
              Marketplace de veículos: anúncios completos, fotos de verdade e busca que entende o
              que você procura.
            </p>
          </div>

          <FooterColumn title="Comprar">
            <FooterLink href="/catalogo">Todos os veículos</FooterLink>
            {BODY_TYPES.slice(0, 5).map((body) => (
              <FooterLink key={body} href={`/catalogo?carroceria=${body}`}>
                {BODY_TYPE_LABELS[body]}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Vender">
            <FooterLink href="/painel/anuncios/novo">Anunciar veículo</FooterLink>
            <FooterLink href="/painel">Painel do anunciante</FooterLink>
            <FooterLink href="/favoritos">Favoritos</FooterLink>
          </FooterColumn>

          <FooterColumn title="Plataforma">
            <FooterLink href="/sobre">Como funciona</FooterLink>
            <FooterLink href="/seguranca">Segurança e privacidade</FooterLink>
            <FooterLink href="/conta">Minha conta</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Motriz. Projeto de demonstração.</p>
          <p className="max-w-xl sm:text-right">
            Os anúncios marcados como{' '}
            <span className="font-semibold text-fg-muted">Demonstração</span> foram criados para
            avaliar a plataforma: os veículos não estão à venda e os anunciantes são fictícios.
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="rotulo mb-4">{title}</h2>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-fg-muted transition-colors hover:text-fg">
        {children}
      </Link>
    </li>
  )
}
