import { test, type Page } from '@playwright/test'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

/**
 * Capturas das telas principais para a documentação.
 *
 * Não valida nada — navega, espera as imagens carregarem e fotografa. Roda
 * contra o banco de desenvolvimento, que tem os anúncios de demonstração com
 * as fotografias reais.
 *
 * Saída: docs/capturas/<projeto>/<nome>.png
 */

const CONTA = {
  vendedor: { email: 'ana.ribeiro@demo.motriz.local', senha: 'Motriz!Demo2024' },
  admin: { email: 'admin@motriz.local', senha: 'Motriz!Admin2024' },
}

function destino(projeto: string, nome: string) {
  const dir = path.join(process.cwd(), 'docs', 'capturas', projeto)
  mkdirSync(dir, { recursive: true })
  return path.join(dir, `${nome}.png`)
}

/**
 * Espera a página assentar antes do clique do obturador.
 *
 * As fontes têm espera própria. Para as imagens, esperamos apenas as que estão
 * na área visível — uma imagem com `loading="lazy"` fora da tela pode nunca
 * carregar, e esperar por ela travaria a captura. Há um teto de tempo em volta
 * de tudo, para a captura nunca ser o motivo de uma falha.
 */
async function pronta(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {})

  await page
    .evaluate(async () => {
      const limite = new Promise((resolve) => setTimeout(resolve, 5_000))

      const tudo = (async () => {
        await document.fonts.ready
        const naTela = Array.from(document.images).filter((img) => {
          const caixa = img.getBoundingClientRect()
          return caixa.top < window.innerHeight && caixa.bottom > 0
        })
        await Promise.all(
          naTela
            .filter((img) => !img.complete)
            .map(
              (img) =>
                new Promise((resolve) => {
                  img.addEventListener('load', resolve, { once: true })
                  img.addEventListener('error', resolve, { once: true })
                }),
            ),
        )
      })()

      await Promise.race([tudo, limite])
    })
    .catch(() => {})

  // Deixa as transições de entrada assentarem.
  await page.waitForTimeout(400)
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/entrar')
  await page.getByLabel(/^E-mail/).fill(email)
  await page.getByLabel(/^Senha/).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'), { timeout: 30_000 })
}

test.describe('capturas', () => {
  test('telas públicas', async ({ page }, info) => {
    const projeto = info.project.name

    await page.goto('/')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '01-inicio'), fullPage: false })
    await page.screenshot({ path: destino(projeto, '01-inicio-completa'), fullPage: true })

    await page.goto('/catalogo')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '02-catalogo') })

    await page.goto('/catalogo?carroceria=SUV&ordenar=preco-asc&preco_max=200000')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '03-catalogo-filtrado') })

    await page.goto('/catalogo?q=veiculo-inexistente-xyz')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '04-catalogo-sem-resultado') })

    // Primeiro anúncio do catálogo.
    await page.goto('/catalogo')
    await pronta(page)
    await page.getByRole('article').first().getByRole('link').first().click()
    await page.waitForURL(/\/veiculo\//)
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '05-veiculo') })
    await page.screenshot({ path: destino(projeto, '05-veiculo-completa'), fullPage: true })

    await page.getByRole('button', { name: 'Ampliar' }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: destino(projeto, '06-veiculo-foto-ampliada') })
    await page.keyboard.press('Escape')

    await page.goto('/sobre')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '07-sobre'), fullPage: true })

    await page.goto('/seguranca')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '08-seguranca'), fullPage: true })

    await page.goto('/entrar')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '09-entrar') })

    await page.goto('/pagina-que-nao-existe')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '10-nao-encontrada') })
  })

  test('filtros no celular', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'só faz sentido em largura de celular')

    await page.goto('/catalogo')
    await pronta(page)
    await page.getByRole('button', { name: 'Filtrar e ordenar' }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: destino(info.project.name, '11-filtros-celular') })
  })

  test('painel do anunciante', async ({ page }, info) => {
    const projeto = info.project.name

    await entrar(page, CONTA.vendedor.email, CONTA.vendedor.senha)

    await page.goto('/painel')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '12-painel'), fullPage: true })

    await page.goto('/favoritos')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '13-favoritos') })

    await page.goto('/conta')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '14-conta'), fullPage: true })

    // Edição do primeiro anúncio da lista.
    await page.goto('/painel')
    await pronta(page)
    const editar = page.getByRole('link', { name: 'Editar' }).first()
    if (await editar.count()) {
      await editar.click()
      await page.waitForURL(/\/editar/)
      await pronta(page)
      await page.screenshot({ path: destino(projeto, '15-editar-anuncio'), fullPage: true })
    }
  })

  test('administração', async ({ page }, info) => {
    const projeto = info.project.name

    await entrar(page, CONTA.admin.email, CONTA.admin.senha)

    await page.goto('/admin')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '16-admin-visao-geral'), fullPage: true })

    await page.goto('/admin/anuncios?situacao=PUBLISHED')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '17-admin-anuncios') })

    await page.goto('/admin/denuncias')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '18-admin-denuncias') })

    await page.goto('/admin/auditoria')
    await pronta(page)
    await page.screenshot({ path: destino(projeto, '19-admin-auditoria') })
  })
})
