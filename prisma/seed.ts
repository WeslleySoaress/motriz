/**
 * Dados de demonstração.
 *
 * Separação entre demonstração e dado real, exigida pelo projeto:
 *  - todo anúncio criado aqui recebe `isDemo: true` e aparece com o selo
 *    "Demonstração" na interface;
 *  - todo vendedor fictício usa o domínio @demo.motriz.local;
 *  - o seed apaga SOMENTE o que ele mesmo criou (anúncios isDemo e usuários
 *    daquele domínio). Contas e anúncios reais criados na aplicação não são
 *    tocados, mesmo rodando o seed várias vezes.
 *
 * As fotografias vêm do manifesto gerado por `npm run photos:fetch`. Sem o
 * manifesto o seed continua funcionando: cria os anúncios sem foto, deixa-os
 * como rascunho (anúncio sem foto não pode ser publicado) e avisa no final.
 *
 * Uso: npm run db:seed
 */

import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../src/lib/db'
import { hashPassword } from '../src/lib/password'
import { processAndStoreImage } from '../src/lib/images'
import { deleteObjects } from '../src/lib/storage'
import { buildListingSlug, shortSuffix } from '../src/lib/slug'
import { DEMO_VEHICLES } from '../scripts/demo-vehicles'

const DEMO_DOMAIN = '@demo.motriz.local'
const CACHE_DIR = path.join(process.cwd(), 'scripts', '.cache', 'fotos')

type PhotoRecord = {
  arquivo: string
  titulo: string
  paginaUrl: string
  autor: string
  licenca: string
  licencaUrl: string
  correspondenciaConfirmada: boolean
}

type Manifest = { veiculos: Record<string, PhotoRecord[]> }

const DEMO_SELLERS = [
  {
    name: 'Ana Ribeiro',
    email: `ana.ribeiro${DEMO_DOMAIN}`,
    city: 'Campinas',
    state: 'SP',
    phone: '19988887777',
    showPhone: true,
    showEmail: false,
    bio: 'Vendedora particular. Costumo responder no mesmo dia.',
  },
  {
    name: 'Garagem Vertical',
    email: `contato.vertical${DEMO_DOMAIN}`,
    city: 'Curitiba',
    state: 'PR',
    phone: '41977776666',
    showPhone: true,
    showEmail: true,
    bio: 'Loja de seminovos com atendimento por agendamento. Aceitamos avaliação prévia.',
  },
  {
    name: 'Bruno Tavares',
    email: `bruno.tavares${DEMO_DOMAIN}`,
    city: 'Belo Horizonte',
    state: 'MG',
    phone: '31966665555',
    showPhone: false,
    showEmail: false,
    bio: null,
  },
  {
    name: 'Carla Menezes',
    email: `carla.menezes${DEMO_DOMAIN}`,
    city: 'Ribeirão Preto',
    state: 'SP',
    phone: '16955554444',
    showPhone: true,
    showEmail: false,
    bio: 'Vendo carros da família. Documentação sempre em dia.',
  },
  {
    name: 'Motorpoint Seminovos',
    email: `vendas.motorpoint${DEMO_DOMAIN}`,
    city: 'Rio de Janeiro',
    state: 'RJ',
    phone: '21944443333',
    showPhone: true,
    showEmail: true,
    bio: 'Revenda com estoque próprio. Todos os veículos com laudo cautelar disponível.',
  },
]

async function loadManifest(): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, 'manifesto.json'), 'utf8')) as Manifest
  } catch {
    return null
  }
}

