/**
 * Fonte única dos valores de domínio.
 *
 * O conector SQLite do Prisma não suporta `enum`, então as colunas são String.
 * Estas listas são a autoridade: alimentam a validação Zod no servidor, os
 * rótulos da interface e os filtros do catálogo. Nada além destes valores é
 * aceito em escrita.
 */

export const FUELS = [
  'FLEX',
  'GASOLINA',
  'ETANOL',
  'DIESEL',
  'HIBRIDO',
  'ELETRICO',
  'GNV',
] as const
export type Fuel = (typeof FUELS)[number]

export const FUEL_LABELS: Record<Fuel, string> = {
  FLEX: 'Flex',
  GASOLINA: 'Gasolina',
  ETANOL: 'Etanol',
  DIESEL: 'Diesel',
  HIBRIDO: 'Híbrido',
  ELETRICO: 'Elétrico',
  GNV: 'GNV',
}

export const TRANSMISSIONS = ['MANUAL', 'AUTOMATICO', 'AUTOMATIZADO', 'CVT'] as const
export type Transmission = (typeof TRANSMISSIONS)[number]

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  MANUAL: 'Manual',
  AUTOMATICO: 'Automático',
  AUTOMATIZADO: 'Automatizado',
  CVT: 'CVT',
}

export const BODY_TYPES = [
  'HATCH',
  'SEDA',
  'SUV',
  'PICAPE',
  'ESPORTIVO',
  'PERUA',
  'MINIVAN',
  'CUPE',
  'CONVERSIVEL',
] as const
export type BodyType = (typeof BODY_TYPES)[number]

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  HATCH: 'Hatch',
  SEDA: 'Sedã',
  SUV: 'SUV',
  PICAPE: 'Picape',
  ESPORTIVO: 'Esportivo',
  PERUA: 'Perua',
  MINIVAN: 'Minivan',
  CUPE: 'Cupê',
  CONVERSIVEL: 'Conversível',
}

export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING',
  'PUBLISHED',
  'PAUSED',
  'SOLD',
  'REJECTED',
] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Em análise',
  PUBLISHED: 'Publicado',
  PAUSED: 'Pausado',
  SOLD: 'Vendido',
  REJECTED: 'Rejeitado',
}

/**
 * Regra central de visibilidade pública.
 *
 * Apenas PUBLISHED e SOLD aparecem para visitantes — SOLD permanece visível
 * como histórico, marcado como vendido. Rascunho, análise, pausado e rejeitado
 * NUNCA são expostos, nem por acesso direto à API/slug. Toda consulta pública
 * deriva desta constante.
 */
export const PUBLICLY_VISIBLE_STATUSES: readonly ListingStatus[] = ['PUBLISHED', 'SOLD']

export function isPubliclyVisible(status: string): boolean {
  return (PUBLICLY_VISIBLE_STATUSES as readonly string[]).includes(status)
}

export const CONTACT_CHANNELS = ['PLATFORM', 'WHATSAPP', 'EMAIL'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  PLATFORM: 'Mensagem pela plataforma',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
}

export const REPORT_REASONS = [
  'FRAUDE',
  'PRECO_ENGANOSO',
  'DUPLICADO',
  'FOTOS_INDEVIDAS',
  'JA_VENDIDO',
  'OUTRO',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  FRAUDE: 'Suspeita de fraude ou golpe',
  PRECO_ENGANOSO: 'Preço enganoso',
  DUPLICADO: 'Anúncio duplicado',
  FOTOS_INDEVIDAS: 'Fotos indevidas ou de terceiros',
  JA_VENDIDO: 'Veículo já vendido',
  OUTRO: 'Outro motivo',
}

export const REPORT_STATUSES = ['OPEN', 'ACTIONED', 'DISMISSED'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: 'Em aberto',
  ACTIONED: 'Providência tomada',
  DISMISSED: 'Sem providência',
}

export const ROLES = ['USER', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const SORT_OPTIONS = [
  'recentes',
  'preco-asc',
  'preco-desc',
  'ano-desc',
  'ano-asc',
  'km-asc',
] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

export const SORT_LABELS: Record<SortOption, string> = {
  recentes: 'Mais recentes',
  'preco-asc': 'Menor preço',
  'preco-desc': 'Maior preço',
  'ano-desc': 'Ano mais novo',
  'ano-asc': 'Ano mais antigo',
  'km-asc': 'Menor quilometragem',
}

/** Unidades federativas do Brasil, para validação de `state`. */
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const
export type UF = (typeof UFS)[number]

/** Opcionais que o anunciante pode marcar. Lista fechada: evita texto livre. */
export const FEATURES = [
  'Ar-condicionado',
  'Direção elétrica',
  'Vidros elétricos',
  'Travas elétricas',
  'Airbag duplo',
  'Freios ABS',
  'Controle de estabilidade',
  'Câmera de ré',
  'Sensor de estacionamento',
  'Piloto automático',
  'Central multimídia',
  'Apple CarPlay / Android Auto',
  'Bancos de couro',
  'Bancos com regulagem elétrica',
  'Teto solar',
  'Rodas de liga leve',
  'Faróis de LED',
  'Engate para reboque',
  'Tração 4x4',
  'Câmbio com aletas no volante',
  'Ar-condicionado digital',
  'Único dono',
  'Manual e chave reserva',
  'Revisões em concessionária',
] as const
export type Feature = (typeof FEATURES)[number]

export const ADMIN_ACTIONS = [
  'LISTING_APPROVE',
  'LISTING_REJECT',
  'LISTING_SUSPEND',
  'USER_SUSPEND',
  'USER_REINSTATE',
  'REPORT_ACTIONED',
  'REPORT_DISMISSED',
] as const
export type AdminActionType = (typeof ADMIN_ACTIONS)[number]

export const ADMIN_ACTION_LABELS: Record<AdminActionType, string> = {
  LISTING_APPROVE: 'Anúncio aprovado',
  LISTING_REJECT: 'Anúncio rejeitado',
  LISTING_SUSPEND: 'Anúncio suspenso',
  USER_SUSPEND: 'Conta suspensa',
  USER_REINSTATE: 'Conta reativada',
  REPORT_ACTIONED: 'Denúncia acatada',
  REPORT_DISMISSED: 'Denúncia arquivada',
}
