import type { Metadata, Viewport } from 'next'
import { Archivo, Inter } from 'next/font/google'
import './globals.css'

/**
 * Archivo para títulos (grotesca de traço firme, boa em corpo grande) e Inter
 * para leitura. Ambas auto-hospedadas pelo next/font: sem requisição a terceiro
 * em tempo de execução, sem salto de layout no carregamento da fonte.
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--fonte-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--fonte-texto',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Motriz — marketplace de veículos',
    template: '%s · Motriz',
  },
  description:
    'Compre e venda carros com anúncios completos, fotos de verdade e busca que entende o que você procura.',
  applicationName: 'Motriz',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Motriz',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0e0f12',
  width: 'device-width',
  initialScale: 1,
  // Não limitamos o zoom: ampliar a página precisa continuar possível.
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      // O Next precisa saber que a rolagem suave é intencional, senão avisa a
      // cada transição de rota que ela pode atrapalhar a restauração de scroll.
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${inter.variable}`}
    >
      <body className="min-h-dvh bg-surface text-fg antialiased">
        <a href="#conteudo" className="pular-link">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  )
}
