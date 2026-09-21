import { PUBLICLY_VISIBLE_STATUSES, type ListingStatus } from '@/lib/enums'

/**
 * Regras de negócio do anúncio — funções puras, sem banco e sem React.
 *
 * Ficam separadas das ações de servidor por dois motivos: podem ser testadas
 * sem subir nada, e a mesma regra vale para server action, route handler e
 * painel administrativo, sem duplicação.
 */

export type ListingOwnerView = {
  id: string
  sellerId: string
  status: string
}

export type ActorView = {
  id: string
  role: string
} | null

/** Transições permitidas ao próprio anunciante. */
const SELLER_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['PENDING', 'PUBLISHED'],
  PENDING: ['DRAFT'],
  PUBLISHED: ['PAUSED', 'SOLD'],
  PAUSED: ['PUBLISHED', 'SOLD'],
  SOLD: ['PUBLISHED'],
  // Rejeitado volta para análise depois que o anunciante corrige.
  REJECTED: ['PENDING', 'DRAFT'],
}

export function canSellerTransition(from: string, to: string): boolean {
  const allowed = SELLER_TRANSITIONS[from as ListingStatus]
  return Array.isArray(allowed) && allowed.includes(to as ListingStatus)
}

/**
 * Para onde vai o anúncio quando o anunciante pede publicação.
 * Com moderação ligada passa por análise; sem moderação vai direto ao ar.
 */
export function statusOnPublishRequest(moderationEnabled: boolean): ListingStatus {
  return moderationEnabled ? 'PENDING' : 'PUBLISHED'
}

export function isOwner(listing: ListingOwnerView, actor: ActorView): boolean {
  return Boolean(actor) && listing.sellerId === actor!.id
}

export function isAdmin(actor: ActorView): boolean {
  return actor?.role === 'ADMIN'
}

/** Quem pode abrir a página de edição e alterar campos do anúncio. */
export function canEdit(listing: ListingOwnerView, actor: ActorView): boolean {
  return isOwner(listing, actor)
}

/** Quem pode excluir. Administração pode remover conteúdo impróprio. */
export function canDelete(listing: ListingOwnerView, actor: ActorView): boolean {
  return isOwner(listing, actor) || isAdmin(actor)
}

/**
 * Visibilidade do anúncio. Esta é a função que impede vazamento de rascunho:
 * um anúncio não público só é visível para o dono e para a administração.
 */
export function canView(listing: ListingOwnerView, actor: ActorView): boolean {
  if ((PUBLICLY_VISIBLE_STATUSES as readonly string[]).includes(listing.status)) return true
  return isOwner(listing, actor) || isAdmin(actor)
}

export type PublishBlocker =
  | 'SEM_FOTO'
  | 'EMAIL_NAO_VERIFICADO'
  | 'CAMPOS_INCOMPLETOS'
  | 'CONTA_SUSPENSA'

/**
 * O que ainda impede a publicação. Devolver a lista (em vez de um booleano)
 * deixa a interface explicar exatamente o que falta.
 */
export function publishBlockers(input: {
  imageCount: number
  emailVerified: boolean
  userStatus: string
  coreValid: boolean
}): PublishBlocker[] {
  const blockers: PublishBlocker[] = []
  if (input.userStatus !== 'ACTIVE') blockers.push('CONTA_SUSPENSA')
  if (!input.emailVerified) blockers.push('EMAIL_NAO_VERIFICADO')
  if (input.imageCount < 1) blockers.push('SEM_FOTO')
  if (!input.coreValid) blockers.push('CAMPOS_INCOMPLETOS')
  return blockers
}

export const PUBLISH_BLOCKER_LABELS: Record<PublishBlocker, string> = {
  SEM_FOTO: 'Adicione pelo menos uma foto do veículo.',
  EMAIL_NAO_VERIFICADO: 'Confirme seu e-mail para publicar anúncios.',
  CAMPOS_INCOMPLETOS: 'Preencha todos os campos obrigatórios do anúncio.',
  CONTA_SUSPENSA: 'Sua conta está suspensa e não pode publicar anúncios.',
}

/**
 * Campos que a gravação deve ajustar junto com a troca de status, para que
 * status e datas nunca fiquem inconsistentes.
 */
export function statusSideEffects(to: ListingStatus): {
  publishedAt?: Date | null
  soldAt?: Date | null
  rejectionReason?: null
  moderatedAt?: Date
} {
  switch (to) {
    case 'PUBLISHED':
      return { publishedAt: new Date(), soldAt: null, rejectionReason: null }
    case 'SOLD':
      return { soldAt: new Date() }
    case 'PENDING':
      return { rejectionReason: null }
    case 'PAUSED':
    case 'DRAFT':
      return {}
    case 'REJECTED':
      return { moderatedAt: new Date(), publishedAt: null }
  }
}

/** Quantidade máxima de fotos por anúncio, espelhando o limite do ambiente. */
export function canAddImages(current: number, adding: number, max: number): boolean {
  return current + adding <= max
}
