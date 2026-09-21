import { expect, test, type Page } from '@playwright/test'
import { CONTAS, clicarAteVer, enviarFotos, entrar, fotoValida } from './apoio'

/**
 * Cenários 2, 3, 9 e 11 — ciclo de vida do anúncio.
 *
 * Cobre o caminho completo com a moderação LIGADA: rascunho → fotos → ficha →
 * envio para análise → aprovação pela administração → catálogo → pausar →
 * vendido. Inclui também a recusa de uploads inválidos.
 */

test.describe.configure({ mode: 'serial' })

let urlEdicao = ''
let slugPublico = ''

const veiculo = {
  marca: 'Renault',
  modelo: 'Duster',
  versao: 'Iconic 1.3 TCe',
  ano: '2022',
  anoModelo: '2023',
  preco: '124.900',
  km: '31500',
  cor: 'Verde',
  cidade: 'Sorocaba',
}

test('cria rascunho, envia fotos e preenche a ficha', async ({ page }) => {
  await entrar(page, CONTAS.vendedor.email, CONTAS.vendedor.senha)

  await page.goto('/painel/anuncios/novo')
  await page.getByRole('button', { name: 'Criar rascunho e começar' }).click()
  await expect(page).toHaveURL(/\/painel\/anuncios\/[^/]+\/editar/)
  urlEdicao = page.url()

  // ── Upload de fotos ──────────────────────────────────────────────────
  await enviarFotos(page, [
    await fotoValida('frente.jpg'),
    await fotoValida('lateral.jpg', 1400, 1050),
  ])
  // Exatamente uma foto marcada como capa.
  await expect(page.getByText('Capa', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Capa', { exact: true })).toHaveCount(1)
  await expect(page.getByText('2 de 12 enviadas')).toBeVisible()

  // ── Ficha ────────────────────────────────────────────────────────────
  await page.getByLabel(/^Marca/).fill(veiculo.marca)
  await page.getByLabel(/^Modelo/).fill(veiculo.modelo)
  await page.getByLabel(/^Versão/).fill(veiculo.versao)
  await page.getByLabel(/^Ano de fabricação/).fill(veiculo.ano)
  await page.getByLabel(/^Ano do modelo/).fill(veiculo.anoModelo)
  await page.getByLabel(/^Preço/).fill(veiculo.preco)
  await page.getByLabel(/^Quilometragem/).fill(veiculo.km)
  await page.getByRole('combobox', { name: 'Combustível' }).selectOption('FLEX')
  await page.getByRole('combobox', { name: 'Câmbio' }).selectOption('AUTOMATICO')
  await page.getByRole('combobox', { name: 'Carroceria' }).selectOption('SUV')
  await page.getByLabel(/^Cor/).fill(veiculo.cor)
  await page.getByLabel(/^Cidade/).fill(veiculo.cidade)
  await page.getByRole('combobox', { name: 'UF' }).selectOption('SP')
  await page
    .getByLabel('Descrição')
    .fill(
      'SUV compacto de teste automatizado, com revisões em dia, pneus com boa vida útil e documentação sem pendências.',
    )
  await page.getByLabel('Ar-condicionado', { exact: true }).check()

  await page.getByRole('button', { name: 'Salvar rascunho' }).click()
  await expect(page.getByText('Rascunho salvo.')).toBeVisible()

  // O rascunho não aparece publicamente.
  await page.goto('/catalogo?q=Duster')
  await expect(page.getByText('Nenhum veículo com esses filtros')).toBeVisible()
})

test('recusa upload inválido e acima do limite', async ({ page }) => {
  await entrar(page, CONTAS.vendedor.email, CONTAS.vendedor.senha)
  await page.goto(urlEdicao)

  // O Next mantém um role="alert" próprio para anunciar troca de rota, então
  // olhamos só os alertas da região de fotos.
  const avisoFotos = page.getByRole('region', { name: 'Fotos do veículo' }).getByRole('alert')

  // Arquivo que não é imagem, com nome .jpg.
  await enviarFotos(page, [{
    name: 'malicioso.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('isto nao e uma imagem, e apenas texto disfarcado'),
  }])
  await expect(avisoFotos).toContainText(/Não foi possível ler|Formato não suportado/)

  // SVG é recusado mesmo com o MIME "correto".
  await enviarFotos(page, [{
    name: 'vetor.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><script>alert(1)</script></svg>',
    ),
  }])
  await expect(avisoFotos).toContainText(/Formato não suportado|Não foi possível ler/)

  // Imagem válida, porém pequena demais para um anúncio.
  await enviarFotos(page, [await fotoValida('minúscula.jpg', 200, 150)])
  await expect(avisoFotos).toContainText(/pelo menos 480/)

  // Arquivo acima do limite de 8 MB.
  await enviarFotos(page, [{
    name: 'enorme.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(9 * 1024 * 1024, 0x42),
  }])
  await expect(avisoFotos).toContainText(/8 MB/)

  // Nenhuma das tentativas entrou na galeria.
  await expect(page.getByText('2 de 12 enviadas')).toBeVisible()
})

test('publica, passa por moderação e aparece no catálogo', async ({ page, browser }) => {
  await entrar(page, CONTAS.vendedor.email, CONTAS.vendedor.senha)
  await page.goto(urlEdicao)

  await clicarAteVer(
    page.getByRole('button', { name: 'Publicar' }).first(),
    page.getByText(/enviado para análise/),
  )

  // Em análise, continua fora do catálogo.
  await page.goto('/catalogo?q=Duster')
  await expect(page.getByText('Nenhum veículo com esses filtros')).toBeVisible()

  // ── Aprovação pela administração, em outra sessão ────────────────────
  const contextoAdmin = await browser.newContext()
  const paginaAdmin = await contextoAdmin.newPage()
  await entrar(paginaAdmin, CONTAS.admin.email, CONTAS.admin.senha)

  await paginaAdmin.goto('/admin/anuncios?situacao=PENDING')
  const cartao = paginaAdmin.getByRole('listitem').filter({ hasText: 'Duster' })
  await expect(cartao).toBeVisible()
  await cartao.getByRole('button', { name: 'Aprovar e publicar' }).click()
  // Aprovado, o anúncio sai da fila de análise.
  await expect(cartao).toHaveCount(0)

  // A decisão ficou registrada na auditoria.
  await paginaAdmin.goto('/admin/auditoria')
  await expect(paginaAdmin.getByRole('cell', { name: 'Anúncio aprovado' }).first()).toBeVisible()
  await contextoAdmin.close()

  // ── Agora está no catálogo ───────────────────────────────────────────
  await page.goto('/catalogo?q=Duster')
  const card = page.getByRole('article').filter({ hasText: 'Duster' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('R$ 124.900')

  await card.getByRole('link', { name: /Renault Duster/ }).click()
  await expect(page).toHaveURL(/\/veiculo\//)
  slugPublico = new URL(page.url()).pathname.replace('/veiculo/', '')

  await expect(page.getByRole('heading', { name: 'Renault Duster', level: 1 })).toBeVisible()
  await expect(page.getByText('Iconic 1.3 TCe').first()).toBeVisible()
  await expect(page.getByText('31.500 km').first()).toBeVisible()
  await expect(page.getByText('2022/2023').first()).toBeVisible()
})

/** Linha do anúncio no painel do anunciante. */
function linhaDoDuster(page: Page) {
  return page.getByRole('listitem').filter({ hasText: 'Duster' })
}

test('edita, marca como vendido, reativa e pausa', async ({ page, browser }) => {
  await entrar(page, CONTAS.vendedor.email, CONTAS.vendedor.senha)

  // ── Editar o preço de um anúncio publicado ───────────────────────────
  await page.goto(urlEdicao)
  await page.getByLabel(/^Preço/).fill('119.900')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Anúncio atualizado.')).toBeVisible()

  await page.goto(`/veiculo/${slugPublico}`)
  await expect(page.getByText('R$ 119.900').first()).toBeVisible()

  // ── Marcar como vendido: continua visível, agora com o selo ──────────
  await page.goto('/painel')
  await linhaDoDuster(page).getByRole('button', { name: 'Marcar como vendido' }).click()
  await expect(linhaDoDuster(page).getByText(/marcado como vendido/)).toBeVisible()

  await page.goto('/catalogo?q=Duster')
  const cardVendido = page.getByRole('article').filter({ hasText: 'Duster' })
  await expect(cardVendido).toBeVisible()
  await expect(cardVendido.getByText('Vendido')).toBeVisible()

  // ── Reativar: volta para a análise e sai do catálogo ─────────────────
  await page.goto('/painel')
  await linhaDoDuster(page).getByRole('button', { name: 'Reativar' }).click()
  await expect(linhaDoDuster(page).getByText(/enviado para análise/)).toBeVisible()

  await page.goto('/catalogo?q=Duster')
  await expect(page.getByText('Nenhum veículo com esses filtros')).toBeVisible()

  // ── A administração aprova de novo ───────────────────────────────────
  const contextoAdmin = await browser.newContext()
  const paginaAdmin = await contextoAdmin.newPage()
  await entrar(paginaAdmin, CONTAS.admin.email, CONTAS.admin.senha)
  await paginaAdmin.goto('/admin/anuncios?situacao=PENDING')
  const cartao = paginaAdmin.getByRole('listitem').filter({ hasText: 'Duster' })
  await cartao.getByRole('button', { name: 'Aprovar e publicar' }).click()
  // Aprovado, o anúncio sai da fila de análise.
  await expect(cartao).toHaveCount(0)
  await contextoAdmin.close()

  await page.goto('/catalogo?q=Duster')
  await expect(page.getByRole('article').filter({ hasText: 'Duster' })).toBeVisible()

  // ── Pausar: sai do catálogo ──────────────────────────────────────────
  await page.goto('/painel')
  await linhaDoDuster(page).getByRole('button', { name: 'Pausar' }).click()
  await expect(linhaDoDuster(page).getByText(/Anúncio pausado/)).toBeVisible()

  await page.goto('/catalogo?q=Duster')
  await expect(page.getByText('Nenhum veículo com esses filtros')).toBeVisible()
})

test('anúncio pausado não vaza pela URL direta', async ({ page, context }) => {
  await entrar(page, CONTAS.vendedor.email, CONTAS.vendedor.senha)
  // O teste anterior deixou o anúncio pausado.
  await page.goto('/painel')
  await expect(linhaDoDuster(page).getByRole('button', { name: 'Reativar' })).toBeVisible()

  // O dono ainda enxerga, como pré-visualização.
  await page.goto(`/veiculo/${slugPublico}`)
  await expect(page.getByText(/não está público/)).toBeVisible()

  // Um visitante sem sessão recebe 404.
  await context.clearCookies()
  const resposta = await page.goto(`/veiculo/${slugPublico}`)
  expect(resposta?.status()).toBe(404)
})
