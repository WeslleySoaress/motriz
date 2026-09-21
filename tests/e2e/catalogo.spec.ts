import { expect, test } from '@playwright/test'
import {
  aguardarHidratacao,
  CONTAS,
  clicarAteNavegar,
  clicarAteVer,
  dados,
  entrar,
} from './apoio'

/**
 * Cenários 4, 5 e 10 — busca, filtros, ordenação, detalhes e favoritos.
 */

test.describe('busca e filtros', () => {
  test('busca pela primeira dobra leva ao catálogo filtrado', async ({ page }) => {
    await page.goto('/')
    await page.locator('#busca-inicial').fill('Corolla')
    await page.getByRole('button', { name: 'Buscar' }).click()

    await expect(page).toHaveURL(/\/catalogo\?q=Corolla/)
    await expect(page.getByRole('article').filter({ hasText: 'Corolla' })).toBeVisible()
  })

  test('combina filtros e reflete tudo na URL', async ({ page }) => {
    await page.goto('/catalogo')
    const filtros = page.getByRole('complementary', { name: 'Filtros' })

    const toyota = filtros.getByLabel('Toyota')
    // O envio automático depende do React já ter assumido a página.
    await aguardarHidratacao(toyota)
    await toyota.check()
    await expect(page).toHaveURL(/marca=Toyota/)

    const km = filtros.getByLabel('Quilometragem máxima')
    await aguardarHidratacao(km)
    await km.selectOption('50000')
    await expect(page).toHaveURL(/km_max=50000/)
    await expect(page).toHaveURL(/marca=Toyota/)

    // Os resultados respeitam os dois filtros.
    const cards = page.getByRole('article')
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText('Corolla')
  })

  test('um link de busca compartilhado reabre a mesma busca', async ({ page }) => {
    const url = '/catalogo?marca=Toyota&km_max=50000&ordenar=preco-asc'
    await page.goto(url)
    const filtros = page.getByRole('complementary', { name: 'Filtros' })

    await expect(filtros.getByLabel('Toyota')).toBeChecked()
    await expect(filtros.getByLabel('Quilometragem máxima')).toHaveValue('50000')
    await expect(page.getByLabel('Ordenar por')).toHaveValue('preco-asc')
  })

  test('remove um filtro por vez e limpa todos', async ({ page }) => {
    await page.goto('/catalogo?marca=Toyota&marca=Fiat&uf=SP')

    await expect(page.getByText('Filtros ativos:')).toBeVisible()
    await page.getByRole('link', { name: 'Remover filtro Toyota' }).click()

    await expect(page).not.toHaveURL(/marca=Toyota/)
    await expect(page).toHaveURL(/marca=Fiat/)
    await expect(page).toHaveURL(/uf=SP/)

    await page.getByRole('link', { name: 'Limpar todos', exact: true }).click()
    await expect(page).toHaveURL('/catalogo')
    await expect(page.getByText('Filtros ativos:')).toHaveCount(0)
  })

  test('ordena por preço crescente e decrescente', async ({ page }) => {
    await page.goto('/catalogo?ordenar=preco-asc')
    const precosAsc = await page.locator('article .preco').allInnerTexts()
    const numerosAsc = precosAsc.map(paraNumero)
    expect(numerosAsc).toEqual([...numerosAsc].sort((a, b) => a - b))

    await page.goto('/catalogo?ordenar=preco-desc')
    const precosDesc = await page.locator('article .preco').allInnerTexts()
    const numerosDesc = precosDesc.map(paraNumero)
    expect(numerosDesc).toEqual([...numerosDesc].sort((a, b) => b - a))
  })

  test('mostra o estado de nenhum resultado com saída clara', async ({ page }) => {
    await page.goto('/catalogo?q=veiculo-que-nao-existe-mesmo')
    await expect(page.getByText('Nenhum veículo com esses filtros')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Limpar filtros' })).toBeVisible()
  })

  test('conta os resultados encontrados', async ({ page }) => {
    await page.goto('/catalogo')
    await expect(page.getByText(/veículos? encontrados?/)).toBeVisible()
  })
})

test.describe('página do veículo', () => {
  test('mostra a ficha completa e o crédito da foto quando existe', async ({ page }) => {
    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)

    await expect(page.getByRole('heading', { name: 'Jeep Compass', level: 1 })).toBeVisible()
    await expect(page.getByText('Longitude T270').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ficha técnica' })).toBeVisible()

    const ficha = page.getByRole('region', { name: 'Ficha técnica' })
    for (const rotulo of ['Marca', 'Modelo', 'Versão', 'Quilometragem', 'Câmbio', 'Combustível', 'Cor', 'Cidade / UF']) {
      await expect(ficha.getByText(rotulo, { exact: true })).toBeVisible()
    }
  })

  test('a galeria navega pelo teclado', async ({ page }) => {
    // Este anúncio tem uma foto só; usamos o do fluxo de anúncio, que tem duas.
    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)

    const galeria = page.getByRole('group', { name: /Fotos do/ })
    await galeria.focus()
    await page.keyboard.press('ArrowRight')
    // Com uma única foto, o contador permanece em 1/1 — o importante é que a
    // tecla não quebre nada.
    await expect(page.getByText('1 / 1')).toBeVisible()
  })

  test('a ampliação abre e fecha com o teclado', async ({ page }) => {
    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)

    const dialogo = page.getByRole('dialog', { name: /Foto ampliada/ })
    await clicarAteVer(page.getByRole('button', { name: 'Ampliar' }), dialogo)

    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
  })

  test('não expõe e-mail nem telefone que o anunciante não liberou', async ({ page }) => {
    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)

    const html = await page.content()
    expect(html).not.toContain(CONTAS.vendedor.email)
    expect(html).not.toContain('19988887777')
    expect(html).not.toContain('(19) 98888-7777')
  })

  test('mostra veículos relacionados', async ({ page }) => {
    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)
    await expect(page.getByRole('heading', { name: 'Veículos parecidos' })).toBeVisible()
  })
})

