'use client'

import { useActionState, useState } from 'react'
import { saveDraftAction, saveListingAction } from '@/server/actions/listings'
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { TickRule } from '@/components/ui/misc'
import {
  BODY_TYPES,
  BODY_TYPE_LABELS,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABELS,
  FEATURES,
  FUELS,
  FUEL_LABELS,
  TRANSMISSIONS,
  TRANSMISSION_LABELS,
  UFS,
} from '@/lib/enums'
import { centsToInput } from '@/lib/format'

export type ListingFormData = {
  id: string
  brand: string
  model: string
  trim: string
  year: number
  modelYear: number
  priceCents: number
  mileageKm: number
  fuel: string
  transmission: string
  bodyType: string
  color: string
  doors: number
  city: string
  state: string
  description: string
  features: string[]
  contactChannel: string
  contactPhone: string | null
  status: string
}

/**
 * Ficha do anúncio.
 *
 * Dois caminhos de gravação, propositalmente diferentes:
 *  - "Salvar rascunho" aceita campos em branco, para a pessoa poder parar no
 *    meio e voltar depois;
 *  - "Salvar alterações" exige a ficha completa e é o que se usa num anúncio
 *    já publicado.
 *
 * Em ambos, quem valida de verdade é o servidor (Zod em src/lib/validation.ts).
 * Os atributos do HTML aqui servem para dar retorno imediato, não para
 * autorizar nada.
 */
