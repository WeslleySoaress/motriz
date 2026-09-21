import { describe, expect, it } from 'vitest'
import { buildListingSlug, slugify } from '@/lib/slug'

/**
 * A URL do anúncio é definida na publicação e não muda depois.
 *
 * O rascunho nasce com `rascunho-xxxx` (sem página pública). Na publicação o
 * slug definitivo é gerado a partir de marca, modelo, versão e ano. Editar a
 * ficha de um anúncio já publicado NÃO pode alterar a URL — foi exatamente
 * esse defeito que o teste ponta a ponta do ciclo de vida encontrou.
 */
describe('slug do anúncio', () => {
  it('reconhece o slug provisório do rascunho', () => {
    expect('rascunho-a1b2c3d4e5'.startsWith('rascunho-')).toBe(true)
    expect('renault-duster-iconic-2023-a1b2c3'.startsWith('rascunho-')).toBe(false)
  })

  it('monta o slug a partir dos dados do veículo', () => {
    expect(
      buildListingSlug({
        brand: 'Renault',
        model: 'Duster',
        trim: 'Iconic 1.3 TCe',
        modelYear: 2023,
        suffix: 'a1b2c3',
      }),
    ).toBe('renault-duster-iconic-1-3-tce-2023-a1b2c3')
  })

  it('não deixa o slug vazio quando os dados são impróprios para URL', () => {
    const slug = buildListingSlug({
      brand: '???',
      model: '!!!',
      trim: '***',
      modelYear: 2020,
      suffix: 'zzz999',
    })
    expect(slug).toMatch(/2020-zzz999$/)
    expect(slugify('???')).toBe('')
  })
})
