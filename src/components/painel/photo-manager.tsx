'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react'
import { VehicleImage } from '@/components/vehicle-image'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { cn } from '@/lib/cn'

export type ManagedPhoto = {
  id: string
  storageKey: string
  thumbKey: string
  width: number
  height: number
  alt: string
  isCover: boolean
  position: number
}

/**
 * Gerenciador de fotos do anúncio.
 *
 * Reordenação por botões "mover para a esquerda / direita" em vez de arrastar:
 * funciona com teclado, com leitor de tela e no toque, sem depender de gesto
 * preciso. A primeira foto é sempre a capa — a regra é a mesma no servidor.
 *
 * O envio vai para /api/anuncios/[id]/imagens, que é quem valida de verdade
 * (tipo real do arquivo, tamanho, dimensão, quantidade) e remove os metadados.
 */
export function PhotoManager({
  listingId,
  initialPhotos,
  maxPhotos,
  maxFileMb,
}: {
  listingId: string
  initialPhotos: ManagedPhoto[]
  maxPhotos: number
  maxFileMb: number
}) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const restantes = maxPhotos - photos.length

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)

    if (files.length > restantes) {
      setError(
        `Você pode adicionar mais ${restantes} ${restantes === 1 ? 'foto' : 'fotos'} neste anúncio.`,
      )
      return
    }

    const formData = new FormData()
    for (const file of Array.from(files)) formData.append('fotos', file)

    setUploading(true)
    try {
      const response = await fetch(`/api/anuncios/${listingId}/imagens`, {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json()) as { images?: ManagedPhoto[]; error?: string }

      if (!response.ok) {
        setError(payload.error ?? 'Não foi possível enviar as fotos.')
        return
      }

      setPhotos(payload.images ?? [])
      router.refresh()
    } catch {
      setError('Falha de conexão ao enviar as fotos. Verifique sua internet e tente novamente.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function persistOrder(next: ManagedPhoto[]) {
    const anterior = photos
    // Atualiza a tela na hora e desfaz se o servidor recusar.
    setPhotos(next.map((p, i) => ({ ...p, position: i, isCover: i === 0 })))

    try {
      const response = await fetch(`/api/anuncios/${listingId}/imagens`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map((p) => p.id) }),
      })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? 'Não foi possível salvar a nova ordem.')
        setPhotos(anterior)
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError('Falha de conexão ao salvar a ordem das fotos.')
      setPhotos(anterior)
    }
  }

  function move(index: number, delta: number) {
    const destino = index + delta
    if (destino < 0 || destino >= photos.length) return
    const next = [...photos]
    const [item] = next.splice(index, 1)
    next.splice(destino, 0, item!)
    void persistOrder(next)
  }

  function setCover(index: number) {
    if (index === 0) return
    const next = [...photos]
    const [item] = next.splice(index, 1)
    next.unshift(item!)
    void persistOrder(next)
  }

  async function remove(photo: ManagedPhoto) {
    setError(null)
    const anterior = photos
    setPhotos((list) => list.filter((p) => p.id !== photo.id))

    try {
      const response = await fetch(`/api/anuncios/${listingId}/imagens/${photo.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? 'Não foi possível remover a foto.')
        setPhotos(anterior)
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError('Falha de conexão ao remover a foto.')
      setPhotos(anterior)
    }
  }

  return (
    <section aria-labelledby="fotos-titulo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="fotos-titulo" className="text-lg font-semibold">
            Fotos do veículo
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            A primeira foto é a capa do anúncio.{' '}
            <span className="tabular">{photos.length}</span> de{' '}
            <span className="tabular">{maxPhotos}</span> enviadas.
          </p>
        </div>

        <div>
          <input
            ref={inputRef}
            id="entrada-fotos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="apenas-leitor"
            disabled={uploading || restantes <= 0}
            onChange={(event) => void handleUpload(event.target.files)}
          />
          <Button
            type="button"
            variant="contorno"
            disabled={uploading || restantes <= 0}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus size={16} aria-hidden="true" />
            {uploading ? 'Enviando…' : restantes > 0 ? 'Adicionar fotos' : 'Limite atingido'}
          </Button>
        </div>
      </div>

      <FormError>{error}</FormError>

      <p aria-live="polite" className="apenas-leitor">
        {uploading ? 'Enviando fotos.' : pending ? 'Salvando ordem das fotos.' : ''}
      </p>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2 px-6 py-12 text-center">
          <ImagePlus size={24} aria-hidden="true" className="text-fg-subtle" />
          <p className="text-sm font-medium text-fg">Nenhuma foto ainda</p>
          <p className="max-w-sm text-xs leading-relaxed text-fg-muted">
            Envie de 1 a {maxPhotos} fotos (JPEG, PNG, WebP ou AVIF), com no máximo {maxFileMb} MB e
            pelo menos 480×480 pixels cada. Um anúncio sem foto não pode ser publicado.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className={cn(
                'overflow-hidden rounded-lg border bg-surface-2',
                photo.isCover ? 'border-accent-line' : 'border-line',
              )}
            >
              <div className="relative">
                <VehicleImage photo={photo} sizes="200px" ratio="aspect-[4/3]" />
                {index === 0 && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-xs bg-accent-solid px-2 py-0.5 text-[11px] font-bold text-accent-solid-fg">
                    <Star size={11} aria-hidden="true" className="fill-current" />
                    Capa
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-1 p-2">
                <div className="flex gap-1">
                  <IconButton
                    label={`Mover a foto ${index + 1} para trás`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Mover a foto ${index + 1} para frente`}
                    disabled={index === photos.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Definir a foto ${index + 1} como capa`}
                    disabled={index === 0}
                    onClick={() => setCover(index)}
                  >
                    <Star size={14} aria-hidden="true" />
                  </IconButton>
                </div>

                <IconButton
                  label={`Remover a foto ${index + 1}`}
                  danger
                  onClick={() => void remove(photo)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-fg-subtle">
        As fotos são convertidas para WebP no servidor, redimensionadas e perdem todos os metadados
        do arquivo original — inclusive a localização por GPS, quando existe.
      </p>
    </section>
  )
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md border border-line text-fg-muted transition-colors disabled:opacity-35',
        danger ? 'hover:border-danger/50 hover:text-danger' : 'hover:border-line-strong hover:text-fg',
      )}
    >
      {children}
      <span className="apenas-leitor">{label}</span>
    </button>
  )
}
