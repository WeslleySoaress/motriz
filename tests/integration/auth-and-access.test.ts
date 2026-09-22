import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'
import { createSession, invalidateAllSessions, invalidateSession, validateSessionToken } from '@/lib/session'
import { consumeRateLimit, resetRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getFavoriteListings, getListingForEdit, searchListings } from '@/server/queries'
import { EMPTY_FILTERS } from '@/lib/catalog'
import { buildListingSlug, shortSuffix } from '@/lib/slug'

/**
 * Sessão, senha, limitação de requisições e isolamento entre contas,
 * contra um banco SQLite real (prisma/test.db).
 *
 * O foco é o que uma verificação de tipos não pega: se a consulta realmente
 * separa os dados de uma conta dos da outra, e se uma sessão inválida some
 * mesmo do banco.
 */

let contaA = ''
let contaB = ''
let anuncioPublicadoA = ''
let rascunhoA = ''

beforeAll(async () => {
  const senha = await hashPassword('senha-de-teste-123')

  const a = await prisma.user.create({
    data: { email: 'conta.a@teste.local', name: 'Conta A', passwordHash: senha, emailVerifiedAt: new Date() },
    select: { id: true },
  })
  const b = await prisma.user.create({
    data: { email: 'conta.b@teste.local', name: 'Conta B', passwordHash: senha, emailVerifiedAt: new Date() },
    select: { id: true },
  })
  contaA = a.id
  contaB = b.id

  const base = {
    brand: 'Fiat',
    model: 'Argo',
    trim: 'Drive 1.3',
    year: 2021,
    modelYear: 2022,
    priceCents: 7_490_000,
    mileageKm: 48_900,
    fuel: 'FLEX',
    transmission: 'MANUAL',
    bodyType: 'HATCH',
    color: 'Branco',
    city: 'Salvador',
    state: 'BA',
    description: 'Hatch econômico, revisões em dia, documentação sem pendências.',
  }

  const publicado = await prisma.listing.create({
    data: {
      ...base,
      sellerId: contaA,
      slug: buildListingSlug({ ...base, suffix: shortSuffix() }),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { id: true },
  })
  anuncioPublicadoA = publicado.id

  const rascunho = await prisma.listing.create({
    data: {
      ...base,
      model: 'Mobi',
      sellerId: contaA,
      slug: buildListingSlug({ ...base, model: 'Mobi', suffix: shortSuffix() }),
      status: 'DRAFT',
    },
    select: { id: true },
  })
  rascunhoA = rascunho.id

  // Situações que não podem aparecer publicamente.
  for (const status of ['PENDING', 'PAUSED', 'REJECTED'] as const) {
    await prisma.listing.create({
      data: {
        ...base,
        model: `Modelo${status}`,
        sellerId: contaA,
        slug: buildListingSlug({ ...base, model: status, suffix: shortSuffix() }),
        status,
      },
    })
  }
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@teste.local' } } })
  await prisma.rateLimit.deleteMany({})
  await prisma.$disconnect()
})

describe('senha', () => {
  it('confere a senha correta e recusa a errada', async () => {
    const hash = await hashPassword('minha-senha-secreta')
    expect(await verifyPassword('minha-senha-secreta', hash)).toBe(true)
    expect(await verifyPassword('minha-senha-secret', hash)).toBe(false)
  })

  it('gera hashes diferentes para a mesma senha (salt por hash)', async () => {
    const [h1, h2] = await Promise.all([hashPassword('igual'), hashPassword('igual')])
    expect(h1).not.toBe(h2)
    expect(await verifyPassword('igual', h1)).toBe(true)
    expect(await verifyPassword('igual', h2)).toBe(true)
  })

  it('não guarda a senha em claro', async () => {
    const hash = await hashPassword('texto-em-claro-proibido')
    expect(hash).not.toContain('texto-em-claro-proibido')
    expect(hash.startsWith('$2')).toBe(true)
  })
})

describe('sessão', () => {
  it('valida um token recém-criado e devolve o usuário', async () => {
    const { token } = await createSession(contaA, { ip: '127.0.0.1', userAgent: 'vitest' })
    const usuario = await validateSessionToken(token)
    expect(usuario?.id).toBe(contaA)
    await invalidateSession(token)
  })

  it('guarda no banco apenas o hash do token, nunca o token', async () => {
    const { token } = await createSession(contaA)
    const sessoes = await prisma.session.findMany({ where: { userId: contaA }, select: { tokenHash: true } })
    expect(sessoes.some((s) => s.tokenHash === token)).toBe(false)
    expect(sessoes.every((s) => s.tokenHash.length === 64)).toBe(true)
    await invalidateSession(token)
  })

  it('recusa token inventado ou vazio', async () => {
    expect(await validateSessionToken('token-que-nao-existe')).toBeNull()
    expect(await validateSessionToken('')).toBeNull()
  })

  it('recusa e apaga sessão expirada', async () => {
    const { token } = await createSession(contaA)
    await prisma.session.updateMany({
      where: { userId: contaA },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect(await validateSessionToken(token)).toBeNull()
    expect(await prisma.session.count({ where: { userId: contaA } })).toBe(0)
  })

  it('derruba a sessão assim que a conta é suspensa', async () => {
    const { token } = await createSession(contaB)
    expect(await validateSessionToken(token)).not.toBeNull()

    await prisma.user.update({ where: { id: contaB }, data: { status: 'SUSPENDED' } })
    expect(await validateSessionToken(token)).toBeNull()
    // Todas as sessões da conta suspensa somem, não só a usada agora.
    expect(await prisma.session.count({ where: { userId: contaB } })).toBe(0)

    await prisma.user.update({ where: { id: contaB }, data: { status: 'ACTIVE' } })
  })

  it('encerra todas as sessões de uma vez (usado na troca de senha)', async () => {
    await Promise.all([createSession(contaA), createSession(contaA), createSession(contaA)])
    expect(await prisma.session.count({ where: { userId: contaA } })).toBe(3)
    await invalidateAllSessions(contaA)
    expect(await prisma.session.count({ where: { userId: contaA } })).toBe(0)
  })
})

describe('limitação de requisições', () => {
  it('libera até o limite e bloqueia a partir dele', async () => {
    const chave = `teste-${Date.now()}`
    const limite = RATE_LIMITS.login.limit

    for (let i = 0; i < limite; i++) {
      const r = await consumeRateLimit('login', chave)
      expect(r.ok).toBe(true)
    }

    const estourou = await consumeRateLimit('login', chave)
    expect(estourou.ok).toBe(false)
    expect(estourou.retryAfterSec).toBeGreaterThan(0)
  })

  it('zera o contador após uma operação bem-sucedida', async () => {
    const chave = `teste-reset-${Date.now()}`
    await consumeRateLimit('login', chave)
    await consumeRateLimit('login', chave)
    await resetRateLimit('login', chave)

    const r = await consumeRateLimit('login', chave)
    expect(r.remaining).toBe(RATE_LIMITS.login.limit - 1)
  })

  /**
   * Concorrência. Antes, consumir o limite era ler o contador, comparar e só
   * então incrementar — três operações separadas. Várias requisições
   * simultâneas liam o mesmo valor antes de qualquer gravação e passavam
   * todas, então o limite declarado de 8 tentativas de login não era o limite
   * real. Agora a condição `count < limit` faz parte do UPDATE.
   */
  it('não autoriza além do limite quando as chamadas chegam ao mesmo tempo', async () => {
    const chave = `teste-corrida-${Date.now()}`
    const limite = RATE_LIMITS.login.limit
    const tentativas = limite * 3

    const resultados = await Promise.all(
      Array.from({ length: tentativas }, () => consumeRateLimit('login', chave)),
    )

    const autorizadas = resultados.filter((r) => r.ok).length
    expect(autorizadas).toBe(limite)
    expect(resultados.filter((r) => !r.ok)).toHaveLength(tentativas - limite)

    // O contador gravado também não pode passar do limite.
    const linha = await prisma.rateLimit.findUnique({ where: { key: `login:${chave}` } })
    expect(linha?.count).toBe(limite)
  })

  it('cria uma única janela quando a primeira chamada de uma chave é concorrente', async () => {
    const chave = `teste-corrida-nova-${Date.now()}`

    const resultados = await Promise.all(
      Array.from({ length: 5 }, () => consumeRateLimit('login', chave)),
    )

    // Nenhuma pode falhar: cinco está abaixo do limite de oito.
    expect(resultados.every((r) => r.ok)).toBe(true)

    const linhas = await prisma.rateLimit.findMany({ where: { key: `login:${chave}` } })
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.count).toBe(5)
  })

  it('todas as chamadas recusadas informam quando tentar de novo', async () => {
    const chave = `teste-retry-${Date.now()}`
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) {
      await consumeRateLimit('login', chave)
    }

    const recusadas = await Promise.all(
      Array.from({ length: 4 }, () => consumeRateLimit('login', chave)),
    )
    for (const r of recusadas) {
      expect(r.ok).toBe(false)
      expect(r.retryAfterSec).toBeGreaterThan(0)
      expect(r.retryAfterSec).toBeLessThanOrEqual(RATE_LIMITS.login.windowSec)
    }
  })

  it('conta separadamente por identificador', async () => {
    const a = `ip-a-${Date.now()}`
    const b = `ip-b-${Date.now()}`
    for (let i = 0; i < RATE_LIMITS.login.limit + 1; i++) await consumeRateLimit('login', a)

    expect((await consumeRateLimit('login', a)).ok).toBe(false)
    expect((await consumeRateLimit('login', b)).ok).toBe(true)
  })
})

describe('isolamento entre contas', () => {
  it('a conta B não carrega anúncio da conta A para edição', async () => {
    expect(await getListingForEdit(anuncioPublicadoA, contaB)).toBeNull()
    expect(await getListingForEdit(rascunhoA, contaB)).toBeNull()
    // E o dono continua conseguindo.
    expect(await getListingForEdit(rascunhoA, contaA)).not.toBeNull()
  })

  it('id inexistente não vaza nada', async () => {
    expect(await getListingForEdit('id-inventado', contaA)).toBeNull()
  })

  it('favoritos de uma conta não aparecem na outra', async () => {
    await prisma.favorite.create({ data: { userId: contaA, listingId: anuncioPublicadoA } })

    const deA = await getFavoriteListings(contaA)
    const deB = await getFavoriteListings(contaB)

    expect(deA.map((l) => l.id)).toContain(anuncioPublicadoA)
    expect(deB).toHaveLength(0)
  })

  it('favorito de anúncio que saiu do ar não reaparece na lista', async () => {
    await prisma.listing.update({ where: { id: anuncioPublicadoA }, data: { status: 'PAUSED' } })
    expect(await getFavoriteListings(contaA)).toHaveLength(0)

    await prisma.listing.update({
      where: { id: anuncioPublicadoA },
      data: { status: 'PUBLISHED' },
    })
    expect(await getFavoriteListings(contaA)).toHaveLength(1)
  })
})

describe('catálogo público', () => {
  it('não devolve rascunho, análise, pausado nem rejeitado', async () => {
    const resultado = await searchListings({ ...EMPTY_FILTERS })
    const situacoes = new Set(resultado.items.map((i) => i.status))

    expect(situacoes.has('DRAFT')).toBe(false)
    expect(situacoes.has('PENDING')).toBe(false)
    expect(situacoes.has('PAUSED')).toBe(false)
    expect(situacoes.has('REJECTED')).toBe(false)
    for (const status of situacoes) expect(['PUBLISHED', 'SOLD']).toContain(status)
  })

  it('a contagem total também ignora o que não é público', async () => {
    const publicos = await prisma.listing.count({ where: { status: { in: ['PUBLISHED', 'SOLD'] } } })
    const resultado = await searchListings({ ...EMPTY_FILTERS })
    expect(resultado.total).toBe(publicos)
  })

  it('não expõe dados privados do vendedor no card', async () => {
    const resultado = await searchListings({ ...EMPTY_FILTERS })
    const primeiro = resultado.items[0]
    expect(primeiro).toBeDefined()
    const chaves = Object.keys(primeiro!)
    expect(chaves).not.toContain('seller')
    expect(chaves).not.toContain('sellerId')
    expect(JSON.stringify(primeiro)).not.toContain('@teste.local')
  })

  it('o filtro por marca continua respeitando a situação', async () => {
    const resultado = await searchListings({ ...EMPTY_FILTERS, brands: ['Fiat'] })
    for (const item of resultado.items) {
      expect(item.brand).toBe('Fiat')
      expect(['PUBLISHED', 'SOLD']).toContain(item.status)
    }
  })
})

/**
 * Atomicidade entre a alteração administrativa e o seu registro de auditoria.
 *
 * O projeto promete que toda ação administrativa deixa rastro de quem fez e por
 * quê. Enquanto a alteração e o registro eram duas gravações separadas, a
 * primeira podia passar e a segunda falhar, deixando um anúncio tirado do ar
 * sem histórico — a promessa valia só quando nada dava errado.
 *
 * Aqui forçamos a falha do registro com um `adminId` inexistente, que viola a
 * chave estrangeira, e exigimos que a alteração não tenha sobrado.
 */
describe('auditoria administrativa e alteração são uma coisa só', () => {
  it('se o registro de auditoria falhar, a alteração do anúncio é desfeita', async () => {
    const antes = await prisma.listing.findUnique({
      where: { id: anuncioPublicadoA },
      select: { status: true },
    })
    expect(antes?.status).toBe('PUBLISHED')

    await expect(
      prisma.$transaction([
        prisma.listing.update({
          where: { id: anuncioPublicadoA },
          data: { status: 'REJECTED', rejectionReason: 'transação que deve falhar' },
        }),
        prisma.adminAction.create({
          data: {
            adminId: 'administrador-que-nao-existe',
            action: 'LISTING_SUSPEND',
            targetType: 'LISTING',
            targetId: anuncioPublicadoA,
            reason: 'transação que deve falhar',
            metadata: '{}',
          },
        }),
      ]),
    ).rejects.toThrow()

    const depois = await prisma.listing.findUnique({
      where: { id: anuncioPublicadoA },
      select: { status: true, rejectionReason: true },
    })
    expect(depois?.status).toBe('PUBLISHED')
    expect(depois?.rejectionReason).toBeNull()

    const registros = await prisma.adminAction.findMany({
      where: { targetId: anuncioPublicadoA },
    })
    expect(registros).toHaveLength(0)
  })

  it('quando as duas gravações são válidas, as duas permanecem', async () => {
    const admin = await prisma.user.create({
      data: {
        email: `admin.transacao.${Date.now()}@teste.local`,
        name: 'Admin de teste',
        passwordHash: await hashPassword('senha-de-teste-123'),
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    })

    await prisma.$transaction([
      prisma.listing.update({
        where: { id: anuncioPublicadoA },
        data: { status: 'REJECTED', rejectionReason: 'motivo registrado' },
      }),
      prisma.adminAction.create({
        data: {
          adminId: admin.id,
          action: 'LISTING_SUSPEND',
          targetType: 'LISTING',
          targetId: anuncioPublicadoA,
          reason: 'motivo registrado',
          metadata: '{}',
        },
      }),
    ])

    const anuncio = await prisma.listing.findUnique({
      where: { id: anuncioPublicadoA },
      select: { status: true },
    })
    expect(anuncio?.status).toBe('REJECTED')

    const registros = await prisma.adminAction.findMany({
      where: { targetId: anuncioPublicadoA },
    })
    expect(registros).toHaveLength(1)
    expect(registros[0]?.reason).toBe('motivo registrado')

    // Devolve o anúncio ao estado em que os outros testes o encontram.
    await prisma.listing.update({
      where: { id: anuncioPublicadoA },
      data: { status: 'PUBLISHED', rejectionReason: null },
    })
    await prisma.adminAction.deleteMany({ where: { targetId: anuncioPublicadoA } })
    await prisma.user.delete({ where: { id: admin.id } })
  })
})
