'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react'
import { VehicleImage, type VehiclePhoto } from '@/components/vehicle-image'
import { cn } from '@/lib/cn'

export type GalleryPhoto = VehiclePhoto & {
  id: string
  sourceUrl?: string | null
  sourceAuthor?: string | null
  sourceLicense?: string | null
}

/**
 * Galeria do anúncio.
 *
 * Acessibilidade e teclado:
 *  - as miniaturas são uma lista de abas (`role="tablist"`), navegável com as
 *    setas ← →, Home e End;
 *  - a foto grande também aceita setas quando está em foco;
 *  - a ampliação abre um diálogo modal com foco preso, fechando no Esc.
 *
 * Desempenho: só a primeira foto entra com `priority`; as demais carregam sob
 * demanda. As dimensões reais vêm do banco, então trocar de foto não muda a
 * altura do bloco.
 */
export function VehicleGallery({ photos, title }: { photos: GalleryPhoto[]; title: string }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const thumbsRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const total = photos.length
  const current = photos[index]

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return
      setIndex((i) => (i + delta + total) % total)
    },
    [total],
  )

  // Setas navegam enquanto a galeria (ou o diálogo) tem foco.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        go(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(-1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        setIndex(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        setIndex(total - 1)
      }
    },
    [go, total],
  )

  // Mantém a miniatura ativa visível ao navegar pelo teclado.
  useEffect(() => {
    const active = thumbsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [index])

  useEffect(() => {
    if (!zoom) return
    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setZoom(false)
      if (event.key === 'ArrowRight') go(1)
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'Tab') {
        // Foco preso: só há dois controles no diálogo.
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button')
        if (!focusables?.length) return
        const first = focusables[0]!
        const last = focusables[focusables.length - 1]!
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [zoom, go])

  if (total === 0) {
    return (
      <VehicleImage
        photo={null}
        sizes="(min-width: 1024px) 60vw, 100vw"
        ratio="aspect-[4/3]"
        className="rounded-lg border border-line"
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-lg border border-line"
        role="group"
        aria-roledescription="galeria de fotos"
        aria-label={`Fotos do ${title}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <VehicleImage
          photo={current ?? null}
          sizes="(min-width: 1024px) 60vw, 100vw"
          priority
          ratio="aspect-[4/3]"
        />

        {total > 1 && (
          <>
            <GalleryNav side="esquerda" onClick={() => go(-1)} />
            <GalleryNav side="direita" onClick={() => go(1)} />
          </>
        )}

        <button
          type="button"
          onClick={() => setZoom(true)}
          className="absolute right-3 bottom-3 inline-flex h-10 items-center gap-1.5 rounded-md border border-white/20 bg-black/55 px-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:border-white/50"
        >
          <Expand size={15} aria-hidden="true" />
          Ampliar
        </button>

        <p className="absolute bottom-3 left-3 rounded-md border border-white/20 bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm tabular">
          {index + 1} / {total}
        </p>

        {current?.isIllustrative && (
          <p className="absolute top-3 left-3 max-w-[70%] rounded-md border border-white/20 bg-black/65 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
            Foto ilustrativa — não confirmamos que corresponde exatamente a esta versão e ano.
          </p>
        )}
      </div>

      {total > 1 && (
        <div
          ref={thumbsRef}
          role="tablist"
          aria-label="Escolher foto"
          onKeyDown={onKeyDown}
          className="trilha-x -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Foto ${i + 1} de ${total}`}
              tabIndex={i === index ? 0 : -1}
              onClick={() => setIndex(i)}
              className={cn(
                'shrink-0 overflow-hidden rounded-md border transition-colors',
                i === index
                  ? 'border-accent-solid'
                  : 'border-line hover:border-line-strong',
              )}
            >
              <VehicleImage
                photo={{ ...photo, alt: '' }}
                sizes="96px"
                ratio="aspect-[4/3]"
                className="w-24"
              />
            </button>
          ))}
        </div>
      )}

      {/* Crédito da fotografia — obrigatório nas licenças CC BY / CC BY-SA. */}
      {current?.sourceAuthor && (
        <p className="text-xs leading-relaxed text-fg-subtle">
          Foto:{' '}
          {current.sourceUrl ? (
            <a
              href={current.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="link-sublinhado"
            >
              {current.sourceAuthor}
            </a>
          ) : (
            current.sourceAuthor
          )}
          {current.sourceLicense ? ` · ${current.sourceLicense}` : ''} · via Wikimedia Commons
        </p>
      )}

      {zoom && current && (
        <div className="fixed inset-0 z-50 bg-black/92">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Foto ampliada: ${current.alt}`}
            tabIndex={-1}
            className="flex h-full flex-col outline-none"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-white/80 tabular">
                {index + 1} / {total}
              </p>
              <button
                type="button"
                onClick={() => setZoom(false)}
                className="inline-flex size-11 items-center justify-center rounded-md border border-white/25 text-white hover:border-white/60"
              >
                <X size={20} aria-hidden="true" />
                <span className="apenas-leitor">Fechar foto ampliada</span>
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/midia/${current.storageKey}`}
                width={current.width}
                height={current.height}
                alt={current.alt}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {total > 1 && (
              <div className="flex items-center justify-center gap-3 pb-6">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-md border border-white/25 px-4 text-sm text-white hover:border-white/60"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-md border border-white/25 px-4 text-sm text-white hover:border-white/60"
                >
                  Próxima
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GalleryNav({ side, onClick }: { side: 'esquerda' | 'direita'; onClick: () => void }) {
  const isLeft = side === 'esquerda'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'absolute top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/20 bg-black/50 text-white backdrop-blur-sm transition-colors hover:border-white/50',
        isLeft ? 'left-3' : 'right-3',
      )}
    >
      {isLeft ? (
        <ChevronLeft size={20} aria-hidden="true" />
      ) : (
        <ChevronRight size={20} aria-hidden="true" />
      )}
      <span className="apenas-leitor">{isLeft ? 'Foto anterior' : 'Próxima foto'}</span>
    </button>
  )
}
