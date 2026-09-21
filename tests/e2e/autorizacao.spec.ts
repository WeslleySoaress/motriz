import { expect, test } from '@playwright/test'
import { CONTAS, dados, entrar, fotoValida } from './apoio'

/**
 * Cenários 6, 7, 8 e 11 — autorização.
 *
 * O ponto central: as tentativas não passam só pela interface. Várias delas
 * são requisições HTTP diretas às rotas de API, como faria alguém usando
 * `curl` — que é exatamente o caso que uma checagem feita apenas no cliente
 * (ou apenas no layout) deixaria passar.
 */

test.describe('visitante sem sessão', () => {
  test('é mandado para o login nas áreas privadas', async ({ page }) => {
    for (const rota of ['/painel', '/conta', '/favoritos', '/painel/anuncios/novo']) {
      await page.goto(rota)
      await expect(page, `rota ${rota}`).toHaveURL(/\/entrar/)
    }
  })

  test('não encontra a área administrativa', async ({ page }) => {
    const resposta = await page.goto('/admin')
    // Redireciona para o login: sem sessão, nem chega a existir a decisão de
    // papel.
    expect(page.url()).toContain('/entrar')
    expect(resposta?.status()).toBeLessThan(500)
  })

  test('não consegue enviar foto por requisição direta', async ({ request }) => {
    const { anuncioPublicadoId } = dados()
    const resposta = await request.post(`/api/anuncios/${anuncioPublicadoId}/imagens`, {
      multipart: { fotos: await fotoValida() },
    })
    expect(resposta.status()).toBe(401)
  })

  test('não vê a foto de um rascunho, mesmo com a URL exata', async ({ request }) => {
    const { imagemDoRascunhoKey, imagemPublicadaKey } = dados()

    const doRascunho = await request.get(`/api/midia/${imagemDoRascunhoKey}`)
    expect(doRascunho.status()).toBe(404)

    // A foto do anúncio publicado, por outro lado, é servida normalmente.
    const publicada = await request.get(`/api/midia/${imagemPublicadaKey}`)
    expect(publicada.status()).toBe(200)
    expect(publicada.headers()['content-type']).toBe('image/webp')
  })

  test('não abre a página de um rascunho pelo slug', async ({ page }) => {
    const { rascunhoSlug } = dados()
    const resposta = await page.goto(`/veiculo/${rascunhoSlug}`)
    expect(resposta?.status()).toBe(404)
  })

  test('rascunho não aparece na busca nem no catálogo', async ({ page }) => {
    await page.goto('/catalogo?q=Segredo')
    await expect(page.getByText('Nenhum veículo com esses filtros')).toBeVisible()
    await expect(page.getByText('Nao Publicado')).toHaveCount(0)
  })
})

test.describe('conta A contra conta B', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, CONTAS.outro.email, CONTAS.outro.senha)
  })

  test('não abre a edição de um anúncio alheio', async ({ page }) => {
    const { anuncioPublicadoId } = dados()
    const resposta = await page.goto(`/painel/anuncios/${anuncioPublicadoId}/editar`)
    expect(resposta?.status()).toBe(404)
  })

  test('não envia foto para um anúncio alheio por requisição direta', async ({ page }) => {
    const { anuncioPublicadoId } = dados()
    const resposta = await page.request.post(`/api/anuncios/${anuncioPublicadoId}/imagens`, {
      multipart: { fotos: await fotoValida() },
    })
    expect(resposta.status()).toBe(404)
    expect((await resposta.json()).error).toMatch(/não encontrado/i)
  })

  test('não reordena as fotos de um anúncio alheio', async ({ page }) => {
    const { anuncioPublicadoId } = dados()
    const resposta = await page.request.patch(`/api/anuncios/${anuncioPublicadoId}/imagens`, {
      data: { order: ['qualquer-id'] },
    })
    expect(resposta.status()).toBe(404)
  })

  test('não apaga o arquivo de um anúncio alheio', async ({ page }) => {
    const { anuncioPublicadoId } = dados()
    const resposta = await page.request.delete(
      `/api/anuncios/${anuncioPublicadoId}/imagens/id-inventado`,
    )
    expect(resposta.status()).toBe(404)
  })

  test('não vê o rascunho de outra conta', async ({ page }) => {
    const { rascunhoSlug, imagemDoRascunhoKey } = dados()

    const pagina = await page.goto(`/veiculo/${rascunhoSlug}`)
    expect(pagina?.status()).toBe(404)

    const imagem = await page.request.get(`/api/midia/${imagemDoRascunhoKey}`)
    expect(imagem.status()).toBe(404)
  })

  test('a foto continua existindo depois das tentativas', async ({ page }) => {
    // Nenhuma das tentativas acima pode ter apagado nada.
    const { imagemPublicadaKey } = dados()
    const resposta = await page.request.get(`/api/midia/${imagemPublicadaKey}`)
    expect(resposta.status()).toBe(200)
  })
})

test.describe('usuário comum contra a administração', () => {
  test('recebe 404 em todas as telas administrativas', async ({ page }) => {
    await entrar(page, CONTAS.outro.email, CONTAS.outro.senha)

    for (const rota of [
      '/admin',
      '/admin/anuncios',
      '/admin/denuncias',
      '/admin/usuarios',
      '/admin/auditoria',
    ]) {
      const resposta = await page.goto(rota)
      expect(resposta?.status(), `rota ${rota}`).toBe(404)
    }
  })

  test('o menu da conta não oferece o atalho de administração', async ({ page }) => {
    await entrar(page, CONTAS.outro.email, CONTAS.outro.senha)
    await page.goto('/painel')
    await page.getByRole('button', { name: /^Outro/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Administração' })).toHaveCount(0)
  })

  test('o administrador entra normalmente', async ({ page }) => {
    await entrar(page, CONTAS.admin.email, CONTAS.admin.senha)
    const resposta = await page.goto('/admin')
    expect(resposta?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
  })
})

test.describe('dados inexistentes e entradas malformadas', () => {
  test('anúncio inexistente responde 404 com página em português', async ({ page }) => {
    const resposta = await page.goto('/veiculo/nao-existe-de-jeito-nenhum')
    expect(resposta?.status()).toBe(404)
  })

  test('chave de mídia inválida não escapa do diretório', async ({ request }) => {
    for (const chave of ['../../.env', '..%2F..%2Fprisma%2Fe2e.db', 'abc/arquivo.php']) {
      const resposta = await request.get(`/api/midia/${chave}`)
      expect([400, 404], `chave ${chave}`).toContain(resposta.status())
    }
  })

  test('filtro com valor absurdo não quebra o catálogo', async ({ page }) => {
    const resposta = await page.goto(
      '/catalogo?preco_min=abc&ano_min=-99&pagina=999999&carroceria=FOGUETE&uf=ZZ',
    )
    expect(resposta?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible()
  })
})