export function ListingForm({ listing }: { listing: ListingFormData }) {
  const isDraft = listing.status === 'DRAFT' || listing.status === 'REJECTED'
  const action = isDraft ? saveDraftAction : saveListingAction
  const [state, formAction, pending] = useActionState(action, { ok: false })
  const [channel, setChannel] = useState(listing.contactChannel)

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      <input type="hidden" name="listingId" value={listing.id} />

      {state.ok ? <FormSuccess>{state.message}</FormSuccess> : <FormError>{state.message}</FormError>}

      {/* ── Identificação ───────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5">
        <legend className="rotulo mb-1">Identificação do veículo</legend>
        <TickRule className="mb-1" />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="campo-marca" label="Marca" error={state.errors?.brand} required>
            {(props) => (
              <Input name="brand" defaultValue={listing.brand} placeholder="Ex.: Toyota" maxLength={40} {...props} />
            )}
          </Field>

          <Field id="campo-modelo" label="Modelo" error={state.errors?.model} required>
            {(props) => (
              <Input name="model" defaultValue={listing.model} placeholder="Ex.: Corolla" maxLength={60} {...props} />
            )}
          </Field>
        </div>

        <Field
          id="campo-versao"
          label="Versão"
          hint="Como aparece no documento ou no anúncio da fabricante."
          error={state.errors?.trim}
          required
        >
          {(props) => (
            <Input
              name="trim"
              defaultValue={listing.trim}
              placeholder="Ex.: Altis Premium Hybrid"
              maxLength={80}
              {...props}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="campo-ano" label="Ano de fabricação" error={state.errors?.year} required>
            {(props) => (
              <Input
                name="year"
                type="number"
                inputMode="numeric"
                min={1950}
                max={new Date().getFullYear() + 1}
                defaultValue={listing.year || ''}
                {...props}
              />
            )}
          </Field>

          <Field id="campo-ano-modelo" label="Ano do modelo" error={state.errors?.modelYear} required>
            {(props) => (
              <Input
                name="modelYear"
                type="number"
                inputMode="numeric"
                min={1950}
                max={new Date().getFullYear() + 2}
                defaultValue={listing.modelYear || ''}
                {...props}
              />
            )}
          </Field>

          <Field
            id="campo-preco"
            label="Preço (R$)"
            error={state.errors?.priceCents}
            required
          >
            {(props) => (
              <Input
                name="price"
                inputMode="decimal"
                defaultValue={listing.priceCents > 0 ? centsToInput(listing.priceCents) : ''}
                placeholder="89.900"
                {...props}
              />
            )}
          </Field>

          <Field id="campo-km" label="Quilometragem" error={state.errors?.mileageKm} required>
            {(props) => (
              <Input
                name="mileageKm"
                type="number"
                inputMode="numeric"
                min={0}
                max={2000000}
                defaultValue={listing.mileageKm || ''}
                placeholder="45000"
                {...props}
              />
            )}
          </Field>
        </div>
      </fieldset>

      {/* ── Ficha técnica ───────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5">
        <legend className="rotulo mb-1">Ficha técnica</legend>
        <TickRule className="mb-1" />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="campo-combustivel" label="Combustível" error={state.errors?.fuel} required>
            {(props) => (
              <Select name="fuel" defaultValue={listing.fuel} {...props}>
                {FUELS.map((f) => (
                  <option key={f} value={f}>
                    {FUEL_LABELS[f]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field id="campo-cambio" label="Câmbio" error={state.errors?.transmission} required>
            {(props) => (
              <Select name="transmission" defaultValue={listing.transmission} {...props}>
                {TRANSMISSIONS.map((t) => (
                  <option key={t} value={t}>
                    {TRANSMISSION_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field id="campo-carroceria" label="Carroceria" error={state.errors?.bodyType} required>
            {(props) => (
              <Select name="bodyType" defaultValue={listing.bodyType} {...props}>
                {BODY_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {BODY_TYPE_LABELS[b]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field id="campo-cor" label="Cor" error={state.errors?.color} required>
            {(props) => (
              <Input name="color" defaultValue={listing.color} placeholder="Ex.: Prata" maxLength={30} {...props} />
            )}
          </Field>

          <Field id="campo-portas" label="Portas" error={state.errors?.doors}>
            {(props) => (
              <Select name="doors" defaultValue={String(listing.doors)} {...props}>
                {[2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </fieldset>

      {/* ── Localização ─────────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5">
        <legend className="rotulo mb-1">Onde está o veículo</legend>
        <TickRule className="mb-1" />

        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field id="campo-cidade" label="Cidade" error={state.errors?.city} required>
            {(props) => (
              <Input name="city" defaultValue={listing.city} placeholder="Ex.: Campinas" maxLength={60} {...props} />
            )}
          </Field>

          <Field id="campo-uf" label="UF" error={state.errors?.state} required>
            {(props) => (
              <Select name="state" defaultValue={listing.state} {...props}>
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </fieldset>

      {/* ── Descrição e opcionais ───────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5">
        <legend className="rotulo mb-1">Descrição e opcionais</legend>
        <TickRule className="mb-1" />

        <Field
          id="campo-descricao"
          label="Descrição"
          hint="Conte o estado de conservação, histórico de manutenção e o que precisa de atenção. Mínimo de 40 caracteres."
          error={state.errors?.description}
          required
        >
          {(props) => (
            <Textarea
              name="description"
              defaultValue={listing.description}
              rows={8}
              maxLength={4000}
              placeholder="Ex.: Revisões feitas na concessionária, pneus trocados há 8 mil km, pequeno risco no para-choque traseiro (visível na foto 4)…"
              {...props}
            />
          )}
        </Field>

        <div>
          <p className="mb-3 text-sm font-medium text-fg">Opcionais e itens de série</p>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature}>
                <Checkbox
                  id={`opcional-${feature}`}
                  name="features"
                  value={feature}
                  defaultChecked={listing.features.includes(feature)}
                  label={feature}
                />
              </li>
            ))}
          </ul>
        </div>
      </fieldset>

      {/* ── Contato ─────────────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5">
        <legend className="rotulo mb-1">Como quer receber contato</legend>
        <TickRule className="mb-1" />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="campo-canal" label="Canal preferido" error={state.errors?.contactChannel}>
            {(props) => (
              <Select
                name="contactChannel"
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                {...props}
              >
                {CONTACT_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CONTACT_CHANNEL_LABELS[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {channel === 'WHATSAPP' && (
            <Field
              id="campo-whatsapp"
              label="WhatsApp"
              hint="Com DDD. Aparece publicamente na página do anúncio."
              error={state.errors?.contactPhone}
              required
            >
              {(props) => (
                <Input
                  name="contactPhone"
                  inputMode="tel"
                  defaultValue={listing.contactPhone ?? ''}
                  placeholder="(11) 98888-7777"
                  {...props}
                />
              )}
            </Field>
          )}
        </div>

        <p className="text-xs leading-relaxed text-fg-subtle">
          Telefone e e-mail do seu perfil continuam ocultos, a menos que você libere a exibição em{' '}
          <a href="/conta" className="link-sublinhado">
            Minha conta
          </a>
          . Mesmo sem nenhum contato público, interessados conseguem enviar mensagem pela
          plataforma.
        </p>
      </fieldset>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border sm:px-5">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Salvando…' : isDraft ? 'Salvar rascunho' : 'Salvar alterações'}
        </Button>
        <p className="self-center text-xs text-fg-muted">
          {isDraft
            ? 'Você pode salvar quantas vezes quiser antes de publicar.'
            : 'As alterações entram no ar assim que você salvar.'}
        </p>
      </div>
    </form>
  )
}
