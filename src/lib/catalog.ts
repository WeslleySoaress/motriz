import {
  BODY_TYPES,
  FUELS,
  PUBLICLY_VISIBLE_STATUSES,
  SORT_OPTIONS,
  TRANSMISSIONS,
  UFS,
  type BodyType,
  type Fuel,
  type SortOption,
  type Transmission,
  type UF,
} from './enums'

/**
 * Tradução entre a URL do catálogo e a consulta ao banco.
 *
 * Todo filtro vive na URL (em português, para links legíveis e compartilháveis)
 * e é reconstruído no servidor a cada requisição — não há estado de filtro no
 * cliente que o servidor não consiga reproduzir. Valores desconhecidos são
 * descartados em vez de causar erro: um link antigo continua abrindo.
 */

export const PAGE_SIZE = 12
export const MAX_PAGE = 200

export type CatalogFilters = {
  q: string
  brands: string[]
  model: string
  priceMin: number | null // centavos
  priceMax: number | null
  yearMin: number | null
  yearMax: number | null
  kmMax: number | null
  fuels: Fuel[]
  transmissions: Transmission[]
  bodyTypes: BodyType[]
  state: UF | null
  city: string
  sort: SortOption
  page: number
}

export const EMPTY_FILTERS: CatalogFilters = {
  q: '',
  brands: [],
  model: '',
  priceMin: null,
  priceMax: null,
  yearMin: null,
  yearMax: null,
  kmMax: null,
  fuels: [],
  transmissions: [],
  bodyTypes: [],
  state: null,
  city: '',
  sort: 'recentes',
  page: 1,
}

/** Nomes dos parâmetros na URL. Mantidos em português. */
export const PARAM = {
  q: 'q',
  brands: 'marca',
  model: 'modelo',
  priceMin: 'preco_min',
  priceMax: 'preco_max',
  yearMin: 'ano_min',
  yearMax: 'ano_max',
  kmMax: 'km_max',
  fuels: 'combustivel',
  transmissions: 'cambio',
  bodyTypes: 'carroceria',
  state: 'uf',
  city: 'cidade',
  sort: 'ordenar',
  page: 'pagina',
} as const

type RawParams = Record<string, string | string[] | undefined>

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  const list = Array.isArray(value) ? value : value.split(',')
  return list.map((v) => v.trim()).filter(Boolean)
}