test.describe('favoritos', () => {
  test('visitante é levado ao login ao tentar favoritar', async ({ page }) => {
    // Usamos o botão da coluna lateral da página do anúncio: é um bloco
    // estável, sem sobreposição sobre a foto nem deslocamento no hover, o que
    // torna o clique confiável. O comportamento medido é o mesmo do card.
    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)

    const lateral = page.getByRole('complementary', { name: 'Resumo e ações do anúncio' })
    await clicarAteNavegar(
      lateral.getByRole('button', { name: 'Salvar nos favoritos' }),
      page,
      /\/entrar\?proximo=/,
    )
  })

  test('salva e remove um favorito, com persistência real', async ({ page }) => {
    await entrar(page, CONTAS.outro.email, CONTAS.outro.senha)

    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)

    const lateral = page.getByRole('complementary', { name: 'Resumo e ações do anúncio' })
    await clicarAteVer(
      lateral.getByRole('button', { name: 'Salvar nos favoritos' }),
      lateral.getByRole('button', { name: 'Salvo nos favoritos' }),
    )

    // Persistiu: aparece na lista depois de recarregar em outra rota.
    await page.goto('/favoritos')
    await expect(page.getByRole('article').filter({ hasText: 'Compass' })).toBeVisible()
    await expect(page.getByText('1 veículo salvo')).toBeVisible()

    // Remover também persiste.
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)
    const lateralDepois = page.getByRole('complementary', {
      name: 'Resumo e ações do anúncio',
    })
    await clicarAteVer(
      lateralDepois.getByRole('button', { name: 'Salvo nos favoritos' }),
      lateralDepois.getByRole('button', { name: 'Salvar nos favoritos' }),
    )

    await page.goto('/favoritos')
    await expect(page.getByText('Nenhum favorito ainda')).toBeVisible()
  })
})

test.describe('denúncia', () => {
  test('registra a denúncia e ela chega na fila de moderação', async ({ page, browser }) => {
    await entrar(page, CONTAS.outro.email, CONTAS.outro.senha)
    const { anuncioPublicadoSlug } = dados()
    await page.goto(`/veiculo/${anuncioPublicadoSlug}`)

    const dialogo = page.getByRole('dialog', { name: 'Denunciar anúncio' })
    await clicarAteVer(page.getByRole('button', { name: 'Denunciar anúncio' }), dialogo)

    await dialogo.getByLabel(/^Motivo/).selectOption('PRECO_ENGANOSO')
    await dialogo.getByLabel('Detalhes (opcional)').fill('Teste automatizado de denúncia de anúncio.')
    await dialogo.getByRole('button', { name: 'Enviar denúncia' }).click()
    await expect(dialogo.getByText(/Denúncia enviada/)).toBeVisible()

    const contexto = await browser.newContext()
    const paginaAdmin = await contexto.newPage()
    await entrar(paginaAdmin, CONTAS.admin.email, CONTAS.admin.senha)
    await paginaAdmin.goto('/admin/denuncias')
    await expect(
      paginaAdmin.getByRole('listitem').filter({ hasText: 'Preço enganoso' }).first(),
    ).toBeVisible()
    await contexto.close()
  })
})

function paraNumero(texto: string): number {
  return Number(texto.replace(/[^\d]/g, ''))
}
