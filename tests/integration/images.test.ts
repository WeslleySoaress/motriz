import { describe, expect, it, afterAll } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { ImageValidationError, defaultAlt, processAndStoreImage, type ProcessedImage } from '@/lib/images'
import { deleteObjects, getObject } from '@/lib/storage'

/**
 * Processamento e validação de upload.
 *
 * Estes testes exercitam as promessas de segurança do módulo de imagens com
 * arquivos de verdade: formato decidido pelo conteúdo (não pela extensão),
 * limites de tamanho e dimensão, e remoção dos metadados EXIF — inclusive as
 * coordenadas de GPS, que são o dado mais sensível numa foto de veículo
 * tirada na garagem de casa.
 */

const chavesCriadas: string[] = []
const anuncioId = 'testeanuncio1'

afterAll(async () => {
  await deleteObjects(chavesCriadas)
})

function registrar(resultado: ProcessedImage): ProcessedImage {
  chavesCriadas.push(resultado.storageKey, resultado.thumbKey)
  return resultado
}

/** JPEG sintético com dimensões controladas. */
async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 90, g: 90, b: 110 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
}

describe('imagem válida', () => {
  it('converte para WebP e gera miniatura', async () => {
    const resultado = registrar(await processAndStoreImage(anuncioId, { buffer: await jpeg(1200, 900) }))

    expect(resultado.mimeType).toBe('image/webp')
    expect(resultado.width).toBe(1200)
    expect(resultado.height).toBe(900)

    const grande = await getObject(resultado.storageKey)
    const mini = await getObject(resultado.thumbKey)
    expect(grande).not.toBeNull()
    expect(mini).not.toBeNull()

    expect((await sharp(grande!).metadata()).format).toBe('webp')
    const metaMini = await sharp(mini!).metadata()
    expect(metaMini.format).toBe('webp')
    expect(metaMini.width).toBe(480)
  })

  it('reduz imagem acima do limite, mantendo a proporção', async () => {
    const resultado = registrar(await processAndStoreImage(anuncioId, { buffer: await jpeg(4000, 3000) }))
    // Cabe dentro de 1600×1200 sem distorcer.
    expect(resultado.width).toBeLessThanOrEqual(1600)
    expect(resultado.height).toBeLessThanOrEqual(1200)
    expect(resultado.width / resultado.height).toBeCloseTo(4 / 3, 2)
  })

  it('gera nome de arquivo no servidor, ignorando o nome enviado', async () => {
    const resultado = registrar(
      await processAndStoreImage(anuncioId, {
        buffer: await jpeg(1000, 800),
        originalName: '../../../etc/passwd.jpg',
      }),
    )
    expect(resultado.storageKey).toMatch(
      new RegExp(`^${anuncioId}/[0-9a-f-]{36}\\.webp$`),
    )
    expect(resultado.storageKey).not.toContain('passwd')
    expect(resultado.storageKey).not.toContain('..')
  })
})

describe('remoção de metadados', () => {
  it('descarta EXIF, incluindo coordenadas de GPS', async () => {
    // Monta um JPEG carregando EXIF com GPS e uma marca identificável.
    const comExif = await sharp({
      create: { width: 1400, height: 1050, channels: 3, background: { r: 30, g: 40, b: 50 } },
    })
      // O tipo de `withExif` não declara o bloco GPS, mas o sharp o grava —
      // e é exatamente esse bloco que precisamos ver sumir na saída.
      .withExif({
        IFD0: { Copyright: 'Fotografo Exemplo', Make: 'MarcaCamera' },
        GPS: { GPSLatitudeRef: 'S', GPSLongitudeRef: 'W' },
      } as Parameters<ReturnType<typeof sharp>['withExif']>[0])
      .jpeg()
      .toBuffer()

    // Confirma que o arquivo de entrada realmente tinha metadados.
    const metaEntrada = await sharp(comExif).metadata()
    expect(metaEntrada.exif).toBeDefined()

    const resultado = registrar(await processAndStoreImage(anuncioId, { buffer: comExif }))
    const saida = await getObject(resultado.storageKey)
    const metaSaida = await sharp(saida!).metadata()

    expect(metaSaida.exif).toBeUndefined()
    // Nenhum vestígio textual dos metadados sobra nos bytes gravados.
    const texto = saida!.toString('latin1')
    expect(texto).not.toContain('Fotografo Exemplo')
    expect(texto).not.toContain('MarcaCamera')
    expect(texto).not.toContain('GPSLatitude')
  })
})

describe('uploads recusados', () => {
  it('recusa SVG, mesmo com conteúdo bem formado', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">' +
        '<script>alert(1)</script><rect width="1200" height="900" fill="red"/></svg>',
    )
    await expect(processAndStoreImage(anuncioId, { buffer: svg })).rejects.toBeInstanceOf(
      ImageValidationError,
    )
  })

  it('recusa arquivo que não é imagem, mesmo com nome .jpg', async () => {
    const texto = Buffer.from('isto aqui e apenas texto, nao uma fotografia de veiculo')
    await expect(
      processAndStoreImage(anuncioId, { buffer: texto, originalName: 'foto.jpg' }),
    ).rejects.toBeInstanceOf(ImageValidationError)
  })

  it('recusa executável disfarçado de imagem', async () => {
    // Cabeçalho MZ de um executável do Windows.
    const falso = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(60_000, 0x41)])
    await expect(
      processAndStoreImage(anuncioId, { buffer: falso, originalName: 'carro.png' }),
    ).rejects.toBeInstanceOf(ImageValidationError)
  })

  it('recusa imagem pequena demais para um anúncio', async () => {
    await expect(
      processAndStoreImage(anuncioId, { buffer: await jpeg(200, 150) }),
    ).rejects.toThrow(/pelo menos 480/)
  })

  it('recusa arquivo vazio', async () => {
    await expect(
      processAndStoreImage(anuncioId, { buffer: Buffer.alloc(0) }),
    ).rejects.toBeInstanceOf(ImageValidationError)
  })

  it('recusa arquivo acima do limite de tamanho', async () => {
    // 9 MB contra um limite configurado de 8 MB.
    const grande = Buffer.alloc(9 * 1024 * 1024, 0x42)
    await expect(processAndStoreImage(anuncioId, { buffer: grande })).rejects.toThrow(/8 MB/)
  })

  it('não deixa arquivo órfão quando a validação falha', async () => {
    const chave = `${anuncioId}/${randomUUID()}.webp`
    await expect(
      processAndStoreImage(anuncioId, { buffer: Buffer.from('nao e imagem') }),
    ).rejects.toBeInstanceOf(ImageValidationError)
    expect(await getObject(chave)).toBeNull()
  })
})

describe('texto alternativo', () => {
  it('descreve o veículo na primeira foto', () => {
    expect(
      defaultAlt({
        brand: 'Toyota',
        model: 'Corolla',
        trim: 'Altis',
        modelYear: 2023,
        color: 'Preto',
        index: 0,
      }),
    ).toBe('Toyota Corolla Altis 2023 preto')
  })

  it('numera as fotos seguintes', () => {
    const alt = defaultAlt({
      brand: 'Fiat',
      model: 'Toro',
      trim: 'Freedom',
      modelYear: 2022,
      color: 'Branco',
      index: 2,
    })
    expect(alt).toMatch(/^Foto 3 do Fiat Toro/)
  })
})
