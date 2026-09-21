'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Foto de veículo.
 *
 * Decisões:
 *  - `width`/`height` reais vêm do banco e são sempre declarados, então o
 *    navegador reserva a caixa antes do download e o layout não salta.
 *  - `srcSet` oferece a miniatura (480px) e a versão grande (1600px); o
 *    atributo `sizes` diz ao navegador qual baixar. Ambas são WebP geradas no
 *    upload — não há otimizador em tempo de requisição.
 *  - Fora da primeira dobra, `loading="lazy"`.
 *  - Se o arquivo falhar (rede, arquivo removido), mostramos um espaço com
 *    explicação em vez do ícone quebrado do navegador.
 */

export type VehiclePhoto = {
  storageKey: string
  thumbKey: string
  width: number
  height: number
  alt: string
  isIllustrative?: boolean
}

export function VehicleImage({
  photo,
  sizes,
  priority = false,
  className,
  imgClassName,
  ratio = 'aspect-[4/3]',
}: {
  photo: VehiclePhoto | null
  sizes: string
  priority?: boolean
  className?: string
  imgClassName?: string
  ratio?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!photo || failed) {
    return (
      <div
        className={cn(
          ratio,
          'flex w-full flex-col items-center justify-center gap-2 bg-surface-3 text-fg-subtle',
          className,
        )}
        role="img"
        aria-label={photo ? `Não foi possível carregar: ${photo.alt}` : 'Anúncio sem foto'}
      >
        <ImageOff size={22} aria-hidden="true" />
        <span className="px-4 text-center text-xs">
          {photo ? 'Imagem indisponível' : 'Sem foto'}
        </span>
      </div>
    )
  }

  const full = `/api/midia/${photo.storageKey}`
  const thumb = `/api/midia/${photo.thumbKey}`

  return (
    <div className={cn(ratio, 'w-full overflow-hidden bg-surface-3', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={full}
        srcSet={`${thumb} 480w, ${full} 1600w`}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={photo.alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        onError={() => setFailed(true)}
        className={cn('size-full object-cover', imgClassName)}
      />
    </div>
  )
}
