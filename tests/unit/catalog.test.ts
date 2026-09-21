import { describe, expect, it } from 'vitest'
import {
  buildOrderBy,
  buildWhere,
  catalogHref,
  describeActiveFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
  parseFilters,
  toQueryString,
} from '@/lib/catalog'
import { BODY_TYPE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/enums'
import { formatNumber, formatPriceShort } from '@/lib/format'

/**
 * Tradução entre a URL do catálogo e a consulta.
 *
 * Dois pontos críticos cobertos aqui: a URL precisa sobreviver a ida e volta
 * (senão o link compartilhado abre uma busca diferente), e o `where` precisa
 * SEMPRE trazer o filtro de situação — é ele que impede rascunho no catálogo.
 */

describe('leitura dos parâmetros', () => {
  it('lê filtros combinados da URL', () => {
    const f = parseFilters({
      q: 'corolla altis',
      marca: ['Toyota', 'Honda'],
      preco_min: '50000',
      preco_max: '150000',
      ano_min: '2018',
      km_max: '80000',
      combustivel: 'FLEX',
      cambio: ['AUTOMATICO'],
      carroceria: 'SEDA',
      uf: 'sp',
      cidade: 'Campinas',
      ordenar: 'preco-asc',
      pagina: '3',
    })

    expect(f.q).toBe('corolla altis')
    expect(f.brands).toEqual(['Toyota', 'Honda'])
    // O preço vai em reais na URL e vira centavos internamente.
    expect(f.priceMin).toBe(5_000_000)
    expect(f.priceMax).toBe(15_000_000)
    expect(f.yearMin).toBe(2018)
    expect(f.kmMax).toBe(80_000)
    expect(f.fuels).toEqual(['FLEX'])
    expect(f.transmissions).toEqual(['AUTOMATICO'])
    expect(f.bodyTypes).toEqual(['SEDA'])
    expect(f.state).toBe('SP')
    expect(f.sort).toBe('preco-asc')
    expect(f.page).toBe(3)
  })

  it('descarta valor desconhecido em vez de quebrar a página', () => {
    const f = parseFilters({
      combustivel: ['FLEX', 'PLUTONIO'],
      carroceria: 'FOGUETE',
      uf: 'XX',
      ordenar: 'aleatorio',
      pagina: 'abc',
    })
    expect(f.fuels).toEqual(['FLEX'])
    expect(f.bodyTypes).toEqual([])
    expect(f.state).toBeNull()
    expect(f.sort).toBe('recentes')
    expect(f.page).toBe(1)
  })

  it('normaliza faixa invertida em vez de devolver zero resultados', () => {
    const f = parseFilters({ preco_min: '200000', preco_max: '50000', ano_min: '2024', ano_max: '2010' })
    expect(f.priceMin).toBe(5_000_000)
    expect(f.priceMax).toBe(20_000_000)
    expect(f.yearMin).toBe(2010)
    expect(f.yearMax).toBe(2024)
  })

  it('limita a página a um intervalo razoável', () => {
    expect(parseFilters({ pagina: '-5' }).page).toBe(1)
    expect(parseFilters({ pagina: '99999' }).page).toBe(200)
  })
})

describe('ida e volta pela URL', () => {
  it('reconstrói exatamente os mesmos filtros', () => {
    const original = parseFilters({
      q: 'hilux',
      marca: ['Toyota'],
      preco_min: '100000',
      km_max: '120000',
      combustivel: ['DIESEL'],
      carroceria: ['PICAPE'],
      uf: 'MT',
      cidade: 'Cuiabá',
      ordenar: 'km-asc',
      pagina: '2',
    })

    const query = toQueryString(original)
    const devolta = parseFilters(Object.fromEntries(new URLSearchParams(query).entries()))

    // URLSearchParams.entries colapsa repetidos; comparamos campo a campo.
    expect(devolta.q).toBe(original.q)
    expect(devolta.priceMin).toBe(original.priceMin)
    expect(devolta.kmMax).toBe(original.kmMax)
    expect(devolta.state).toBe(original.state)
    expect(devolta.city).toBe(original.city)
    expect(devolta.sort).toBe(original.sort)
    expect(devolta.page).toBe(original.page)
  })

  it('omite da URL o que está no padrão', () => {
    expect(toQueryString(EMPTY_FILTERS)).toBe('')
    expect(catalogHref(EMPTY_FILTERS)).toBe('/catalogo')
    expect(toQueryString({ ...EMPTY_FILTERS, sort: 'recentes', page: 1 })).toBe('')
  })

  it('repete o parâmetro para filtros de múltipla escolha', () => {
    const query = toQueryString({ ...EMPTY_FILTERS, brands: ['Fiat', 'Jeep'] })
    expect(query.match(/marca=/g)).toHaveLength(2)
  })
})

describe('consulta gerada', () => {
  it('sempre restringe às situações públicas', () => {
    const where = buildWhere(EMPTY_FILTERS)
    const statusFiltro = where.AND[0] as { status: { in: string[] } }
    expect(statusFiltro.status.in).toEqual(['PUBLISHED', 'SOLD'])
  })

  it('mantém o filtro de situação mesmo com muitos filtros ativos', () => {
    const where = buildWhere(
      parseFilters({ q: 'a b c', marca: 'Fiat', preco_min: '10000', uf: 'SP' }),
    )
    const statusFiltro = where.AND[0] as { status: { in: string[] } }
    expect(statusFiltro.status.in).toEqual(['PUBLISHED', 'SOLD'])
    expect(where.AND.length).toBeGreaterThan(4)
  })

  it('exige que cada termo da busca apareça em marca, modelo ou versão', () => {
    const where = buildWhere(parseFilters({ q: 'toyota corolla' }))
    const termos = where.AND.filter((c) => 'OR' in c)
    expect(termos).toHaveLength(2)
  })

  it('ordena de forma estável, com desempate por id', () => {
    expect(buildOrderBy('preco-asc')).toEqual([{ priceCents: 'asc' }, { id: 'asc' }])
    expect(buildOrderBy('recentes')).toEqual([{ publishedAt: 'desc' }, { id: 'asc' }])
  })
})

describe('chips de filtro ativo', () => {
  const rotulos = {
    fuel: FUEL_LABELS,
    transmission: TRANSMISSION_LABELS,
    bodyType: BODY_TYPE_LABELS,
    priceShort: formatPriceShort,
    number: formatNumber,
  }

  it('não mostra nada quando não há filtro', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(describeActiveFilters(EMPTY_FILTERS, rotulos)).toEqual([])
  })

  it('remove um filtro por vez, preservando os demais', () => {
    const filtros = parseFilters({ marca: ['Fiat', 'Jeep'], uf: 'SP', combustivel: 'FLEX' })
    const chips = describeActiveFilters(filtros, rotulos)

    const chipFiat = chips.find((c) => c.label === 'Fiat')
    expect(chipFiat).toBeDefined()
    expect(chipFiat!.removed.brands).toEqual(['Jeep'])
    // Os outros filtros continuam no link de remoção.
    expect(chipFiat!.removed.state).toBe('SP')
    expect(chipFiat!.removed.fuels).toEqual(['FLEX'])
  })

  it('volta para a primeira página ao remover um filtro', () => {
    const filtros = parseFilters({ uf: 'SP', pagina: '7' })
    const chip = describeActiveFilters(filtros, rotulos)[0]!
    expect(chip.removed.page).toBe(1)
  })
})
