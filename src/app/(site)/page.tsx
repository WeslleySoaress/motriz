import Link from 'next/link'
import { ArrowRight, Camera, ListChecks, ShieldCheck } from 'lucide-react'
import { SearchBar } from '@/components/layout/search-bar'
import { ListingCard } from '@/components/listing-card'
import { VehicleImage } from '@/components/vehicle-image'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, SectionTitle, TickRule } from '@/components/ui/misc'
import {
  getBodyTypeCounts,
  getFeaturedListings,
  getPlatformStats,
} from '@/server/queries'
import { BODY_TYPES, BODY_TYPE_LABELS } from '@/lib/enums'
import { formatNumber } from '@/lib/format'

/**
 * Página inicial.
 *
 * A primeira dobra existe para uma coisa: começar a busca. A fotografia grande
 * dá o tom, mas o campo de busca e os atalhos por categoria ficam acima de
 * tudo o mais e funcionam sem esperar JavaScript.
 *
 * Todos os números exibidos vêm de contagem real no banco. Não há métrica
 * decorativa ("+10 mil clientes", "nota 4,9") em lugar nenhum.
 */

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [featured, stats, bodyCounts] = await Promise.all([
    getFeaturedListings(8),
    getPlatformStats(),
    getBodyTypeCounts(),
  ])

  const heroPhoto = featured[0]?.cover ?? null
  const availableBodies = BODY_TYPES.filter((b) => (bodyCounts[b] ?? 0) > 0)

  return (
    <>
      {/* ── Primeira dobra ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0" aria-hidden="true">
          {heroPhoto ? (
            <VehicleImage
              photo={{ ...heroPhoto, alt: '' }}
              sizes="100vw"
              priority
              ratio="h-full"
              className="size-full"
              imgClassName="object-cover"
            />
          ) : (
            <div className="size-full bg-surface-3" />
          )}
          {/* Duas camadas com funções distintas: a horizontal protege o
              contraste do texto à esquerda e deixa a fotografia respirar à
              direita; a vertical costura a foto com o cabeçalho e com a seção
              seguinte, sem achatar a imagem inteira. */}
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/88 to-surface/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/25 to-surface/55" />
        </div>

        <div className="relative mx-auto max-w-[1440px] px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16 lg:px-10 lg:pt-28 lg:pb-20">
          <p className="rotulo mb-4 text-accent">Marketplace de veículos</p>

          <h1 className="max-w-4xl text-[2.5rem] leading-[0.98] font-extrabold tracking-[-0.035em] text-fg sm:text-6xl lg:text-7xl">
            O carro certo começa por uma busca honesta.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
            Ficha técnica completa, fotos grandes e filtros que respondem rápido. Sem selo
            inventado, sem número que não existe.
          </p>

          <div className="mt-8 max-w-2xl">
            <SearchBar size="lg" autoFocus={false} id="busca-inicial" />
          </div>

          {availableBodies.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-subtle">Ir direto para:</span>
              {availableBodies.map((body) => (
                <Link
                  key={body}
                  href={`/catalogo?carroceria=${body}`}
                  className="alvo-toque inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface-2/80 px-3 py-1.5 text-sm font-medium text-fg backdrop-blur-sm transition-colors hover:border-accent-line hover:text-accent"
                >
                  {BODY_TYPE_LABELS[body]}
                  <span className="text-xs text-fg-subtle tabular">{bodyCounts[body]}</span>
                </Link>
              ))}
            </div>
          )}

          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
            <Stat value={formatNumber(stats.publishedCount)} label="anúncios no catálogo" />
            <Stat value={formatNumber(stats.brandCount)} label="marcas disponíveis" />
            {stats.demoCount > 0 && (
              <Stat
                value={formatNumber(stats.demoCount)}
                label="deles são demonstrativos"
                note="Anúncios criados para avaliar a plataforma. Os veículos não estão à venda."
              />
            )}
          </dl>
        </div>
      </section>

      {/* ── Destaques ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <SectionTitle
          kicker="Recém-publicados"
          title="Carros novos e usados"
          description="Os anúncios mais recentes do catálogo, com preço e quilometragem à vista."
          action={
            <ButtonLink href="/catalogo" variant="contorno" size="md">
              Ver catálogo completo
              <ArrowRight size={16} aria-hidden="true" />
            </ButtonLink>
          }
        />

        <TickRule className="mt-6 mb-8" />

        {featured.length === 0 ? (
          <EmptyState
            title="Ainda não há anúncios publicados"
            description="Assim que o primeiro anúncio for publicado, ele aparece aqui. Se você está avaliando o projeto, rode `npm run db:seed` para carregar os anúncios de demonstração."
            action={
              <ButtonLink href="/painel/anuncios/novo" variant="primario">
                Anunciar um veículo
              </ButtonLink>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((listing) => (
              <li key={listing.id}>
                {/* Sem prioridade: a seção de destaques fica abaixo da dobra
                    nas duas larguras, e a foto do herói é o elemento de LCP.
                    Quatro cards em `eager` disputavam banda com ela, e a
                    medição mostrou o LCP indo a 7,8 s. */}
                <ListingCard listing={listing} priority={false} className="h-full" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Faixa clara: anunciar ───────────────────────────────────────── */}
      <section className="superficie-clara bg-surface text-fg">
        <TickRule dense />
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="rotulo mb-3">Para quem vende</p>
              <h2 className="text-3xl leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-4xl lg:text-5xl">
                Publique o seu anúncio em três etapas.
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-fg-muted">
                Você preenche a ficha do veículo, envia as fotos e escolhe como quer ser
                contatado. Dá para salvar rascunho e continuar depois.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/painel/anuncios/novo" size="lg">
                  Anunciar veículo
                </ButtonLink>
                <ButtonLink href="/painel" variant="contorno" size="lg">
                  Meus anúncios
                </ButtonLink>
              </div>
            </div>

            <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-1">
              <Step
                number="01"
                icon={<ListChecks size={18} aria-hidden="true" />}
                title="Descreva o veículo"
                description="Marca, versão, ano, quilometragem, câmbio, combustível e opcionais. Os campos obrigatórios ficam sinalizados."
              />
              <Step
                number="02"
                icon={<Camera size={18} aria-hidden="true" />}
                title="Envie as fotos"
                description="Até 12 imagens por anúncio. Elas são convertidas para WebP, redimensionadas e têm os metadados removidos, inclusive a localização do GPS."
              />
              <Step
                number="03"
                icon={<ShieldCheck size={18} aria-hidden="true" />}
                title="Publique"
                description="O anúncio passa por moderação antes de entrar no catálogo. Você acompanha a situação no painel e pode pausar ou marcar como vendido quando quiser."
              />
            </ol>
          </div>
        </div>
      </section>

      {/* ── Privacidade ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <div className="grid gap-8 rounded-lg border border-line bg-surface-2 p-6 sm:p-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <p className="rotulo mb-3">Seus dados</p>
            <h2 className="text-2xl leading-tight">Contato só aparece se você quiser</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
            <InfoBlock title="Nada de e-mail exposto">
              Telefone e e-mail ficam ocultos por padrão. Cada um decide, no perfil, se quer
              exibi-los na página do anúncio.
            </InfoBlock>
            <InfoBlock title="Fotos sem rastro de GPS">
              Toda imagem enviada é recodificada no servidor, o que descarta os metadados EXIF —
              inclusive as coordenadas de onde a foto foi tirada.
            </InfoBlock>
            <InfoBlock title="Denúncia em qualquer anúncio">
              Encontrou algo errado? A denúncia vai para a fila de moderação, com registro da
              decisão tomada.
            </InfoBlock>
            <InfoBlock title="Conta que você controla">
              Dá para alterar a senha (encerrando as outras sessões) e excluir a conta com os
              anúncios e as fotos.
            </InfoBlock>
          </div>
        </div>
      </section>
    </>
  )
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div>
      <dt className="apenas-leitor">{label}</dt>
      <dd>
        <span className="preco block text-2xl text-fg sm:text-3xl">{value}</span>
        <span className="mt-0.5 block text-xs text-fg-muted">{label}</span>
        {note && <span className="mt-1 block max-w-3xs text-[11px] text-fg-subtle">{note}</span>}
      </dd>
    </div>
  )
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <li className="flex gap-5 bg-surface-2 p-5 sm:p-6">
      <span className="preco shrink-0 text-lg text-accent">{number}</span>
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <span className="text-accent">{icon}</span>
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{description}</p>
      </div>
    </li>
  )
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{children}</p>
    </div>
  )
}
