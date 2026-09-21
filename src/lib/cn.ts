/**
 * Junta classes ignorando valores falsos.
 * Deliberadamente simples: não usamos `tailwind-merge` porque os componentes
 * deste projeto não sobrescrevem classes conflitantes — quando precisam de
 * variação, ela é declarada como variante.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
