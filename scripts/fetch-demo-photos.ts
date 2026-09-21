/**
 * Busca fotografias de veículos no Wikimedia Commons para os anúncios de
 * demonstração e grava um manifesto com a procedência de cada imagem.
 *
 * Por que o Commons: as imagens têm licença explícita e legível por máquina
 * (CC0, CC BY, CC BY-SA ou domínio público), o que permite registrar autor,
 * licença e link de origem — exigência para usar a foto e para creditá-la.
 *
 * O que este script NÃO faz, de propósito:
 *  - não baixa foto de anúncio de terceiros;
 *  - não aceita licença que não esteja na lista de permitidas;
 *  - não afirma que a foto corresponde exatamente à versão/ano do anúncio. A
 *    correspondência só é considerada confirmada quando o título do arquivo
 *    traz marca, modelo E ano. Caso contrário a imagem entra marcada como
 *    ILUSTRATIVA e a interface avisa isso.
 *
 * Uso: npm run photos:fetch
 * Saída: scripts/.cache/fotos/*.jpg + scripts/.cache/fotos/manifesto.json
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { DEMO_VEHICLES } from './demo-vehicles'

const API = 'https://commons.wikimedia.org/w/api.php'
const CACHE_DIR = path.join(process.cwd(), 'scripts', '.cache', 'fotos')
const MANIFEST = path.join(CACHE_DIR, 'manifesto.json')

// Wikimedia exige um User-Agent identificável com forma de contato.
const USER_AGENT =
  'MotrizDemoSeed/0.1 (projeto de demonstração; contato via repositório do projeto)'

/**
 * Licenças aceitas. Tudo que não casar com esta lista é descartado — inclusive
 * "fair use" e licenças não comerciais, que não servem para o uso pretendido.
 */
const ALLOWED_LICENSE = /^(cc0|cc[ -]by([ -]sa)?([ -][\d.]+)?|public domain|pd-)/i

const PHOTOS_PER_VEHICLE = 3
const TARGET_WIDTH = 1600

export type PhotoRecord = {
  arquivo: string
  titulo: string
  paginaUrl: string
  autor: string
  licenca: string
  licencaUrl: string
  /** true quando marca, modelo e ano foram confirmados no título do arquivo. */
  correspondenciaConfirmada: boolean
  largura: number
  altura: number
}

export type Manifest = {
  geradoEm: string
  fonte: string
  observacao: string
  veiculos: Record<string, PhotoRecord[]>
}

