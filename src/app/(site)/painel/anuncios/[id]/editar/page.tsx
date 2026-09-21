import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { getListingForEdit, getListingViewSeries, parseFeatures } from '@/server/queries'
import { ListingForm } from '@/components/painel/listing-form'
import { PhotoManager } from '@/components/painel/photo-manager'
import { ListingRowActions } from '@/components/painel/listing-actions'
import { StatusBadge, TickRule } from '@/components/ui/misc'
import { formatDate, formatNumber } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Editar anúncio',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Edição do anúncio.
 *
 * `getListingForEdit` filtra por `id` **e** `sellerId` na mesma consulta: um id
 * de anúncio de outra pessoa simplesmente não retorna linha, e a página vira
 * 404. Não existe aqui o padrão "carrega e depois compara", que é onde
 * costumam aparecer falhas de autorização.
 */
export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/painel/anuncios/${id}/editar`)
  const listing = await getListingForEdit(id, user.id)

  if (!listing) notFound()

  // Métrica realmente coletada: uma linha por dia, incrementada quando alguém
  // abre a página do anúncio publicado. Se não houve visita, não há número —
  // e a interface diz isso, em vez de mostrar zero como se fosse resultado.
  const visitas = await getListingViewSeries(listing.id, 30)
  const totalTrintaDias = visitas.reduce((soma, dia) => soma + dia.count, 0)
  const melhorDia = visitas.reduce<(typeof visitas)[number] | null>(
    (melhor, dia) => (melhor === null || dia.count > melhor.count ? dia : melhor),
    null,
  )

  const titulo = `${listing.brand} ${listing.model} ${listing.trim}`.trim()

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/painel"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Voltar para meus anúncios
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em]">
            {titulo || 'Novo anúncio'}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {listing.status === 'DRAFT'
              ? 'Rascunho — visível apenas para você.'
              : 'Alterações entram no ar conforme a situação do anúncio.'}
          </p>
        </div>
        <StatusBadge status={listing.status} />
      </div>

      {listing.status === 'REJECTED' && listing.rejectionReason && (
        <div
          role="status"
          className="mt-5 rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm"
        >
          <p className="font-semibold text-danger">Este anúncio foi recusado pela moderação</p>
          <p className="mt-1 text-fg-muted">{listing.rejectionReason}</p>
          <p className="mt-2 text-xs text-fg-subtle">
            Corrija o que foi apontado e envie novamente para análise pelo botão de publicar.
          </p>
        </div>
      )}

      <TickRule className="mt-6" />

      <div className="mt-8">
        <PhotoManager
          listingId={listing.id}
          initialPhotos={listing.images}
          maxPhotos={env.UPLOAD_MAX_FILES_PER_LISTING}
          maxFileMb={env.UPLOAD_MAX_FILE_MB}
        />
      </div>

      <div className="mt-12">
        <ListingForm
          listing={{
            id: listing.id,
            brand: listing.brand,
            model: listing.model,
            trim: listing.trim,
            year: listing.year,
            modelYear: listing.modelYear,
            priceCents: listing.priceCents,
            mileageKm: listing.mileageKm,
            fuel: listing.fuel,
            transmission: listing.transmission,
            bodyType: listing.bodyType,
            color: listing.color,
            doors: listing.doors,
            city: listing.city,
            state: listing.state,
            description: listing.description,
            features: parseFeatures(listing.features),
            contactChannel: listing.contactChannel,
            contactPhone: listing.contactPhone,
            status: listing.status,
          }}
        />
      </div>

      <section aria-labelledby="desempenho" className="mt-12">
        <h2 id="desempenho" className="rotulo mb-3">
          Desempenho
        </h2>
        <TickRule className="mb-4" />
        <div className="rounded-lg border border-line bg-surface-2 p-5">
          {listing.viewCount === 0 ? (
            <p className="text-sm text-fg-muted">
              Ainda não houve visualizações. A contagem começa quando o anúncio está publicado e
              alguém abre a página dele.
            </p>
          ) : (
            <dl className="flex flex-wrap gap-x-12 gap-y-5">
              <div>
                <dt className="text-xs text-fg-muted">visualizações no total</dt>
                <dd className="preco text-2xl text-fg">{formatNumber(listing.viewCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">nos últimos 30 dias</dt>
                <dd className="preco text-2xl text-fg">{formatNumber(totalTrintaDias)}</dd>
              </div>
              {melhorDia && (
                <div>
                  <dt className="text-xs text-fg-muted">dia de maior procura</dt>
                  <dd className="preco text-2xl text-fg">
                    {formatNumber(melhorDia.count)}
                    <span className="ml-2 text-sm font-normal text-fg-muted">
                      em {formatDate(`${melhorDia.day}T12:00:00`)}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          )}
          <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
            Contamos no máximo uma visualização por dia para o mesmo visitante. É uma medida de
            tendência, não o número de pessoas diferentes que viram o anúncio.
          </p>
        </div>
      </section>

      <section aria-labelledby="situacao" className="mt-12">
        <h2 id="situacao" className="rotulo mb-3">
          Situação do anúncio
        </h2>
        <TickRule className="mb-4" />
        <div className="rounded-lg border border-line bg-surface-2 p-5">
          <p className="mb-4 text-sm text-fg-muted">
            {env.MODERATION_ENABLED
              ? 'Ao publicar, o anúncio vai para análise da moderação antes de aparecer no catálogo.'
              : 'A moderação prévia está desligada nesta instalação: ao publicar, o anúncio entra direto no catálogo.'}
          </p>
          <ListingRowActions
            listingId={listing.id}
            slug={listing.slug}
            status={listing.status}
            title={titulo || 'este rascunho'}
          />
        </div>
      </section>
    </div>
  )
}
