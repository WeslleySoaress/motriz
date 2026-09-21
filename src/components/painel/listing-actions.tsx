'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Eye, Pause, Pencil, Play, Tag, Trash2, Upload } from 'lucide-react'
import { changeStatusAction, deleteListingAction } from '@/server/actions/listings'
import { Button } from '@/components/ui/button'
import { FormError, FormSuccess } from '@/components/ui/field'
import type { ListingStatus } from '@/lib/enums'

/**
 * Ações de um anúncio no painel.
 *
 * Os botões mostrados dependem da situação atual — não exibimos ação que o
 * servidor recusaria. Mesmo assim, a regra de transição é reavaliada lá: a
 * interface é uma conveniência, não a autorização.
 */
export function ListingRowActions({
  listingId,
  slug,
  status,
  title,
}: {
  listingId: string
  slug: string
  status: string
  title: string
}) {
  const [statusState, statusAction, statusPending] = useActionState(changeStatusAction, {
    ok: false,
  })
  const [deleteState, deleteAction, deletePending] = useActionState(deleteListingAction, {
    ok: false,
  })
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const s = status as ListingStatus

  return (
    <div className="flex flex-col gap-3">
      {statusState.message && (
        <div>{statusState.ok ? <FormSuccess>{statusState.message}</FormSuccess> : <FormError>{statusState.message}</FormError>}</div>
      )}
      <FormError>{deleteState.message}</FormError>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/painel/anuncios/${listingId}/editar`}
          className="alvo-toque inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm font-medium text-fg transition-colors hover:border-accent-line"
        >
          <Pencil size={14} aria-hidden="true" />
          Editar
        </Link>

        {['PUBLISHED', 'SOLD'].includes(s) && (
          <Link
            href={`/veiculo/${slug}`}
            className="alvo-toque inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm font-medium text-fg transition-colors hover:border-accent-line"
          >
            <Eye size={14} aria-hidden="true" />
            Ver anúncio
          </Link>
        )}

        {(s === 'DRAFT' || s === 'REJECTED' || s === 'PAUSED' || s === 'SOLD') && (
          <StatusButton
            action={statusAction}
            listingId={listingId}
            status="PUBLISHED"
            pending={statusPending}
            icon={s === 'PAUSED' || s === 'SOLD' ? <Play size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
          >
            {s === 'PAUSED' || s === 'SOLD' ? 'Reativar' : 'Publicar'}
          </StatusButton>
        )}

        {s === 'PUBLISHED' && (
          <>
            <StatusButton
              action={statusAction}
              listingId={listingId}
              status="PAUSED"
              pending={statusPending}
              icon={<Pause size={14} aria-hidden="true" />}
            >
              Pausar
            </StatusButton>
            <StatusButton
              action={statusAction}
              listingId={listingId}
              status="SOLD"
              pending={statusPending}
              icon={<Tag size={14} aria-hidden="true" />}
            >
              Marcar como vendido
            </StatusButton>
          </>
        )}

        {s === 'PENDING' && (
          <StatusButton
            action={statusAction}
            listingId={listingId}
            status="DRAFT"
            pending={statusPending}
            icon={<Pencil size={14} aria-hidden="true" />}
          >
            Retirar da análise
          </StatusButton>
        )}

        {!confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="alvo-toque inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm font-medium text-fg-muted transition-colors hover:border-danger/50 hover:text-danger"
          >
            <Trash2 size={14} aria-hidden="true" />
            Excluir
          </button>
        )}
      </div>

      {confirmingDelete && (
        <div
          role="alertdialog"
          aria-label="Confirmar exclusão"
          className="rounded-md border border-danger/40 bg-danger-soft p-4"
        >
          <p className="text-sm text-fg">
            Excluir <strong>{title}</strong> em definitivo? As fotos também serão apagadas. Não dá
            para desfazer.
          </p>
          <form action={deleteAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="listingId" value={listingId} />
            <Button type="submit" variant="perigo" size="sm" disabled={deletePending}>
              {deletePending ? 'Excluindo…' : 'Sim, excluir'}
            </Button>
            <Button
              type="button"
              variant="fantasma"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancelar
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

function StatusButton({
  action,
  listingId,
  status,
  pending,
  icon,
  children,
}: {
  action: (formData: FormData) => void
  listingId: string
  status: ListingStatus
  pending: boolean
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <form action={action}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={pending}
        className="alvo-toque inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm font-medium text-fg transition-colors hover:border-accent-line disabled:opacity-50"
      >
        {icon}
        {children}
      </button>
    </form>
  )
}
