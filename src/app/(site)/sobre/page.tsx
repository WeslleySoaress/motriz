import type { Metadata } from 'next'
import { Camera, ListChecks, Search, ShieldCheck } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { SectionTitle, TickRule } from '@/components/ui/misc'
import { getPlatformStats } from '@/server/queries'
import { formatNumber } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Como funciona',
  description:
    'Como comprar e anunciar veículos na Motriz: busca com filtros, anúncio com fotos e moderação antes da publicação.',
}

export const dynamic = 'force-dynamic'

/**
 * Página explicativa.
 *
 * Só afirma o que a plataforma realmente faz. Onde há limitação — não
 * verificamos procedência, não intermediamos pagamento — está escrito.
 */
export default async function SobrePage() {
  const stats = await getPlatformStats()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-16">
      <p className="rotulo mb-3">Como funciona</p>
      <h1 className="text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-5xl">
        Anúncio completo, busca que responde e moderação antes de publicar.
      </h1>
      <p className="mt-5 max-w-prose text-base leading-relaxed text-fg-muted sm:text-lg">
        A Motriz conecta quem vende e quem compra veículo. Não vendemos carros,
        não intermediamos pagamento e não fazemos financiamento.
      </p>

      <TickRule className="mt-8" />

      <section aria-labelledby="comprar" className="mt-12">
        <SectionTitle
          kicker="Para quem compra"
          title="Encontrar o carro certo"
          description="Sem cadastro para buscar. A conta só é necessária para salvar favoritos e falar com o anunciante."
        />
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          <Item
            icone={<Search size={18} aria-hidden="true" />}
            titulo="Busca e filtros"
            texto="Marca, modelo, versão, preço, ano, quilometragem, combustível, câmbio, carroceria e localização. Os filtros ficam na URL, então dá para compartilhar exatamente a busca que você montou."
          />
          <Item
            icone={<ListChecks size={18} aria-hidden="true" />}
            titulo="Ficha técnica completa"
            texto="Ano de fabricação e do modelo, quilometragem, câmbio, combustível, cor, portas, cidade e a lista de opcionais — tudo na mesma tela, sem precisar perguntar."
          />
        </ul>
      </section>

      <section aria-labelledby="anunciar" className="mt-16">
        <SectionTitle
          kicker="Para quem vende"
          title="Publicar um anúncio"
          description="Em três etapas, com rascunho salvo a qualquer momento."
        />
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          <Item
            icone={<Camera size={18} aria-hidden="true" />}
            titulo="Fotos tratadas no servidor"
            texto="Até 12 imagens por anúncio. Elas são convertidas para WebP, redimensionadas e perdem todos os metadados do arquivo original — inclusive a localização por GPS, quando existe."
          />
          <Item
            icone={<ShieldCheck size={18} aria-hidden="true" />}
            titulo="Moderação antes de publicar"
            texto="Anúncios novos passam por análise. Se algo for recusado, você recebe o motivo por escrito e pode corrigir e reenviar pelo painel."
          />
        </ul>
      </section>

      <section aria-labelledby="numeros" className="mt-16">
        <h2 id="numeros" className="rotulo mb-3">
          Números
        </h2>
        <TickRule className="mb-6" />
        <dl className="flex flex-wrap gap-x-12 gap-y-6">
          <div>
            <dt className="text-xs text-fg-muted">anúncios no catálogo</dt>
            <dd className="preco text-3xl text-fg">{formatNumber(stats.publishedCount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">marcas disponíveis</dt>
            <dd className="preco text-3xl text-fg">{formatNumber(stats.brandCount)}</dd>
          </div>
          {stats.demoCount > 0 && (
            <div>
              <dt className="text-xs text-fg-muted">anúncios de demonstração</dt>
              <dd className="preco text-3xl text-accent">{formatNumber(stats.demoCount)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 max-w-prose text-xs leading-relaxed text-fg-subtle">
          Estes números são contagens reais do banco de dados, feitas no momento em que a página
          é carregada. Não há estimativa, projeção nem número ilustrativo em nenhum lugar do site.
        </p>
      </section>

      <section aria-labelledby="limites" className="mt-16">
        <h2 id="limites" className="rotulo mb-3">
          O que a Motriz não faz
        </h2>
        <TickRule className="mb-6" />
        <ul className="flex max-w-prose flex-col gap-3 text-sm leading-relaxed text-fg-muted">
          <li>
            <strong className="text-fg">Não verificamos a procedência do veículo.</strong> Laudo
            cautelar, débitos, histórico de sinistro e autenticidade da documentação são
            responsabilidade de quem compra e de quem vende.
          </li>
          <li>
            <strong className="text-fg">Não verificamos a identidade dos anunciantes.</strong>{' '}
            Combine a visita em local seguro e confira a documentação antes de fechar negócio.
          </li>
          <li>
            <strong className="text-fg">Não intermediamos pagamento nem financiamento.</strong> A
            negociação acontece diretamente entre as partes.
          </li>
          <li>
            <strong className="text-fg">Não exibimos avaliação de vendedor.</strong> Preferimos
            não mostrar nota nenhuma a mostrar uma nota sem lastro.
          </li>
        </ul>
      </section>

      <div className="mt-14 flex flex-wrap gap-3">
        <ButtonLink href="/catalogo" size="lg">
          Ver o catálogo
        </ButtonLink>
        <ButtonLink href="/painel/anuncios/novo" variant="contorno" size="lg">
          Anunciar um veículo
        </ButtonLink>
      </div>
    </div>
  )
}

function Item({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode
  titulo: string
  texto: string
}) {
  return (
    <li className="rounded-lg border border-line bg-surface-2 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span className="text-accent">{icone}</span>
        {titulo}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">{texto}</p>
    </li>
  )
}
