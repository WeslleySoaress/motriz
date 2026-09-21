import { z } from 'zod'
import {
  BODY_TYPES,
  CONTACT_CHANNELS,
  FEATURES,
  FUELS,
  REPORT_REASONS,
  TRANSMISSIONS,
  UFS,
} from './enums'

/**
 * Validação de entrada.
 *
 * Estes schemas rodam **no servidor**, em toda server action e route handler.
 * O mesmo schema é reaproveitado no cliente só para dar retorno imediato ao
 * usuário — a decisão de aceitar ou recusar é sempre do servidor.
 */

const CURRENT_YEAR = new Date().getFullYear()
const OLDEST_YEAR = 1950

/** Senhas mais usadas em vazamentos públicos, barradas no cadastro. */
const COMMON_PASSWORDS = new Set([
  'senha123456',
  '123456789012',
  'qwertyuiop12',
  'password1234',
  'motrizmotriz',
  'abcd12345678',
  '112233445566',
])

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Informe um e-mail válido.')
  .max(254, 'E-mail longo demais.')
  .pipe(z.email('Informe um e-mail válido.'))

export const passwordSchema = z
  .string()
  .min(10, 'A senha precisa de pelo menos 10 caracteres.')
  .max(200, 'A senha pode ter no máximo 200 caracteres.')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), {
    message: 'Essa senha é muito comum. Escolha outra.',
  })
  .refine((v) => v.trim().length >= 10, {
    message: 'A senha não pode ser só espaços.',
  })

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Informe seu nome.')
  .max(80, 'Nome longo demais.')
  .regex(/^[\p{L}\p{M}'\- .]+$/u, 'Use apenas letras, espaços, apóstrofo e hífen.')

/** Aceita 10 ou 11 dígitos (fixo ou celular), com ou sem máscara. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 10 || v.length === 11, {
    message: 'Informe um telefone com DDD, ex.: (11) 98888-7777.',
  })

export const ufSchema = z.enum(UFS, { message: 'Selecione uma UF válida.' })

export const citySchema = z
  .string()
  .trim()
  .min(2, 'Informe a cidade.')
  .max(60, 'Nome de cidade longo demais.')

// ─── Conta ───────────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.').max(200),
})

export const requestResetSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10).max(200),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não conferem.',
    path: ['confirm'],
  })

export const profileSchema = z.object({
  name: nameSchema,
  phone: z.union([phoneSchema, z.literal('')]).optional(),
  city: z.union([citySchema, z.literal('')]).optional(),
  state: z.union([ufSchema, z.literal('')]).optional(),
  bio: z.string().trim().max(400, 'Máximo de 400 caracteres.').optional(),
  showPhone: z.coerce.boolean().default(false),
  showEmail: z.coerce.boolean().default(false),
})

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Informe a senha atual.'),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não conferem.',
    path: ['confirm'],
  })

// ─── Anúncio ─────────────────────────────────────────────────────────────────

/**
 * Preço em centavos. A interface recebe "89.900" ou "89900,00"; a conversão
 * acontece antes, em `parsePriceToCents`, e aqui validamos o inteiro final.
 */
export const priceCentsSchema = z
  .number()
  .int('Preço inválido.')
  .min(100_000, 'O preço mínimo é R$ 1.000.')
  .max(9_999_999_900, 'O preço máximo é R$ 99.999.999.')

export const listingCoreSchema = z
  .object({
    brand: z.string().trim().min(2, 'Informe a marca.').max(40),
    model: z.string().trim().min(1, 'Informe o modelo.').max(60),
    trim: z.string().trim().min(1, 'Informe a versão.').max(80),
    year: z.coerce
      .number()
      .int()
      .min(OLDEST_YEAR, `Ano a partir de ${OLDEST_YEAR}.`)
      .max(CURRENT_YEAR + 1, 'Ano de fabricação inválido.'),
    modelYear: z.coerce
      .number()
      .int()
      .min(OLDEST_YEAR, `Ano a partir de ${OLDEST_YEAR}.`)
      .max(CURRENT_YEAR + 2, 'Ano do modelo inválido.'),
    priceCents: priceCentsSchema,
    mileageKm: z.coerce
      .number()
      .int('Quilometragem inválida.')
      .min(0, 'Quilometragem não pode ser negativa.')
      .max(2_000_000, 'Quilometragem acima do aceitável.'),
    fuel: z.enum(FUELS, { message: 'Selecione o combustível.' }),
    transmission: z.enum(TRANSMISSIONS, { message: 'Selecione o câmbio.' }),
    bodyType: z.enum(BODY_TYPES, { message: 'Selecione a carroceria.' }),
    color: z.string().trim().min(3, 'Informe a cor.').max(30),
    doors: z.coerce.number().int().min(2).max(5).default(4),
    city: citySchema,
    state: ufSchema,
    description: z
      .string()
      .trim()
      .min(40, 'Descreva o veículo em pelo menos 40 caracteres.')
      .max(4000, 'Máximo de 4000 caracteres.'),
    features: z.array(z.enum(FEATURES)).max(FEATURES.length).default([]),
    contactChannel: z.enum(CONTACT_CHANNELS).default('PLATFORM'),
    contactPhone: z.union([phoneSchema, z.literal('')]).optional(),
  })
  .refine((d) => d.modelYear >= d.year, {
    message: 'O ano do modelo não pode ser anterior ao ano de fabricação.',
    path: ['modelYear'],
  })
  .refine((d) => d.modelYear - d.year <= 1, {
    message: 'O ano do modelo pode ser no máximo um ano à frente da fabricação.',
    path: ['modelYear'],
  })
  .refine((d) => d.contactChannel !== 'WHATSAPP' || Boolean(d.contactPhone), {
    message: 'Informe o WhatsApp para usar esse canal de contato.',
    path: ['contactPhone'],
  })

export type ListingCoreInput = z.infer<typeof listingCoreSchema>

/**
 * Rascunho: o anunciante pode salvar com poucos campos preenchidos e continuar
 * depois. A validação completa só é exigida ao publicar.
 */
export const listingDraftSchema = z.object({
  brand: z.string().trim().max(40).optional(),
  model: z.string().trim().max(60).optional(),
  trim: z.string().trim().max(80).optional(),
  year: z.coerce.number().int().min(OLDEST_YEAR).max(CURRENT_YEAR + 1).optional(),
  modelYear: z.coerce.number().int().min(OLDEST_YEAR).max(CURRENT_YEAR + 2).optional(),
  priceCents: z.number().int().min(0).max(9_999_999_900).optional(),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000).optional(),
  fuel: z.enum(FUELS).optional(),
  transmission: z.enum(TRANSMISSIONS).optional(),
  bodyType: z.enum(BODY_TYPES).optional(),
  color: z.string().trim().max(30).optional(),
  doors: z.coerce.number().int().min(2).max(5).optional(),
  city: z.string().trim().max(60).optional(),
  state: z.union([ufSchema, z.literal('')]).optional(),
  description: z.string().trim().max(4000).optional(),
  features: z.array(z.enum(FEATURES)).optional(),
  contactChannel: z.enum(CONTACT_CHANNELS).optional(),
  contactPhone: z.union([phoneSchema, z.literal('')]).optional(),
})

export const imageAltSchema = z.string().trim().min(3).max(180)

export const imageOrderSchema = z.object({
  /** Ids das imagens na ordem desejada; o primeiro vira a capa. */
  order: z.array(z.string().min(1).max(40)).min(1).max(40),
})

// ─── Denúncia e moderação ────────────────────────────────────────────────────

export const reportSchema = z.object({
  listingId: z.string().min(1).max(40),
  reason: z.enum(REPORT_REASONS, { message: 'Selecione o motivo.' }),
  details: z.string().trim().max(1000, 'Máximo de 1000 caracteres.').optional(),
})

export const moderationSchema = z.object({
  listingId: z.string().min(1).max(40),
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(500).optional(),
})

export const suspendUserSchema = z.object({
  userId: z.string().min(1).max(40),
  reason: z.string().trim().min(5, 'Descreva o motivo da suspensão.').max(500),
})

export const resolveReportSchema = z.object({
  reportId: z.string().min(1).max(40),
  decision: z.enum(['ACTIONED', 'DISMISSED']),
  note: z.string().trim().max(500).optional(),
})

// ─── Utilidades ──────────────────────────────────────────────────────────────

export type FieldErrors = Record<string, string>

/** Achata os erros do Zod em { campo: "mensagem" } para renderizar no form. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/** Mensagem do interessado para o anunciante. */
export const contactMessageSchema = z
  .string()
  .trim()
  .min(20, 'Escreva pelo menos 20 caracteres para o anunciante entender seu interesse.')
  .max(1500, 'Máximo de 1500 caracteres.')
