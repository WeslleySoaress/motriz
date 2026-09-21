'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { contactSellerAction } from '@/server/actions/listings'
import { Field, FormError, FormSuccess, Textarea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/format'

/**
 * Contato com o anunciante.
 *
 * Só aparece o que o anunciante liberou: telefone e e-mail ficam ocultos por
 * padrão e cada pessoa escolhe no perfil se quer exibi-los. O formulário de
 * mensagem exige login — isso evita que o endereço do anunciante seja coletado
 * por visitante anônimo e dá a ele um remetente para responder.
 */
export function ContactSeller({
  listingId,
  sellerName,
  contactChannel,
  contactPhone,
  publicPhone,
  publicEmail,
  isLoggedIn,
  isOwner,
  listingTitle,
  returnTo,
}: {
  listingId: string
  sellerName: string
  contactChannel: string
  contactPhone: string | null
  publicPhone: string | null
  publicEmail: string | null
  isLoggedIn: boolean
  isOwner: boolean
  listingTitle: string
  returnTo: string
}) {
  const [state, formAction, pending] = useActionState(contactSellerAction, { ok: false })
  const [formOpen, setFormOpen] = useState(false)

  const whatsapp = contactChannel === 'WHATSAPP' ? (contactPhone ?? publicPhone) : null

  if (isOwner) {
    return (
      <div className="rounded-lg border border-line bg-surface-2 p-5">
        <p className="text-sm text-fg-muted">
          Este anúncio é seu. Para editar ou alterar a situação, use o{' '}
          <Link href="/painel" className="link-sublinhado text-accent">
            painel do anunciante
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-5">
      <h2 className="text-base font-semibold">Falar com {sellerName.split(' ')[0]}</h2>

      <div className="mt-4 flex flex-col gap-2.5">
        {whatsapp && (
          <a
            href={`https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
              `Olá! Tenho interesse no ${listingTitle} anunciado na Motriz.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent-solid px-4 text-sm font-semibold text-accent-solid-fg transition-colors hover:bg-[color-mix(in_srgb,var(--accent-solid)_88%,#fff)]"
          >
            <MessageCircle size={16} aria-hidden="true" />
            Chamar no WhatsApp
          </a>
        )}

        {publicPhone && (
          <a
            href={`tel:+55${publicPhone.replace(/\D/g, '')}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold text-fg transition-colors hover:border-accent-line"
          >
            <Phone size={16} aria-hidden="true" />
            {formatPhone(publicPhone)}
          </a>
        )}

        {publicEmail && (
          <a
            href={`mailto:${publicEmail}?subject=${encodeURIComponent(`Interesse no ${listingTitle}`)}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold text-fg transition-colors hover:border-accent-line"
          >
            <Mail size={16} aria-hidden="true" />
            Enviar e-mail
          </a>
        )}

        {!isLoggedIn ? (
          <Link
            href={`/entrar?proximo=${encodeURIComponent(returnTo)}`}
            className="inline-flex h-11 items-center justify-center rounded-md border border-line-strong px-4 text-sm font-semibold text-fg transition-colors hover:border-accent-line"
          >
            Entrar para enviar mensagem
          </Link>
        ) : state.ok ? (
          <FormSuccess>{state.message}</FormSuccess>
        ) : formOpen ? (
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="listingId" value={listingId} />
            <FormError>{state.message}</FormError>
            <Field
              id="mensagem-anunciante"
              label="Sua mensagem"
              hint="O anunciante recebe seu nome e e-mail para responder."
              error={state.errors?.message}
              required
            >
              {(props) => (
                <Textarea
                  name="message"
                  rows={4}
                  maxLength={1500}
                  placeholder="Olá! O veículo ainda está disponível? Posso agendar uma visita?"
                  {...props}
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending} className="flex-1">
                {pending ? 'Enviando…' : 'Enviar mensagem'}
              </Button>
              <Button type="button" variant="fantasma" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="contorno" onClick={() => setFormOpen(true)}>
            Enviar mensagem
          </Button>
        )}
      </div>

      {!whatsapp && !publicPhone && !publicEmail && (
        <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
          Este anunciante optou por não exibir telefone nem e-mail publicamente. Use a mensagem
          acima para entrar em contato.
        </p>
      )}
    </div>
  )
}
