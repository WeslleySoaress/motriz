/**
 * Slugs legíveis para a URL do anúncio: /veiculo/jaguar-f-pace-r-sport-2017-a1b2c3
 * O sufixo curto garante unicidade sem expor contagem nem id sequencial.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function buildListingSlug(parts: {
  brand: string
  model: string
  trim: string
  modelYear: number
  suffix: string
}): string {
  const base = slugify(`${parts.brand} ${parts.model} ${parts.trim} ${parts.modelYear}`)
  return `${base || 'veiculo'}-${parts.suffix}`
}

/** Sufixo aleatório curto, alfabeto sem caracteres ambíguos (0/O, 1/l). */
export function shortSuffix(length = 6): string {
  const alphabet = '23456789abcdefghijkmnpqrstuvwxyz'
  let out = ''
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length]
  }
  return out
}
