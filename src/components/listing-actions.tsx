'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, Flag, Share2, X } from 'lucide-react'
import { reportListingAction } from '@/server/actions/listings'
import { REPORT_REASONS, REPORT_REASON_LABELS } from '@/lib/enums'
import { Field, FormError, FormSuccess, Select, Textarea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'

/**
 * Compartilhar.
 * Usa a folha de compartilhamento do sistema quando o navegador oferece
 * (`navigator.share`, comum no celular) e, quando não oferece, copia o link
 * para a área de transferência com retorno visual.
 */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2400)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleShare() {
    const url = window.location.href
    setFailed(false)

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // Cancelado pela pessoa ou indisponível: cai para a cópia do link.
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold text-fg transition-colors hover:border-accent-line"
      >
        {copied ? (
          <>
            <Check size={16} aria-hidden="true" />
            Link copiado
          </>
        ) : (
          <>
            <Share2 size={16} aria-hidden="true" />
            Compartilhar
          </>
        )}
      </button>
      <p aria-live="polite" className="apenas-leitor">
        {copied ? 'Link copiado para a área de transferência.' : ''}
      </p>
      {failed && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
          <Copy size={12} aria-hidden="true" />
          Não foi possível copiar. Use o endereço da barra do navegador.
        </p>
      )}
    </div>
  )
}

/**
 * Denúncia de anúncio.
 * Diálogo modal com motivo obrigatório e detalhe opcional. O envio passa pela
 * server action, que valida de novo e aplica limite de requisições.
 */
export function ReportButton({ listingId, title }: { listingId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(reportListingAction, { ok: false })
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea',
      )
      if (!focusables.length) return
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

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted underline underline-offset-3 transition-colors hover:text-danger"
      >
        <Flag size={14} aria-hidden="true" />
        Denunciar anúncio
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/65"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative w-full max-w-lg rounded-t-xl border border-line bg-surface p-5 shadow-pop outline-none sm:rounded-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold">
                  Denunciar anúncio
                </h2>
                <p className="mt-1 text-sm text-fg-muted">{title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line text-fg-muted hover:text-fg"
              >
                <X size={18} aria-hidden="true" />
                <span className="apenas-leitor">Fechar</span>
              </button>
            </div>

            {state.ok ? (
              <div className="mt-5 flex flex-col gap-4">
                <FormSuccess>{state.message}</FormSuccess>
                <Button type="button" variant="secundario" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </div>
            ) : (
              <form action={formAction} className="mt-5 flex flex-col gap-4">
                <input type="hidden" name="listingId" value={listingId} />

                <FormError>{state.message}</FormError>

                <Field id="denuncia-motivo" label="Motivo" error={state.errors?.reason} required>
                  {(props) => (
                    <Select name="reason" defaultValue="" {...props}>
                      <option value="" disabled>
                        Selecione o motivo
                      </option>
                      {REPORT_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {REPORT_REASON_LABELS[reason]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field
                  id="denuncia-detalhes"
                  label="Detalhes (opcional)"
                  hint="Conte o que você observou. Isso ajuda a equipe de moderação a avaliar."
                  error={state.errors?.details}
                >
                  {(props) => (
                    <Textarea
                      name="details"
                      maxLength={1000}
                      rows={4}
                      placeholder="Ex.: o mesmo veículo aparece em outro anúncio com preço bem diferente."
                      {...props}
                    />
                  )}
                </Field>

                <div className="flex flex-col gap-2 sm:flex-row-reverse">
                  <Button type="submit" disabled={pending} className="sm:flex-1">
                    {pending ? 'Enviando…' : 'Enviar denúncia'}
                  </Button>
                  <Button
                    type="button"
                    variant="fantasma"
                    onClick={() => setOpen(false)}
                    className="sm:flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
