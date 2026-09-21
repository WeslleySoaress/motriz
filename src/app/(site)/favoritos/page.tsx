import type { Metadata } from 'next'
import { Heart } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { getFavoriteListings } from '@/server/queries'
import { ListingCard } from '@/components/listing-card'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, TickRule } from '@/components/ui/misc'
import { pluralize } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Favoritos',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Favoritos do usuário.
 *
 * Persistidos no banco (não em armazenamento do navegador): aparecem em
 * qualquer dispositivo em que a pessoa entrar. Anúncios que saíram do ar depois
 * de favoritados não são exibidos aqui — a consulta filtra pela mesma regra de
 * visibilidade pública usada no catálogo.
 */
export default async function FavoritesPage() {
  const user = await requireUser('/favoritos')
  const favorites = await getFavoriteListings(user.id)

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <p className="rotulo mb-2">Sua lista</p>
      <h1 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Favoritos</h1>
      <p className="mt-2 text-sm text-fg-muted">
        {favorites.length > 0 ? (
          <>
            <span className="font-medium text-fg tabular">{favorites.length}</span>{' '}
            {pluralize(favorites.length, 'veículo salvo', 'veículos salvos')}
          </>
        ) : (
          'Salve veículos para comparar com calma depois.'
        )}
      </p>

      <TickRule className="mt-6" />

      <div className="mt-8">
        {favorites.length === 0 ? (
          <EmptyState
            icon={<Heart size={28} aria-hidden="true" />}
            title="Nenhum favorito ainda"
            description="Use o coração no card ou na página do anúncio para salvar um veículo. A lista fica na sua conta e acompanha você em qualquer aparelho."
            action={<ButtonLink href="/catalogo">Explorar o catálogo</ButtonLink>}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard listing={listing} priority={index < 4} className="h-full" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
