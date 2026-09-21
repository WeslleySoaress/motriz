/**
 * Formatação pt-BR. Puro, sem dependência de servidor — usado nos dois lados.
 * Preços são armazenados em centavos (inteiro) para evitar erro de ponto
 * flutuante; a conversão para reais acontece só na exibição e na entrada.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const BRL_CENTS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const NUM = new Intl.NumberFormat('pt-BR')

/** R$ 239.000 — usado em cards e destaques (centavos zerados são omitidos). */
export function formatPrice(cents: number): string {
  if (!Number.isFinite(cents)) return '—'
  return cents % 100 === 0 ? BRL.format(cents / 100) : BRL_CENTS.format(cents / 100)
}

/** Forma compacta para faixas de filtro: R$ 45 mil / R$ 1,2 mi */
export function formatPriceShort(cents: number): string {
  const reais = cents / 100
  if (reais >= 1_000_000) {
    return `R$ ${(reais / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (reais >= 1000) {
    return `R$ ${Math.round(reais / 1000)} mil`
  }
  return BRL.format(reais)
}

/** 29.999 km */
export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return '—'
  return `${NUM.format(km)} km`
}

export function formatNumber(n: number): string {
  return NUM.format(n)
}

/** 2016/2017 — ano de fabricação / ano do modelo */
export function formatYearPair(year: number, modelYear: number): string {
  return year === modelYear ? String(year) : `${year}/${modelYear}`
}

/** São Paulo · SP */
export function formatLocation(city: string, state: string): string {
  return `${city} · ${state.toUpperCase()}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

/** "há 3 dias", "há 2 meses" — para data de publicação. */
export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const minutes = Math.round(diffMs / 60000)
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(-days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return rtf.format(-months, 'month')
  return rtf.format(-Math.round(months / 12), 'year')
}

/** (11) 98888-7777 — exibição de telefone já validado. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return raw
}

/** Converte "45.000,50" ou "45000.5" em centavos. Retorna null se inválido. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, '').trim()
  if (!cleaned) return null
  // pt-BR: ponto é milhar, vírgula é decimal.
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\.(?=\d{3}(\D|$))/g, '')
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}
