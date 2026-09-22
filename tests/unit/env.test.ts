import { describe, expect, it } from 'vitest'
import { schema } from '@/lib/env'

/**
 * Validação da configuração de ambiente.
 *
 * O que importa aqui é a checagem cruzada do SMTP: escolher o transporte e
 * esquecer a credencial não pode passar despercebido, porque a falha
 * apareceria só quando alguém pedisse recuperação de senha — exatamente o
 * momento em que a pessoa não tem outro caminho para entrar na conta.
 */

const base = {
  DATABASE_URL: 'file:./prisma/test.db',
  AUTH_SECRET: 'a'.repeat(32),
}

describe('configuração de ambiente', () => {
  it('aceita o mínimo obrigatório e aplica os padrões', () => {
    const r = schema.safeParse(base)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.MAIL_TRANSPORT).toBe('console')
    expect(r.data.MODERATION_ENABLED).toBe(true)
    expect(r.data.UPLOAD_MAX_FILE_MB).toBe(8)
  })

  it('recusa AUTH_SECRET curto demais', () => {
    const r = schema.safeParse({ ...base, AUTH_SECRET: 'curto' })
    expect(r.success).toBe(false)
  })

  it('recusa DATABASE_URL ausente', () => {
    const r = schema.safeParse({ AUTH_SECRET: base.AUTH_SECRET })
    expect(r.success).toBe(false)
  })

  describe('transporte de e-mail', () => {
    it('não exige credencial de SMTP quando o transporte é console', () => {
      const r = schema.safeParse({ ...base, MAIL_TRANSPORT: 'console' })
      expect(r.success).toBe(true)
    })

    it('recusa smtp sem host, usuário e senha, apontando os três campos', () => {
      const r = schema.safeParse({ ...base, MAIL_TRANSPORT: 'smtp' })
      expect(r.success).toBe(false)
      if (r.success) return
      const faltando = r.error.issues.map((i) => i.path.join('.')).sort()
      expect(faltando).toEqual(['MAIL_SMTP_HOST', 'MAIL_SMTP_PASSWORD', 'MAIL_SMTP_USER'])
    })

    it('recusa smtp com credencial pela metade', () => {
      const r = schema.safeParse({
        ...base,
        MAIL_TRANSPORT: 'smtp',
        MAIL_SMTP_HOST: 'smtp.exemplo.com',
        MAIL_SMTP_USER: 'usuario',
      })
      expect(r.success).toBe(false)
      if (r.success) return
      expect(r.error.issues.map((i) => i.path.join('.'))).toEqual(['MAIL_SMTP_PASSWORD'])
    })

    it('aceita smtp completo e converte porta e segurança', () => {
      const r = schema.safeParse({
        ...base,
        MAIL_TRANSPORT: 'smtp',
        MAIL_SMTP_HOST: 'smtp.exemplo.com',
        MAIL_SMTP_PORT: '465',
        MAIL_SMTP_USER: 'usuario',
        MAIL_SMTP_PASSWORD: 'segredo',
        MAIL_SMTP_SECURE: 'true',
      })
      expect(r.success).toBe(true)
      if (!r.success) return
      expect(r.data.MAIL_SMTP_PORT).toBe(465)
      expect(r.data.MAIL_SMTP_SECURE).toBe(true)
    })
  })
})
