/**
 * Contas e formato dos dados de partida.
 *
 * Arquivo propositalmente sem nenhuma importação do código do servidor: ele é
 * carregado pelos testes, que rodam em um processo sem as variáveis de
 * ambiente da aplicação. Importar src/lib/db aqui faria a validação de
 * ambiente derrubar a suíte inteira.
 */

export const CONTAS = {
  admin: { email: 'admin@e2e.local', senha: 'Senha!Admin#E2E2024', nome: 'Admin E2E' },
  vendedor: { email: 'vendedor@e2e.local', senha: 'Senha!Vend#E2E2024', nome: 'Vendedor E2E' },
  outro: { email: 'outro@e2e.local', senha: 'Senha!Outro#E2E2024', nome: 'Outro E2E' },
} as const

export type DadosE2E = {
  vendedorId: string
  outroId: string
  anuncioPublicadoId: string
  anuncioPublicadoSlug: string
  rascunhoId: string
  rascunhoSlug: string
  imagemDoRascunhoKey: string
  imagemPublicadaKey: string
  anuncioDoOutroId: string
}
