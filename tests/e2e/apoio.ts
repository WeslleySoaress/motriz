import { readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { expect, type Locator, type Page } from '@playwright/test'
import { type DadosE2E } from './dados-fixos'

export { CONTAS } from './dados-fixos'

/** Ids e slugs criados por tests/e2e/preparar.ts. */
export function dados(): DadosE2E {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), 'tests', 'e2e', '.dados.json'), 'utf8'),
  ) as DadosE2E
}

export async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/entrar')
  await page.getByLabel(/^E-mail/).fill(email)
  await page.getByLabel(/^Senha/).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  // Depois do login o usuário sai da tela de entrada.
  await expect(page).not.toHaveURL(/\/entrar/, { timeout: 20_000 })
}

export async function sair(page: Page) {
  await page.goto('/painel')
  await page.getByRole('button', { name: /^Vendedor|^Admin|^Outro/ }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL('/')
}

/** Gera uma foto válida em memória, para o input de arquivo. */
export async function fotoValida(
  nome = 'carro.jpg',
  largura = 1200,
  altura = 900,
): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const buffer = await sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 60, g: 90, b: 120 } },
  })
    .jpeg({ quality: 78 })
    .toBuffer()
  return { name: nome, mimeType: 'image/jpeg', buffer }
}

/** Lê o último link de um tipo de e-mail gravado em log/emails.log. */
export function ultimoLinkDoEmail(trecho: string): string | null {
  try {
    const conteudo = readFileSync(path.join(process.cwd(), 'log', 'emails.log'), 'utf8')
    const blocos = conteudo.split('─'.repeat(72)).filter((b) => b.includes(trecho))
    const ultimo = blocos[blocos.length - 1]
    if (!ultimo) return null
    const match = ultimo.match(/https?:\/\/\S+/g)
    return match?.[match.length - 1] ?? null
  } catch {
    return null
  }
}

/**
 * Envia fotos pelo seletor de arquivos.
 *
 * Não usamos setInputFiles direto no input: ele dispara o evento 'change'
 * imediatamente, e se o React ainda não hidratou a página o manipulador não
 * existe — o arquivo é anexado e nada acontece, silenciosamente.
 *
 * Abrir o seletor pelo botão resolve isso: o clique só abre o seletor depois
 * que o onClick está ligado. A tentativa é repetida até o seletor abrir, e os
 * arquivos só entram aí — então o upload acontece exatamente uma vez.
 */
export async function enviarFotos(
  page: Page,
  arquivos: Array<{ name: string; mimeType: string; buffer: Buffer }>,
) {
  await expect(async () => {
    const seletor = page.waitForEvent('filechooser', { timeout: 3_000 })
    await page.getByRole('button', { name: /Adicionar fotos|Limite atingido/ }).click()
    const escolha = await seletor
    await escolha.setFiles(arquivos)
  }).toPass({ timeout: 30_000 })
}

/**
 * Clica e confere o efeito, repetindo se nada acontecer.
 *
 * Entre o HTML chegar e o React assumir a página existe uma janela em que o
 * botão já está visível e clicável, mas o manipulador ainda não está ligado —
 * o clique simplesmente não faz nada. O Playwright considera o elemento
 * "acionável" e segue em frente, e o teste falha por um motivo que não é o
 * comportamento do produto.
 *
 * Repetir até o efeito aparecer resolve sem esconder falha de verdade: se o
 * botão estiver realmente quebrado, o tempo se esgota e o teste falha.
 */
export async function clicarAteVer(alvo: Locator, esperado: Locator) {
  await expect(async () => {
    await alvo.click({ timeout: 3_000 })
    await expect(esperado).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 30_000, intervals: [300, 800, 1500] })
}

/** Variante para quando o efeito esperado é uma navegação. */
export async function clicarAteNavegar(alvo: Locator, page: Page, destino: RegExp) {
  await expect(async () => {
    await alvo.click({ timeout: 3_000 })
    await expect(page).toHaveURL(destino, { timeout: 3_000 })
  }).toPass({ timeout: 30_000, intervals: [300, 800, 1500] })
}

/**
 * Espera o React assumir o controle de um elemento.
 *
 * Usado quando repetir o clique não serve: marcar uma caixa já marcada é uma
 * operação sem efeito, então não dá para tentar de novo. A sonda é o conjunto
 * de propriedades `__react*` que o React grava no nó do DOM ao hidratar.
 *
 * Isto é uma limitação do teste, não do produto: o painel de filtros é um
 * <form method="get"> de verdade, e sem JavaScript o botão "Aplicar filtros"
 * navega igual. O envio automático ao marcar é a melhoria progressiva.
 */
export async function aguardarHidratacao(alvo: Locator) {
  await expect
    .poll(
      () => alvo.evaluate((el) => Object.keys(el).some((chave) => chave.startsWith('__react'))),
      { timeout: 30_000, intervals: [100, 250, 500] },
    )
    .toBe(true)
}
