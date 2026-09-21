import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

/**
 * Áreas privadas e de escrita ficam fora dos buscadores. A visibilidade real
 * é garantida pela autorização no servidor — isto aqui é só higiene de SEO.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/painel', '/conta', '/favoritos', '/api/', '/entrar', '/criar-conta', '/recuperar-senha', '/redefinir-senha', '/verificar-email'],
    },
    sitemap: `${env.APP_URL}/sitemap.xml`,
  }
}