type CommonsPage = {
  title: string
  imageinfo?: Array<{
    url: string
    descriptionurl: string
    thumburl?: string
    thumbwidth?: number
    thumbheight?: number
    width: number
    height: number
    mime: string
    extmetadata?: Record<string, { value?: string }>
  }>
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

async function commonsSearch(query: string, limit: number): Promise<CommonsPage[]> {
  const url = new URL(API)
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('formatversion', '2')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrnamespace', '6') // apenas arquivos
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap`)
  url.searchParams.set('gsrlimit', String(limit))
  url.searchParams.set('prop', 'imageinfo')
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata')
  url.searchParams.set('iiurlwidth', String(TARGET_WIDTH))

  // A API pública devolve 429 quando recebe rajadas. Esperamos e tentamos de
  // novo algumas vezes antes de desistir do veículo.
  let response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  for (let tentativa = 1; response.status === 429 && tentativa <= 4; tentativa++) {
    const espera = 2000 * tentativa
    process.stdout.write(`(limite atingido, aguardando ${espera / 1000}s) `)
    await new Promise((resolve) => setTimeout(resolve, espera))
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  }
  if (!response.ok) {
    throw new Error(`Commons respondeu ${response.status} para "${query}"`)
  }
  const json = (await response.json()) as { query?: { pages?: CommonsPage[] } }
  return json.query?.pages ?? []
}

function evaluate(
  page: CommonsPage,
  vehicle: (typeof DEMO_VEHICLES)[number],
): PhotoRecord | null {
  const info = page.imageinfo?.[0]
  if (!info) return null

  // Só JPEG/PNG. SVG e mídia não são fotografia de veículo.
  if (!/^image\/(jpeg|png)$/.test(info.mime)) return null
  if (info.width < 900 || info.height < 600) return null

  const meta = info.extmetadata ?? {}
  const licenseShort = stripHtml(meta.LicenseShortName?.value ?? meta.License?.value ?? '')
  if (!licenseShort || !ALLOWED_LICENSE.test(licenseShort)) return null

  const title = page.title.replace(/^File:/, '')
  const haystack = normalize(title)

  // Todas as palavras exigidas precisam estar no nome do arquivo.
  if (!vehicle.exigeNoTitulo.every((token) => haystack.includes(normalize(token)))) return null

  // Correspondência é "confirmada" só se o ano também aparece no título.
  const yearConfirmed =
    haystack.includes(String(vehicle.year)) || haystack.includes(String(vehicle.modelYear))

  const author = stripHtml(meta.Artist?.value ?? '') || 'Autor não informado no Commons'

  return {
    arquivo: '', // preenchido no download
    titulo: title,
    paginaUrl: info.descriptionurl,
    autor: author.slice(0, 160),
    licenca: licenseShort,
    licencaUrl: stripHtml(meta.LicenseUrl?.value ?? ''),
    correspondenciaConfirmada: yearConfirmed,
    largura: info.thumbwidth ?? info.width,
    altura: info.thumbheight ?? info.height,
  }
}

async function download(url: string, destination: string): Promise<boolean> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) return false
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength < 20_000) return false // arquivo pequeno demais para ser útil
  await writeFile(destination, buffer)
  return true
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })

  // Retomável: veículos que já têm foto no manifesto são preservados, o que
  // permite rodar de novo só para completar os que falharam.
  const anterior = await readManifest()

  const manifest: Manifest = {
    geradoEm: new Date().toISOString(),
    fonte: 'Wikimedia Commons (https://commons.wikimedia.org)',
    observacao:
      'Fotografias de demonstração. Licenças aceitas: CC0, CC BY, CC BY-SA e domínio público. ' +
      'Quando "correspondenciaConfirmada" é false, o título do arquivo não confirma o ano do ' +
      'veículo anunciado e a imagem é exibida como ILUSTRATIVA.',
    veiculos: { ...(anterior?.veiculos ?? {}) },
  }

  let ok = 0
  let semFoto = 0

  for (const vehicle of DEMO_VEHICLES) {
    const key = `${vehicle.brand} ${vehicle.model} ${vehicle.modelYear}`

    if ((manifest.veiculos[key]?.length ?? 0) > 0) {
      ok++
      console.log(`→ ${key} ... já no cache`)
      continue
    }

    process.stdout.write(`→ ${key} ... `)

    try {
      const pages = await commonsSearch(vehicle.busca, 30)
      const candidates: Array<{ record: PhotoRecord; thumbUrl: string }> = []

      for (const page of pages) {
        const record = evaluate(page, vehicle)
        const thumbUrl = page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url
        if (record && thumbUrl) candidates.push({ record, thumbUrl })
      }

      // Fotos com ano confirmado vêm primeiro.
      candidates.sort(
        (a, b) =>
          Number(b.record.correspondenciaConfirmada) - Number(a.record.correspondenciaConfirmada),
      )

      const saved: PhotoRecord[] = []
      const slug = normalize(`${vehicle.brand}-${vehicle.model}-${vehicle.modelYear}`).replace(
        /[^a-z0-9]+/g,
        '-',
      )

      for (const candidate of candidates) {
        if (saved.length >= PHOTOS_PER_VEHICLE) break
        const filename = `${slug}-${saved.length + 1}.jpg`
        const destination = path.join(CACHE_DIR, filename)
        const downloaded = await download(candidate.thumbUrl, destination)
        if (!downloaded) continue
        saved.push({ ...candidate.record, arquivo: filename })
      }

      if (saved.length === 0) {
        semFoto++
        console.log('nenhuma foto com licença compatível')
      } else {
        ok++
        const confirmed = saved.filter((s) => s.correspondenciaConfirmada).length
        console.log(`${saved.length} foto(s), ${confirmed} com ano confirmado`)
      }

      manifest.veiculos[key] = saved
    } catch (error) {
      semFoto++
      console.log(`falhou (${error instanceof Error ? error.message : 'erro'})`)
      manifest.veiculos[key] = []
    }

    // Cortesia com a API pública: uma requisição por vez, com pausa.
    await new Promise((resolve) => setTimeout(resolve, 350))
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8')

  console.log(`\nVeículos com foto: ${ok}   sem foto: ${semFoto}`)
  console.log(`Manifesto: ${path.relative(process.cwd(), MANIFEST)}`)
}

export async function readManifest(): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8')) as Manifest
  } catch {
    return null
  }
}

export { CACHE_DIR }

// Executa só quando chamado diretamente (o seed importa readManifest).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]).includes('fetch-demo-photos')

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
