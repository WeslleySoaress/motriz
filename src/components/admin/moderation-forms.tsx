'use client'

import { useActionState, useState } from 'react'
import { Check, Ban, X } from 'lucide-react'
import {
  moderateListingAction,
  reinstateUserAction,
  resolveReportAction,
  suspendListingAction,
  suspendUserAction,
} from '@/server/actions/admin'
import { Button } from '@/components/ui/button'
import { Field, FormError, FormSuccess, Input, Textarea } from '@/components/ui/field'

/**
 * Formulários de moderação.
 *
 * Toda decisão negativa exige motivo escrito: ele é gravado na trilha de
 * auditoria e enviado ao anunciante. É o que torna a moderação auditável em
 * vez de arbitrária.
 */

export function ModerateListing({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(moderateListingAction, { ok: false })
  const [rejeitando, setRejeitando] = useState(false)

  if (state.ok) return <FormSuccess>{state.message}</FormSuccess>

  return (
    <div className="flex flex-col gap-3">
      <FormError>{state.message}</FormError>

      {!rejeitando ? (
        <div className="flex flex-wrap gap-2">
          <form action={formAction}>
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="decision" value="APPROVE" />
            <Button type="submit" size="sm" disabled={pending}>
              <Check size={15} aria-hidden="true" />
              {pending ? 'Aprovando…' : 'Aprovar e publicar'}
            </Button>
          </form>
          <Button type="button" variant="perigo" size="sm" onClick={() => setRejeitando(true)}>
            <X size={15} aria-hidden="true" />
            Rejeitar
          </Button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="decision" value="REJECT" />
          <Field
            id={`rejeicao-${listingId}`}
            label="Motivo da rejeição"
            hint="Este texto é enviado ao anunciante e fica registrado na auditoria."
            error={state.errors?.reason}
            required
          >
            {(props) => (
              <Textarea
                name="reason"
                rows={3}
                maxLength={500}
                placeholder="Ex.: as fotos não mostram o veículo anunciado."
                {...props}
              />
            )}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="perigo" size="sm" disabled={pending}>
              {pending ? 'Rejeitando…' : 'Confirmar rejeição'}
            </Button>
            <Button type="button" variant="fantasma" size="sm" onClick={() => setRejeitando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export function SuspendListing({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(suspendListingAction, { ok: false })
  const [aberto, setAberto] = useState(false)

  if (state.ok) return <FormSuccess>{state.message}</FormSuccess>

  if (!aberto) {
    return (
      <Button type="button" variant="perigo" size="sm" onClick={() => setAberto(true)}>
        <Ban size={15} aria-hidden="true" />
        Tirar do ar
      </Button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="listingId" value={listingId} />
      <FormError>{state.message}</FormError>
      <Field
        id={`suspensao-${listingId}`}
        label="Motivo"
        hint="Enviado ao anunciante e registrado na auditoria."
        error={state.errors?.reason}
        required
      >
        {(props) => <Textarea name="reason" rows={3} maxLength={500} {...props} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="perigo" size="sm" disabled={pending}>
          {pending ? 'Suspendendo…' : 'Confirmar'}
        </Button>
        <Button type="button" variant="fantasma" size="sm" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

export function ResolveReport({ reportId }: { reportId: string }) {
  const [state, formAction, pending] = useActionState(resolveReportAction, { ok: false })

  if (state.ok) return <FormSuccess>{state.message}</FormSuccess>

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="reportId" value={reportId} />
      <FormError>{state.message}</FormError>

      <Field
        id={`nota-${reportId}`}
        label="Nota da decisão (opcional)"
        error={state.errors?.note}
      >
        {(props) => (
          <Input name="note" maxLength={500} placeholder="Ex.: anúncio corrigido pelo dono." {...props} />
        )}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="ACTIONED" size="sm" disabled={pending}>
          Acatar denúncia
        </Button>
        <Button
          type="submit"
          name="decision"
          value="DISMISSED"
          variant="secundario"
          size="sm"
          disabled={pending}
        >
          Arquivar sem providência
        </Button>
      </div>
    </form>
  )
}

export function UserStatusForm({
  userId,
  status,
}: {
  userId: string
  status: string
}) {
  const [suspendState, suspendAction, suspendPending] = useActionState(suspendUserAction, {
    ok: false,
  })
  const [reinstateState, reinstateAction, reinstatePending] = useActionState(reinstateUserAction, {
    ok: false,
  })
  const [aberto, setAberto] = useState(false)

  if (status === 'SUSPENDED') {
    if (reinstateState.ok) return <FormSuccess>{reinstateState.message}</FormSuccess>
    return (
      <form action={reinstateAction} className="flex flex-col gap-2">
        <input type="hidden" name="userId" value={userId} />
        <FormError>{reinstateState.message}</FormError>
        <Input name="reason" placeholder="Motivo da reativação (opcional)" maxLength={500} />
        <Button type="submit" size="sm" variant="secundario" disabled={reinstatePending}>
          {reinstatePending ? 'Reativando…' : 'Reativar conta'}
        </Button>
      </form>
    )
  }

  if (suspendState.ok) return <FormSuccess>{suspendState.message}</FormSuccess>

  if (!aberto) {
    return (
      <Button type="button" variant="perigo" size="sm" onClick={() => setAberto(true)}>
        <Ban size={15} aria-hidden="true" />
        Suspender conta
      </Button>
    )
  }

  return (
    <form action={suspendAction} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <FormError>{suspendState.message}</FormError>
      <Field
        id={`suspender-${userId}`}
        label="Motivo da suspensão"
        hint="A conta perde o acesso imediatamente e os anúncios publicados são pausados."
        error={suspendState.errors?.reason}
        required
      >
        {(props) => <Textarea name="reason" rows={3} maxLength={500} {...props} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="perigo" size="sm" disabled={suspendPending}>
          {suspendPending ? 'Suspendendo…' : 'Confirmar suspensão'}
        </Button>
        <Button type="button" variant="fantasma" size="sm" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
