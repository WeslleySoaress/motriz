import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import type { Metadata } from 'sharp'
import { UPLOAD_MAX_BYTES, env } from './env'
import { putObject, deleteObjects } from './storage'

/**
 * Processamento de imagens enviadas pelo anunciante.
 *
 * Princípios aplicados:
 *  1. O formato é decidido pelo **conteúdo** (sharp lê o cabeçalho real do
 *     arquivo), nunca pela extensão ou pelo Content-Type do navegador.
 *  2. Só aceitamos JPEG, PNG, WebP e AVIF. SVG é recusado de propósito — pode
 *     conter script e seria servido pelo nosso domínio.
 *  3. A saída é sempre WebP recodificado. Recodificar descarta todo o bloco de
 *     metadados do original, incluindo EXIF com coordenadas de GPS: o sharp só
 *     preserva metadados quando `withMetadata()` é chamado, e não chamamos.
 *  4. Nome de arquivo é gerado no servidor (UUID). O nome enviado pelo cliente
 *     não toca o disco.
 */

/** Tipos que aceitamos na entrada, conforme detectado no conteúdo. */
const ACCEPTED_INPUT_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif'])

/** Limites de sanidade: barra "bomba de descompressão" e imagens minúsculas. */
const MIN_DIMENSION = 480
const MAX_DIMENSION = 12000
const MAX_PIXELS = 50_000_000

/** Saída: largura máxima da foto principal e da miniatura. */
const FULL_MAX_WIDTH = 1600
const FULL_MAX_HEIGHT = 1200
const THUMB_WIDTH = 480

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

export type ProcessedImage = {
  storageKey: string
  thumbKey: string
  mimeType: 'image/webp'
  byteSize: number
  width: number
  height: number
}

export type ImageInput = {
  buffer: Buffer
  /** Apenas para mensagens de erro — nunca usado como nome de arquivo. */
  originalName?: string
}

function assertSize(buffer: Buffer, originalName?: string) {
  if (buffer.byteLength === 0) {
    throw new ImageValidationError(
      `O arquivo ${originalName ?? ''} está vazio.`.trim(),
    )
  }
  if (buffer.byteLength > UPLOAD_MAX_BYTES) {
    throw new ImageValidationError(
      `Cada foto pode ter no máximo ${env.UPLOAD_MAX_FILE_MB} MB. ${
        originalName ? `"${originalName}" ` : ''
      }tem ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB.`,
    )
  }
}

/**
 * Valida e converte uma imagem, gravando a versão grande e a miniatura.
 * Em caso de falha no meio do caminho, remove o que já tinha sido gravado —
 * não deixamos arquivo órfão no disco.
 */
export async function processAndStoreImage(
  listingId: string,
  input: ImageInput,
): Promise<ProcessedImage> {
  assertSize(input.buffer, input.originalName)

  let metadata: Metadata
  try {
    metadata = await sharp(input.buffer, { limitInputPixels: MAX_PIXELS }).metadata()
  } catch {
    throw new ImageValidationError(
      `Não foi possível ler ${input.originalName ? `"${input.originalName}"` : 'o arquivo'}. Envie uma imagem JPEG, PNG, WebP ou AVIF.`,
    )
  }

  const format = metadata.format?.toLowerCase()
  if (!format || !ACCEPTED_INPUT_FORMATS.has(format)) {
    throw new ImageValidationError(
      `Formato não suportado${format ? ` (${format})` : ''}. Aceitamos JPEG, PNG, WebP e AVIF.`,
    )
  }

  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new ImageValidationError(
      `A imagem precisa ter pelo menos ${MIN_DIMENSION}px de largura e de altura (recebemos ${width}×${height}).`,
    )
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ImageValidationError(
      `A imagem excede o limite de ${MAX_DIMENSION}px por lado.`,
    )
  }
  if (width * height > MAX_PIXELS) {
    throw new ImageValidationError('A imagem tem resolução alta demais para ser processada.')
  }

  const id = randomUUID()
  const storageKey = `${listingId}/${id}.webp`
  const thumbKey = `${listingId}/${id}_t.webp`
  const written: string[] = []

  try {
    // `rotate()` sem argumento aplica a orientação EXIF antes de descartá-la,
    // então a foto não sai deitada mesmo perdendo o metadado.
    const base = sharp(input.buffer, { limitInputPixels: MAX_PIXELS }).rotate()

    const fullBuffer = await base
      .clone()
      .resize({
        width: FULL_MAX_WIDTH,
        height: FULL_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true })

    await putObject(storageKey, fullBuffer.data)
    written.push(storageKey)

    const thumbBuffer = await base
      .clone()
      .resize({ width: THUMB_WIDTH, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72, effort: 4 })
      .toBuffer()

    await putObject(thumbKey, thumbBuffer)
    written.push(thumbKey)

    return {
      storageKey,
      thumbKey,
      mimeType: 'image/webp',
      byteSize: fullBuffer.data.byteLength,
      width: fullBuffer.info.width,
      height: fullBuffer.info.height,
    }
  } catch (error) {
    await deleteObjects(written)
    if (error instanceof ImageValidationError) throw error
    throw new ImageValidationError('Não foi possível processar a imagem enviada.')
  }
}

/** Texto alternativo padrão quando o anunciante não informa um. */
export function defaultAlt(params: {
  brand: string
  model: string
  trim: string
  modelYear: number
  color: string
  index: number
}): string {
  const prefix = params.index === 0 ? '' : `Foto ${params.index + 1} do `
  const base = `${params.brand} ${params.model} ${params.trim} ${params.modelYear} ${params.color.toLowerCase()}`
  return (prefix ? `${prefix}${base}` : base).trim().slice(0, 180)
}
