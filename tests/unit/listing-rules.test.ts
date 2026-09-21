import { describe, expect, it } from 'vitest'
import {
  canDelete,
  canEdit,
  canSellerTransition,
  canView,
  publishBlockers,
  statusOnPublishRequest,
  statusSideEffects,
} from '@/server/listing-rules'

/**
 * Regras de negócio do anúncio.
 *
 * São as decisões que separam "quem pode ver / mexer no quê". Testadas
 * isoladamente porque valem igual em server action, route handler e páginas —
 * um erro aqui é um erro de autorização em todo lugar.
 */

const anuncioDe = (sellerId: string, status: string) => ({ id: 'anuncio-1', sellerId, status })
const dono = { id: 'user-a', role: 'USER' }
const outro = { id: 'user-b', role: 'USER' }
const admin = { id: 'admin-1', role: 'ADMIN' }

describe('visibilidade (canView)', () => {
  it('mostra anúncio publicado para qualquer pessoa, inclusive visitante', () => {
    const anuncio = anuncioDe('user-a', 'PUBLISHED')
    expect(canView(anuncio, null)).toBe(true)
    expect(canView(anuncio, outro)).toBe(true)
  })

  it('mostra anúncio vendido, que permanece como histórico', () => {
    expect(canView(anuncioDe('user-a', 'SOLD'), null)).toBe(true)
  })

  it.each(['DRAFT', 'PENDING', 'PAUSED', 'REJECTED'])(
    'esconde anúncio com situação %s de visitante e de outro usuário',
    (status) => {
      const anuncio = anuncioDe('user-a', status)
      expect(canView(anuncio, null)).toBe(false)
      expect(canView(anuncio, outro)).toBe(false)
    },
  )

  it.each(['DRAFT', 'PENDING', 'PAUSED', 'REJECTED'])(
    'deixa o dono e a administração verem o anúncio %s',
    (status) => {
      const anuncio = anuncioDe('user-a', status)
      expect(canView(anuncio, dono)).toBe(true)
      expect(canView(anuncio, admin)).toBe(true)
    },
  )
})

describe('edição e exclusão', () => {
  it('só o dono edita', () => {
    const anuncio = anuncioDe('user-a', 'PUBLISHED')
    expect(canEdit(anuncio, dono)).toBe(true)
    expect(canEdit(anuncio, outro)).toBe(false)
    expect(canEdit(anuncio, null)).toBe(false)
  })

  it('administração não edita conteúdo alheio, mas pode excluir', () => {
    const anuncio = anuncioDe('user-a', 'PUBLISHED')
    expect(canEdit(anuncio, admin)).toBe(false)
    expect(canDelete(anuncio, admin)).toBe(true)
    expect(canDelete(anuncio, outro)).toBe(false)
  })
})

describe('transições de situação pelo anunciante', () => {
  it('permite pausar e marcar como vendido um anúncio publicado', () => {
    expect(canSellerTransition('PUBLISHED', 'PAUSED')).toBe(true)
    expect(canSellerTransition('PUBLISHED', 'SOLD')).toBe(true)
  })

  it('permite reativar o que está pausado ou vendido', () => {
    expect(canSellerTransition('PAUSED', 'PUBLISHED')).toBe(true)
    expect(canSellerTransition('SOLD', 'PUBLISHED')).toBe(true)
  })

  it('não deixa o anunciante aprovar o próprio anúncio rejeitado', () => {
    expect(canSellerTransition('REJECTED', 'PUBLISHED')).toBe(false)
    // Ele pode reenviar para análise, o que é diferente de publicar.
    expect(canSellerTransition('REJECTED', 'PENDING')).toBe(true)
  })

  it('recusa transição inexistente ou situação desconhecida', () => {
    expect(canSellerTransition('PUBLISHED', 'REJECTED')).toBe(false)
    expect(canSellerTransition('INVENTADO', 'PUBLISHED')).toBe(false)
  })
})

describe('publicação', () => {
  it('manda para análise quando a moderação está ligada', () => {
    expect(statusOnPublishRequest(true)).toBe('PENDING')
    expect(statusOnPublishRequest(false)).toBe('PUBLISHED')
  })

  it('não aponta nenhum impedimento quando está tudo certo', () => {
    expect(
      publishBlockers({ imageCount: 3, emailVerified: true, userStatus: 'ACTIVE', coreValid: true }),
    ).toEqual([])
  })

  it('exige foto, e-mail confirmado, ficha completa e conta ativa', () => {
    const impedimentos = publishBlockers({
      imageCount: 0,
      emailVerified: false,
      userStatus: 'SUSPENDED',
      coreValid: false,
    })
    expect(impedimentos).toContain('SEM_FOTO')
    expect(impedimentos).toContain('EMAIL_NAO_VERIFICADO')
    expect(impedimentos).toContain('CONTA_SUSPENSA')
    expect(impedimentos).toContain('CAMPOS_INCOMPLETOS')
  })
})

describe('efeitos colaterais da mudança de situação', () => {
  it('ao publicar, registra a data e limpa venda e motivo de recusa', () => {
    const efeitos = statusSideEffects('PUBLISHED')
    expect(efeitos.publishedAt).toBeInstanceOf(Date)
    expect(efeitos.soldAt).toBeNull()
    expect(efeitos.rejectionReason).toBeNull()
  })

  it('ao rejeitar, tira a data de publicação — não pode ficar público', () => {
    const efeitos = statusSideEffects('REJECTED')
    expect(efeitos.publishedAt).toBeNull()
    expect(efeitos.moderatedAt).toBeInstanceOf(Date)
  })

  it('ao marcar como vendido, registra a data da venda', () => {
    expect(statusSideEffects('SOLD').soldAt).toBeInstanceOf(Date)
  })
})
