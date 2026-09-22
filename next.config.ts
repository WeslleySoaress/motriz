import type { NextConfig } from 'next'

/**
 * Cabeçalhos de segurança aplicados a toda a aplicação.
 * CSP: em produção usamos uma política restritiva. Em desenvolvimento o Next
 * precisa de 'unsafe-eval' para o fast refresh, por isso a política é relaxada
 * apenas quando NODE_ENV !== 'production'.
 */
const isProd = process.env.NODE_ENV === 'production'

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // O emblema do Next em desenvolvimento fica por cima da interface e aparece
  // nas capturas de tela da documentação. Não existe em produção.
  devIndicators: false,
  /**
   * Em desenvolvimento, o Next recusa servir os recursos internos (`/_next/*`)
   * para origens que ele não reconhece. Como os testes ponta a ponta e o
   * acesso a partir de outro aparelho na rede usam `127.0.0.1` em vez de
   * `localhost`, sem esta lista o bundle do cliente não carrega e a página
   * fica sem JavaScript — renderizada, mas sem interatividade.
   *
   * Vale apenas para `next dev`; não tem efeito em produção.
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  serverExternalPackages: ['sharp', '@prisma/client', 'bcryptjs', 'nodemailer'],
  images: {
    // As imagens são servidas pela nossa própria rota /api/midia/:id, já
    // redimensionadas pelo sharp. Não usamos otimizador remoto.
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          ...(isProd
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ]
  },
}

export default nextConfig