function toInt(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  // Número negativo não faz sentido em nenhum filtro (preço, ano, km, página).
  // Sem esta checagem o sinal era removido junto com os outros caracteres não
  // numéricos e "-5" acabava virando 5.
  if (raw.trim().startsWith('-')) return null
  const n = Number.parseInt(raw.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function toStr(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return (raw ?? '').trim().slice(0, 80)
}

function keepKnown<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const set = new Set<string>(allowed)
  return [...new Set(values.map((v) => v.toUpperCase()))].filter((v): v is T => set.has(v))
}

export function parseFilters(params: RawParams): CatalogFilters {
  const priceMinReais = toInt(params[PARAM.priceMin])
  const priceMaxReais = toInt(params[PARAM.priceMax])
  const page = toInt(params[PARAM.page]) ?? 1
  const sortRaw = toStr(params[PARAM.sort]) as SortOption
  const stateRaw = toStr(params[PARAM.state]).toUpperCase() as UF

  const filters: CatalogFilters = {
    q: toStr(params[PARAM.q]),
    brands: [...new Set(toArray(params[PARAM.brands]).map((b) => b.slice(0, 40)))].slice(0, 12),
    model: toStr(params[PARAM.model]),
    // Na URL o preço aparece em reais (mais legível); internamente é centavo.
    priceMin: priceMinReais !== null ? priceMinReais * 100 : null,
    priceMax: priceMaxReais !== null ? priceMaxReais * 100 : null,
    yearMin: toInt(params[PARAM.yearMin]),
    yearMax: toInt(params[PARAM.yearMax]),
    kmMax: toInt(params[PARAM.kmMax]),
    fuels: keepKnown(toArray(params[PARAM.fuels]), FUELS),
    transmissions: keepKnown(toArray(params[PARAM.transmissions]), TRANSMISSIONS),
    bodyTypes: keepKnown(toArray(params[PARAM.bodyTypes]), BODY_TYPES),
    state: (UFS as readonly string[]).includes(stateRaw) ? stateRaw : null,
    city: toStr(params[PARAM.city]),
    sort: (SORT_OPTIONS as readonly string[]).includes(sortRaw) ? sortRaw : 'recentes',
    page: Math.min(Math.max(page, 1), MAX_PAGE),
  }

  // Faixas invertidas são normalizadas em vez de retornarem zero resultados.
  if (filters.priceMin !== null && filters.priceMax !== null && filters.priceMin > filters.priceMax) {
    ;[filters.priceMin, filters.priceMax] = [filters.priceMax, filters.priceMin]
  }
  if (filters.yearMin !== null && filters.yearMax !== null && filters.yearMin > filters.yearMax) {
    ;[filters.yearMin, filters.yearMax] = [filters.yearMax, filters.yearMin]
  }

  return filters
}

/** Reconstrói a query string a partir dos filtros (omite o que está vazio). */
export function toQueryString(filters: Partial<CatalogFilters>): string {
  const sp = new URLSearchParams()
  const f = { ...EMPTY_FILTERS, ...filters }

  if (f.q) sp.set(PARAM.q, f.q)
  for (const b of f.brands) sp.append(PARAM.brands, b)
  if (f.model) sp.set(PARAM.model, f.model)
  if (f.priceMin !== null) sp.set(PARAM.priceMin, String(Math.round(f.priceMin / 100)))
  if (f.priceMax !== null) sp.set(PARAM.priceMax, String(Math.round(f.priceMax / 100)))
  if (f.yearMin !== null) sp.set(PARAM.yearMin, String(f.yearMin))
  if (f.yearMax !== null) sp.set(PARAM.yearMax, String(f.yearMax))
  if (f.kmMax !== null) sp.set(PARAM.kmMax, String(f.kmMax))
  for (const v of f.fuels) sp.append(PARAM.fuels, v)
  for (const v of f.transmissions) sp.append(PARAM.transmissions, v)
  for (const v of f.bodyTypes) sp.append(PARAM.bodyTypes, v)
  if (f.state) sp.set(PARAM.state, f.state)
  if (f.city) sp.set(PARAM.city, f.city)
  if (f.sort !== 'recentes') sp.set(PARAM.sort, f.sort)
  if (f.page > 1) sp.set(PARAM.page, String(f.page))

  return sp.toString()
}

export function catalogHref(filters: Partial<CatalogFilters>): string {
  const qs = toQueryString(filters)
  return qs ? `/catalogo?${qs}` : '/catalogo'
}

export function hasActiveFilters(f: CatalogFilters): boolean {
  return (
    Boolean(f.q) ||
    f.brands.length > 0 ||
    Boolean(f.model) ||
    f.priceMin !== null ||
    f.priceMax !== null ||
    f.yearMin !== null ||
    f.yearMax !== null ||
    f.kmMax !== null ||
    f.fuels.length > 0 ||
    f.transmissions.length > 0 ||
    f.bodyTypes.length > 0 ||
    f.state !== null ||
    Boolean(f.city)
  )
}

/**
 * Monta o `where` do Prisma.
 *
 * O status entra sempre a partir de PUBLICLY_VISIBLE_STATUSES: é o que garante
 * que rascunho, anúncio em análise, pausado ou rejeitado nunca apareça no
 * catálogo, mesmo que alguém monte a URL na mão.
 */
export function buildWhere(f: CatalogFilters) {
  const and: Record<string, unknown>[] = [
    { status: { in: [...PUBLICLY_VISIBLE_STATUSES] } },
  ]

  if (f.q) {
    // Cada termo precisa aparecer em marca, modelo ou versão.
    // O LIKE do SQLite já é insensível a maiúsculas para ASCII.
    for (const term of f.q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      and.push({
        OR: [
          { brand: { contains: term } },
          { model: { contains: term } },
          { trim: { contains: term } },
        ],
      })
    }
  }

  if (f.brands.length) and.push({ brand: { in: f.brands } })
  if (f.model) and.push({ model: { contains: f.model } })
  if (f.priceMin !== null) and.push({ priceCents: { gte: f.priceMin } })
  if (f.priceMax !== null) and.push({ priceCents: { lte: f.priceMax } })
  if (f.yearMin !== null) and.push({ modelYear: { gte: f.yearMin } })
  if (f.yearMax !== null) and.push({ modelYear: { lte: f.yearMax } })
  if (f.kmMax !== null) and.push({ mileageKm: { lte: f.kmMax } })
  if (f.fuels.length) and.push({ fuel: { in: f.fuels } })
  if (f.transmissions.length) and.push({ transmission: { in: f.transmissions } })
  if (f.bodyTypes.length) and.push({ bodyType: { in: f.bodyTypes } })
  if (f.state) and.push({ state: f.state })
  if (f.city) and.push({ city: { contains: f.city } })

  return { AND: and }
}

export function buildOrderBy(sort: SortOption) {
  switch (sort) {
    case 'preco-asc':
      return [{ priceCents: 'asc' as const }, { id: 'asc' as const }]
    case 'preco-desc':
      return [{ priceCents: 'desc' as const }, { id: 'asc' as const }]
    case 'ano-desc':
      return [{ modelYear: 'desc' as const }, { id: 'asc' as const }]
    case 'ano-asc':
      return [{ modelYear: 'asc' as const }, { id: 'asc' as const }]
    case 'km-asc':
      return [{ mileageKm: 'asc' as const }, { id: 'asc' as const }]
    case 'recentes':
    default:
      // `id` como desempate deixa a paginação estável quando várias linhas
      // compartilham a mesma data de publicação (comum no seed).
      return [{ publishedAt: 'desc' as const }, { id: 'asc' as const }]
  }
}

/**
 * Filtros ativos em formato de "chip": rótulo + link que remove só aquele
 * filtro, mantendo os demais.
 */
export type FilterChip = { label: string; removed: Partial<CatalogFilters> }

export function describeActiveFilters(
  f: CatalogFilters,
  labels: {
    fuel: Record<string, string>
    transmission: Record<string, string>
    bodyType: Record<string, string>
    priceShort: (cents: number) => string
    number: (n: number) => string
  },
): FilterChip[] {
  const chips: FilterChip[] = []
  const base = { ...f, page: 1 }

  if (f.q) chips.push({ label: `"${f.q}"`, removed: { ...base, q: '' } })

  for (const brand of f.brands) {
    chips.push({
      label: brand,
      removed: { ...base, brands: f.brands.filter((b) => b !== brand) },
    })
  }

  if (f.model) chips.push({ label: `Modelo: ${f.model}`, removed: { ...base, model: '' } })

  if (f.priceMin !== null || f.priceMax !== null) {
    const min = f.priceMin !== null ? labels.priceShort(f.priceMin) : null
    const max = f.priceMax !== null ? labels.priceShort(f.priceMax) : null
    const label = min && max ? `${min} a ${max}` : min ? `A partir de ${min}` : `Até ${max}`
    chips.push({ label, removed: { ...base, priceMin: null, priceMax: null } })
  }

  if (f.yearMin !== null || f.yearMax !== null) {
    const label =
      f.yearMin !== null && f.yearMax !== null
        ? `${f.yearMin} a ${f.yearMax}`
        : f.yearMin !== null
          ? `A partir de ${f.yearMin}`
          : `Até ${f.yearMax}`
    chips.push({ label, removed: { ...base, yearMin: null, yearMax: null } })
  }

  if (f.kmMax !== null) {
    chips.push({
      label: `Até ${labels.number(f.kmMax)} km`,
      removed: { ...base, kmMax: null },
    })
  }

  for (const v of f.fuels) {
    chips.push({
      label: labels.fuel[v] ?? v,
      removed: { ...base, fuels: f.fuels.filter((x) => x !== v) },
    })
  }
  for (const v of f.transmissions) {
    chips.push({
      label: labels.transmission[v] ?? v,
      removed: { ...base, transmissions: f.transmissions.filter((x) => x !== v) },
    })
  }
  for (const v of f.bodyTypes) {
    chips.push({
      label: labels.bodyType[v] ?? v,
      removed: { ...base, bodyTypes: f.bodyTypes.filter((x) => x !== v) },
    })
  }

  if (f.state) chips.push({ label: f.state, removed: { ...base, state: null } })
  if (f.city) chips.push({ label: f.city, removed: { ...base, city: '' } })

  return chips
}
