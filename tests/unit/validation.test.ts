import { describe, expect, it } from 'vitest'
import {
  emailSchema,
  listingCoreSchema,
  passwordSchema,
  phoneSchema,
  reportSchema,
} from '@/lib/validation'
import { parsePriceToCents, formatPrice, formatKm, formatYearPair } from '@/lib/format'
import { isValidStorageKey } from '@/lib/storage'
import { buildListingSlug, slugify } from '@/lib/slug'

/** Validação de entrada — a barreira que roda no servidor em toda gravação. */

const anuncioValido = {
  brand: 'Toyota',
  model: 'Corolla',
  trim: 'Altis Premium',
  year: 2022,
  modelYear: 2023,
  priceCents: 17_990_000,
  mileageKm: 34_900,
  fuel: 'HIBRIDO',
  transmission: 'CVT',
  bodyType: 'SEDA',
  color: 'Preto',
  doors: 4,
  city: 'São Paulo',
  state: 'SP',
  description:
    'Sedã híbrido em ótimo estado, revisões feitas na concessionária e documentação em dia.',
  features: ['Bancos de couro'],
  contactChannel: 'PLATFORM',
  contactPhone: '',
}

describe('e-mail', () => {
  it('normaliza espaços e maiúsculas', () => {
    expect(emailSchema.parse('  Maria@Exemplo.COM ')).toBe('maria@exemplo.com')
  })

  it.each(['sem-arroba', 'a@', '@b.com', 'a b@c.com'])('recusa %s', (valor) => {
    expect(emailSchema.safeParse(valor).success).toBe(false)
  })
})

describe('senha', () => {
  it('exige pelo menos 10 caracteres', () => {
    expect(passwordSchema.safeParse('curta123').success).toBe(false)
    expect(passwordSchema.safeParse('senha-longa-o-bastante').success).toBe(true)
  })

  it('recusa senha muito comum', () => {
    expect(passwordSchema.safeParse('senha123456').success).toBe(false)
  })

  it('recusa senha só de espaços', () => {
    expect(passwordSchema.safeParse('              ').success).toBe(false)
  })
})

describe('telefone', () => {
  it('aceita com e sem máscara', () => {
    expect(phoneSchema.parse('(11) 98888-7777')).toBe('11988887777')
    expect(phoneSchema.parse('1133334444')).toBe('1133334444')
  })

  it('recusa quantidade de dígitos inválida', () => {
    expect(phoneSchema.safeParse('999').success).toBe(false)
    expect(phoneSchema.safeParse('119888877771234').success).toBe(false)
  })
})

describe('anúncio', () => {
  it('aceita uma ficha completa', () => {
    expect(listingCoreSchema.safeParse(anuncioValido).success).toBe(true)
  })

  it('recusa ano do modelo anterior ao de fabricação', () => {
    const r = listingCoreSchema.safeParse({ ...anuncioValido, year: 2023, modelYear: 2022 })
    expect(r.success).toBe(false)
  })

  it('recusa ano do modelo distante demais da fabricação', () => {
    const r = listingCoreSchema.safeParse({ ...anuncioValido, year: 2018, modelYear: 2023 })
    expect(r.success).toBe(false)
  })

  it('exige WhatsApp quando esse é o canal escolhido', () => {
    const semTelefone = listingCoreSchema.safeParse({
      ...anuncioValido,
      contactChannel: 'WHATSAPP',
      contactPhone: '',
    })
    expect(semTelefone.success).toBe(false)

    const comTelefone = listingCoreSchema.safeParse({
      ...anuncioValido,
      contactChannel: 'WHATSAPP',
      contactPhone: '(11) 98888-7777',
    })
    expect(comTelefone.success).toBe(true)
  })

  it('recusa descrição curta demais', () => {
    const r = listingCoreSchema.safeParse({ ...anuncioValido, description: 'vendo carro' })
    expect(r.success).toBe(false)
  })

  it('recusa opcional fora da lista fechada', () => {
    const r = listingCoreSchema.safeParse({
      ...anuncioValido,
      features: ['Ar-condicionado', '<script>alert(1)</script>'],
    })
    expect(r.success).toBe(false)
  })

  it('recusa combustível e carroceria inventados', () => {
    expect(listingCoreSchema.safeParse({ ...anuncioValido, fuel: 'PLUTONIO' }).success).toBe(false)
    expect(listingCoreSchema.safeParse({ ...anuncioValido, bodyType: 'NAVE' }).success).toBe(false)
  })

  it('recusa preço abaixo e acima dos limites', () => {
    expect(listingCoreSchema.safeParse({ ...anuncioValido, priceCents: 5000 }).success).toBe(false)
    expect(
      listingCoreSchema.safeParse({ ...anuncioValido, priceCents: 999_999_999_999 }).success,
    ).toBe(false)
  })

  it('recusa quilometragem negativa', () => {
    expect(listingCoreSchema.safeParse({ ...anuncioValido, mileageKm: -1 }).success).toBe(false)
  })
})

describe('denúncia', () => {
  it('exige um motivo da lista', () => {
    expect(
      reportSchema.safeParse({ listingId: 'abc', reason: 'NAO_GOSTEI' }).success,
    ).toBe(false)
    expect(reportSchema.safeParse({ listingId: 'abc', reason: 'FRAUDE' }).success).toBe(true)
  })
})

describe('preço em centavos', () => {
  it('entende os formatos que a pessoa digita', () => {
    expect(parsePriceToCents('89.900')).toBe(8_990_000)
    expect(parsePriceToCents('89900')).toBe(8_990_000)
    expect(parsePriceToCents('89.900,50')).toBe(8_990_050)
    expect(parsePriceToCents('R$ 89.900,00')).toBe(8_990_000)
  })

  it('devolve null para entrada sem sentido', () => {
    expect(parsePriceToCents('')).toBeNull()
    expect(parsePriceToCents('abc')).toBeNull()
  })

  it('formata de volta em reais', () => {
    expect(formatPrice(8_990_000).replace(/ /g, ' ')).toBe('R$ 89.900')
    expect(formatKm(29_999)).toBe('29.999 km')
    expect(formatYearPair(2016, 2017)).toBe('2016/2017')
    expect(formatYearPair(2020, 2020)).toBe('2020')
  })
})

describe('chaves de armazenamento', () => {
  it('aceita apenas o formato gerado pelo servidor', () => {
    expect(isValidStorageKey('abc123/3f2a5c1e-0000-4000-8000-000000000000.webp')).toBe(true)
    expect(isValidStorageKey('abc123/3f2a5c1e-0000-4000-8000-000000000000_t.webp')).toBe(true)
  })

  it.each([
    '../../.env',
    'abc123/../../../etc/passwd',
    'abc123/arquivo.php',
    'abc123/arquivo.webp/../x',
    '/etc/passwd',
    'abc123\\windows\\system32.webp',
    'abc123/arquivo.svg',
  ])('recusa a chave perigosa %s', (chave) => {
    expect(isValidStorageKey(chave)).toBe(false)
  })
})

describe('slug', () => {
  it('remove acentos e caracteres especiais', () => {
    expect(slugify('Citroën C3 Aircross 1.6 Feel!')).toBe('citroen-c3-aircross-1-6-feel')
  })

  it('monta o slug do anúncio com sufixo único', () => {
    const slug = buildListingSlug({
      brand: 'Jaguar',
      model: 'F-Pace',
      trim: 'R-Sport',
      modelYear: 2017,
      suffix: 'a1b2c3',
    })
    expect(slug).toBe('jaguar-f-pace-r-sport-2017-a1b2c3')
  })
})
