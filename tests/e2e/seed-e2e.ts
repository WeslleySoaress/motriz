import sharp from 'sharp'
import { prisma } from '../../src/lib/db'
import { hashPassword } from '../../src/lib/password'
import { processAndStoreImage } from '../../src/lib/images'
import { buildListingSlug, shortSuffix } from '../../src/lib/slug'
import { CONTAS, type DadosE2E } from './dados-fixos'

export { CONTAS }
export type { DadosE2E }

/**
 * Contas e anúncios de partida dos testes ponta a ponta.
 *
 * Tudo com dados fictícios e endereços @e2e.local. As fotos são geradas na
 * hora pelo sharp — nenhum arquivo externo é necessário para rodar a suíte.
 */


/** Retângulo colorido com dimensão suficiente para passar na validação. */
async function fotoFalsa(cor: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: cor } })
    .jpeg({ quality: 78 })
    .toBuffer()
}

const BASE = {
  year: 2021,
  modelYear: 2022,
  priceCents: 11_990_000,
  mileageKm: 42_000,
  fuel: 'FLEX',
  transmission: 'AUTOMATICO',
  bodyType: 'SUV',
  color: 'Cinza',
  doors: 4,
  city: 'Campinas',
  state: 'SP',
  description:
    'Veículo de teste automatizado, em bom estado de conservação, com revisões registradas e documentação em dia.',
  features: JSON.stringify(['Ar-condicionado', 'Central multimídia']),
}

export async function semearE2E(): Promise<DadosE2E> {
  const [admin, vendedor, outro] = await Promise.all([
    prisma.user.create({
      data: {
        email: CONTAS.admin.email,
        name: CONTAS.admin.nome,
        passwordHash: await hashPassword(CONTAS.admin.senha),
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        email: CONTAS.vendedor.email,
        name: CONTAS.vendedor.nome,
        passwordHash: await hashPassword(CONTAS.vendedor.senha),
        emailVerifiedAt: new Date(),
        city: 'Campinas',
        state: 'SP',
        phone: '19988887777',
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        email: CONTAS.outro.email,
        name: CONTAS.outro.nome,
        passwordHash: await hashPassword(CONTAS.outro.senha),
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    }),
  ])

  void admin

  // Anúncio publicado do vendedor, com foto.
  const publicado = await prisma.listing.create({
    data: {
      ...BASE,
      sellerId: vendedor.id,
      brand: 'Jeep',
      model: 'Compass',
      trim: 'Longitude T270',
      slug: buildListingSlug({
        brand: 'Jeep',
        model: 'Compass',
        trim: 'Longitude T270',
        modelYear: 2022,
        suffix: shortSuffix(),
      }),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { id: true, slug: true },
  })

  const fotoPublicada = await processAndStoreImage(publicado.id, {
    buffer: await fotoFalsa({ r: 70, g: 80, b: 95 }),
  })
  await prisma.listingImage.create({
    data: {
      listingId: publicado.id,
      storageKey: fotoPublicada.storageKey,
      thumbKey: fotoPublicada.thumbKey,
      mimeType: fotoPublicada.mimeType,
      byteSize: fotoPublicada.byteSize,
      width: fotoPublicada.width,
      height: fotoPublicada.height,
      alt: 'Jeep Compass Longitude T270 2022 cinza',
      position: 0,
      isCover: true,
    },
  })

  // Rascunho do vendedor, com foto — usado para provar que não vaza.
  const rascunho = await prisma.listing.create({
    data: {
      ...BASE,
      sellerId: vendedor.id,
      brand: 'Segredo',
      model: 'Rascunho',
      trim: 'Nao Publicado',
      slug: buildListingSlug({
        brand: 'Segredo',
        model: 'Rascunho',
        trim: 'Nao Publicado',
        modelYear: 2022,
        suffix: shortSuffix(),
      }),
      status: 'DRAFT',
    },
    select: { id: true, slug: true },
  })

  const fotoRascunho = await processAndStoreImage(rascunho.id, {
    buffer: await fotoFalsa({ r: 140, g: 60, b: 60 }),
  })
  await prisma.listingImage.create({
    data: {
      listingId: rascunho.id,
      storageKey: fotoRascunho.storageKey,
      thumbKey: fotoRascunho.thumbKey,
      mimeType: fotoRascunho.mimeType,
      byteSize: fotoRascunho.byteSize,
      width: fotoRascunho.width,
      height: fotoRascunho.height,
      alt: 'Foto de rascunho que não deve vazar',
      position: 0,
      isCover: true,
    },
  })

  // Anúncio da outra conta — alvo das tentativas de acesso cruzado.
  const doOutro = await prisma.listing.create({
    data: {
      ...BASE,
      sellerId: outro.id,
      brand: 'Honda',
      model: 'Civic',
      trim: 'EXL',
      priceCents: 12_490_000,
      bodyType: 'SEDA',
      slug: buildListingSlug({
        brand: 'Honda',
        model: 'Civic',
        trim: 'EXL',
        modelYear: 2022,
        suffix: shortSuffix(),
      }),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { id: true },
  })

  // Alguns anúncios extras para exercitar filtros, ordenação e paginação.
  const extras = [
    { brand: 'Fiat', model: 'Argo', trim: 'Drive', bodyType: 'HATCH', priceCents: 7_490_000, mileageKm: 60_000, modelYear: 2020, transmission: 'MANUAL' },
    { brand: 'Toyota', model: 'Hilux', trim: 'SRV 4x4', bodyType: 'PICAPE', priceCents: 27_990_000, mileageKm: 95_000, modelYear: 2021, fuel: 'DIESEL' },
    { brand: 'Toyota', model: 'Corolla', trim: 'Altis', bodyType: 'SEDA', priceCents: 17_990_000, mileageKm: 30_000, modelYear: 2023, transmission: 'CVT' },
    { brand: 'Volkswagen', model: 'T-Cross', trim: 'Highline', bodyType: 'SUV', priceCents: 11_290_000, mileageKm: 63_000, modelYear: 2021 },
  ]

  for (const [i, extra] of extras.entries()) {
    await prisma.listing.create({
      data: {
        ...BASE,
        ...extra,
        sellerId: i % 2 === 0 ? vendedor.id : outro.id,
        slug: buildListingSlug({ ...extra, suffix: shortSuffix() }),
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - (i + 1) * 60_000),
      },
    })
  }

  await prisma.$disconnect()

  return {
    vendedorId: vendedor.id,
    outroId: outro.id,
    anuncioPublicadoId: publicado.id,
    anuncioPublicadoSlug: publicado.slug,
    rascunhoId: rascunho.id,
    rascunhoSlug: rascunho.slug,
    imagemDoRascunhoKey: fotoRascunho.storageKey,
    imagemPublicadaKey: fotoPublicada.storageKey,
    anuncioDoOutroId: doOutro.id,
  }
}
