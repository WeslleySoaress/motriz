import { expect, test } from '@playwright/test'
import { clicarAteVer, dados } from './apoio'

/**
 * Inspeção em largura de celular (projeto "celular" do playwright.config).
 *
 * Verifica o que costuma quebrar primeiro no mobile: rolagem horizontal
 * indevida, alvos de toque pequenos demais e controles que só funcionam com
 * mouse.
 */

const ROTAS = ['/', '/catalogo', '/entrar', '/criar-conta']

test.describe('largura de celular', () => {
  for (const rota of ROTAS) {
    test(`não tem rolagem horizontal em ${rota}`, async ({ page }) => {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))

      // Uma folga de 1px cobre arredondamento de subpixel.
      expect(scrollWidth, `rolagem horizontal em ${rota}`).toBeLessThanOrEqual(clientWidth + 1)
    })
  }

  test('a página do veículo também cabe na tela', async ({ page }) => {
    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)
    await page.waitForLoadState('networkidle')

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('o menu abre, navega e fecha', async ({ page }) => {
    await page.goto('/')
    const painel = page.getByRole('dialog', { name: 'Menu principal' })
    await clicarAteVer(page.getByRole('button', { name: 'Abrir menu' }), painel)

    await painel.getByRole('link', { name: 'Catálogo', exact: true }).click()
    await expect(page).toHaveURL(/\/catalogo/)
    await expect(painel).toHaveCount(0)
  })

  test('o menu fecha com a tecla Esc', async ({ page }) => {
    await page.goto('/')
    await clicarAteVer(
      page.getByRole('button', { name: 'Abrir menu' }),
      page.getByRole('dialog', { name: 'Menu principal' }),
    )

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Menu principal' })).toHaveCount(0)
  })

  test('os filtros abrem em painel próprio e aplicam', async ({ page }) => {
    await page.goto('/catalogo')
    const painel = page.getByRole('dialog', { name: 'Filtros do catálogo' })
    await clicarAteVer(page.getByRole('button', { name: 'Filtrar e ordenar' }), painel)

    await painel.getByLabel('Toyota').check()
    await painel.getByRole('button', { name: /Ver \d+ resultados?/ }).click()

    await expect(page).toHaveURL(/marca=Toyota/)
  })

  test('os alvos de toque principais têm ao menos 44 px de altura', async ({ page }) => {
    await page.goto('/catalogo')

    const alvos = [
      page.getByRole('button', { name: 'Abrir menu' }),
      page.getByRole('button', { name: 'Filtrar e ordenar' }),
    ]

    for (const alvo of alvos) {
      const caixa = await alvo.boundingBox()
      expect(caixa, 'elemento sem caixa').not.toBeNull()
      expect(caixa!.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('o campo de busca funciona no teclado do celular', async ({ page }) => {
    await page.goto('/')
    const campo = page.locator('#busca-inicial')
    await campo.fill('Hilux')
    await campo.press('Enter')

    await expect(page).toHaveURL(/\/catalogo\?q=Hilux/)
    await expect(page.getByRole('article').filter({ hasText: 'Hilux' })).toBeVisible()
  })
})