/** Remove apenas o que o seed criou antes, incluindo os arquivos no disco. */
async function limparDemonstracao() {
  const imagens = await prisma.listingImage.findMany({
    where: { listing: { isDemo: true } },
    select: { storageKey: true, thumbKey: true },
  })

  await prisma.listing.deleteMany({ where: { isDemo: true } })
  await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_DOMAIN } } })
  await deleteObjects(imagens.flatMap((i) => [i.storageKey, i.thumbKey]))

  return imagens.length
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@motriz.local').toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Motriz!Admin2024'
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Motriz!Demo2024'

  console.log('Limpando dados de demonstração anteriores...')
  const removidas = await limparDemonstracao()
  if (removidas > 0) console.log(`  ${removidas} imagens antigas removidas do disco.`)

  // ── Administrador ────────────────────────────────────────────────────────
  // Usa upsert: se já existe uma conta admin real, ela é preservada.
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      email: adminEmail,
      name: 'Administração Motriz',
      passwordHash: await hashPassword(adminPassword),
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      city: 'São Paulo',
      state: 'SP',
    },
    select: { id: true, email: true },
  })
  console.log(`Administrador: ${admin.email}`)

  // ── Vendedores de demonstração ───────────────────────────────────────────
  const demoHash = await hashPassword(demoPassword)
  const sellers = []
  for (const seller of DEMO_SELLERS) {
    const created = await prisma.user.create({
      data: {
        name: seller.name,
        email: seller.email,
        passwordHash: demoHash,
        city: seller.city,
        state: seller.state,
        phone: seller.phone,
        showPhone: seller.showPhone,
        showEmail: seller.showEmail,
        bio: seller.bio,
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true },
    })
    sellers.push(created)
  }
  console.log(`${sellers.length} vendedores de demonstração criados.`)

  // ── Anúncios ─────────────────────────────────────────────────────────────
  const manifest = await loadManifest()
  if (!manifest) {
    console.log(
      '\nAVISO: manifesto de fotos não encontrado. Rode `npm run photos:fetch` primeiro.\n' +
        'Os anúncios serão criados SEM foto e ficarão como rascunho.\n',
    )
  }

  let publicados = 0
  let semFoto = 0
  let totalFotos = 0
  let ilustrativas = 0

  // Datas de publicação escalonadas para "mais recentes" ter o que ordenar.
  const agora = Date.now()

  for (const [indice, vehicle] of DEMO_VEHICLES.entries()) {
    const seller = sellers[vehicle.seller % sellers.length]!
    const chave = `${vehicle.brand} ${vehicle.model} ${vehicle.modelYear}`
    const fotos = manifest?.veiculos[chave] ?? []

    const statusDesejado = vehicle.status ?? 'PUBLISHED'
    // Regra do domínio: anúncio sem foto não pode estar público.
    const status = fotos.length === 0 ? 'DRAFT' : statusDesejado

    const publishedAt =
      status === 'PUBLISHED' || status === 'SOLD'
        ? new Date(agora - indice * 1000 * 60 * 60 * 9)
        : null

    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        slug: buildListingSlug({
          brand: vehicle.brand,
          model: vehicle.model,
          trim: vehicle.trim,
          modelYear: vehicle.modelYear,
          suffix: shortSuffix(),
        }),
        brand: vehicle.brand,
        model: vehicle.model,
        trim: vehicle.trim,
        year: vehicle.year,
        modelYear: vehicle.modelYear,
        priceCents: vehicle.priceReais * 100,
        mileageKm: vehicle.mileageKm,
        fuel: vehicle.fuel,
        transmission: vehicle.transmission,
        bodyType: vehicle.bodyType,
        color: vehicle.color,
        doors: vehicle.doors,
        city: vehicle.city,
        state: vehicle.state,
        description: vehicle.description,
        features: JSON.stringify(vehicle.features),
        status,
        publishedAt,
        soldAt: status === 'SOLD' ? new Date(agora - 1000 * 60 * 60 * 24 * 3) : null,
        rejectionReason: null,
        contactChannel: seller.email.includes('vertical') ? 'WHATSAPP' : 'PLATFORM',
        contactPhone: seller.email.includes('vertical') ? '41977776666' : null,
        isDemo: true,
      },
      select: { id: true, slug: true },
    })

    if (fotos.length === 0) {
      semFoto++
      console.log(`  ${chave}: sem foto (rascunho)`)
      continue
    }

    for (const [posicao, foto] of fotos.entries()) {
      try {
        const buffer = await readFile(path.join(CACHE_DIR, foto.arquivo))
        const processada = await processAndStoreImage(listing.id, {
          buffer,
          originalName: foto.arquivo,
        })

        const ilustrativa = !foto.correspondenciaConfirmada
        if (ilustrativa) ilustrativas++

        await prisma.listingImage.create({
          data: {
            listingId: listing.id,
            storageKey: processada.storageKey,
            thumbKey: processada.thumbKey,
            mimeType: processada.mimeType,
            byteSize: processada.byteSize,
            width: processada.width,
            height: processada.height,
            alt: ilustrativa
              ? `Foto ilustrativa de um ${vehicle.brand} ${vehicle.model}`
              : `${vehicle.brand} ${vehicle.model} ${vehicle.trim} ${vehicle.modelYear} ${vehicle.color.toLowerCase()}`,
            position: posicao,
            isCover: posicao === 0,
            sourceUrl: foto.paginaUrl,
            sourceAuthor: foto.autor,
            sourceLicense: foto.licenca,
            isIllustrative: ilustrativa,
          },
        })
        totalFotos++
      } catch (error) {
        console.log(
          `  aviso: falha ao processar ${foto.arquivo} (${error instanceof Error ? error.message : 'erro'})`,
        )
      }
    }

    if (status === 'PUBLISHED') publicados++
  }

  // Um anúncio rejeitado, para exercitar a exibição do motivo no painel.
  // Rejeitamos um anúncio específico e deixamos o outro em análise: o painel
  // do anunciante mostra um motivo de recusa real e a fila da administração
  // nasce com trabalho pendente.
  const paraRejeitar = await prisma.listing.findFirst({
    where: { isDemo: true, status: 'PENDING', model: 'Polo' },
    select: { id: true },
  })
  if (paraRejeitar) {
    await prisma.listing.update({
      where: { id: paraRejeitar.id },
      data: {
        status: 'REJECTED',
        rejectionReason:
          'As fotos não mostram a placa coberta e o hodômetro. Reenvie com essas duas imagens.',
        moderatedAt: new Date(),
      },
    })
    await prisma.adminAction.create({
      data: {
        adminId: admin.id,
        action: 'LISTING_REJECT',
        targetType: 'LISTING',
        targetId: paraRejeitar.id,
        reason: 'Fotos incompletas (exemplo de moderação).',
        metadata: JSON.stringify({ origem: 'seed' }),
      },
    })
  }

  // Uma denúncia em aberto, para a fila de moderação não nascer vazia.
  const paraDenunciar = await prisma.listing.findFirst({
    where: { isDemo: true, status: 'PUBLISHED' },
    orderBy: { priceCents: 'desc' },
    select: { id: true },
  })
  if (paraDenunciar && sellers[2]) {
    await prisma.report.create({
      data: {
        listingId: paraDenunciar.id,
        reporterId: sellers[2].id,
        reason: 'PRECO_ENGANOSO',
        details:
          'Denúncia de exemplo criada pelo seed para demonstrar a fila de moderação.',
      },
    })
  }

  // Alguns favoritos, para a página de favoritos ter conteúdo ao entrar com
  // uma conta de demonstração.
  const paraFavoritar = await prisma.listing.findMany({
    where: { isDemo: true, status: 'PUBLISHED' },
    take: 3,
    select: { id: true },
  })
  if (sellers[0]) {
    for (const listing of paraFavoritar) {
      await prisma.favorite.create({
        data: { userId: sellers[0].id, listingId: listing.id },
      })
    }
  }

  // ── Resumo ───────────────────────────────────────────────────────────────
  const total = await prisma.listing.count({ where: { isDemo: true } })
  console.log('\n─────────────────────────────────────────────')
  console.log(`Anúncios de demonstração: ${total}  (publicados: ${publicados})`)
  console.log(`Fotos processadas: ${totalFotos}  (ilustrativas: ${ilustrativas})`)
  if (semFoto > 0) console.log(`Anúncios sem foto, mantidos como rascunho: ${semFoto}`)
  console.log('─────────────────────────────────────────────')
  console.log('Contas para teste (apenas ambiente de desenvolvimento):')
  console.log(`  admin:     ${adminEmail} / ${adminPassword}`)
  console.log(`  vendedor:  ${DEMO_SELLERS[0]!.email} / ${demoPassword}`)
  console.log('─────────────────────────────────────────────\n')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
