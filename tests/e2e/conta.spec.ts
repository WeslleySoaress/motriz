import { expect, test } from '@playwright/test'
import { CONTAS, entrar, ultimoLinkDoEmail } from './apoio'

/**
 * Cenário 1 — criar conta, entrar, sair e recuperar acesso.
 *
 * A recuperação é verificada de ponta a ponta de verdade: o teste lê o link
 * gerado em log/emails.log (transporte "console"), abre esse link, define a
 * nova senha e confirma que a senha antiga deixou de funcionar.
 */

test.describe('conta', () => {
  const novo = {
    nome: 'Pessoa Teste',
    email: `novo.${Date.now()}@e2e.local`,
    senha: 'Senha!Nova#E2E2024',
  }

  test('cria conta, entra, sai e recupera o acesso', async ({ page }) => {
    // ── Cadastro ─────────────────────────────────────────────────────────
    await page.goto('/criar-conta')
    await page.getByLabel(/^Nome completo/).fill(novo.nome)
    await page.getByLabel(/^E-mail/).fill(novo.email)
    await page.getByLabel(/^Senha/).fill(novo.senha)
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible()

    // ── Confirmação de e-mail pelo link enviado ──────────────────────────
    const linkConfirmacao = ultimoLinkDoEmail('Confirme seu e-mail')
    expect(linkConfirmacao).toBeTruthy()
    await page.goto(linkConfirmacao!)
    await expect(page.getByRole('heading', { name: 'E-mail confirmado' })).toBeVisible()

    // ── Login ────────────────────────────────────────────────────────────
    await entrar(page, novo.email, novo.senha)
    await page.goto('/painel')
    await expect(page.getByRole('heading', { name: /Olá, Pessoa/ })).toBeVisible()

    // ── Logout ───────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /^Pessoa/ }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')

    // Sem sessão, a área privada volta a exigir login.
    await page.goto('/painel')
    await expect(page).toHaveURL(/\/entrar/)

    // ── Recuperação de senha ─────────────────────────────────────────────
    await page.goto('/recuperar-senha')
    await page.getByLabel(/^E-mail da conta/).fill(novo.email)
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
    await expect(page.getByRole('heading', { name: 'Pedido registrado' })).toBeVisible()

    const linkRedefinicao = ultimoLinkDoEmail('Redefinição de senha')
    expect(linkRedefinicao).toBeTruthy()

    const novaSenha = 'Outra!Senha#E2E2024'
    await page.goto(linkRedefinicao!)
    await page.getByLabel(/^Nova senha/).fill(novaSenha)
    await page.getByLabel(/^Repita a nova senha/).fill(novaSenha)
    await page.getByRole('button', { name: 'Salvar nova senha' }).click()
    await expect(page.getByText(/Senha redefinida/)).toBeVisible()

    // A senha antiga não vale mais.
    await page.goto('/entrar')
    await page.getByLabel(/^E-mail/).fill(novo.email)
    await page.getByLabel(/^Senha/).fill(novo.senha)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()

    // A nova senha funciona.
    await entrar(page, novo.email, novaSenha)
    await page.goto('/painel')
    await expect(page.getByRole('heading', { name: /Olá, Pessoa/ })).toBeVisible()
  })

  test('o mesmo link de redefinição não pode ser usado duas vezes', async ({ page }) => {
    await page.goto('/recuperar-senha')
    await page.getByLabel(/^E-mail da conta/).fill(CONTAS.outro.email)
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
    await expect(page.getByRole('heading', { name: 'Pedido registrado' })).toBeVisible()

    const link = ultimoLinkDoEmail('Redefinição de senha')!
    const senha = 'Reuso!Bloqueado#2024'

    await page.goto(link)
    await page.getByLabel(/^Nova senha/).fill(senha)
    await page.getByLabel(/^Repita a nova senha/).fill(senha)
    await page.getByRole('button', { name: 'Salvar nova senha' }).click()
    await expect(page.getByText(/Senha redefinida/)).toBeVisible()

    // Segunda tentativa com o mesmo token.
    await page.goto(link)
    await page.getByLabel(/^Nova senha/).fill('Terceira!Senha#2024')
    await page.getByLabel(/^Repita a nova senha/).fill('Terceira!Senha#2024')
    await page.getByRole('button', { name: 'Salvar nova senha' }).click()
    await expect(page.getByText(/expirou ou já foi usado/)).toBeVisible()
  })

  test('não revela se um e-mail está cadastrado', async ({ page }) => {
    // Endereço que com certeza não existe: mesma resposta do endereço real.
    await page.goto('/recuperar-senha')
    await page.getByLabel(/^E-mail da conta/).fill('ninguem-aqui-mesmo@e2e.local')
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
    await expect(page.getByRole('heading', { name: 'Pedido registrado' })).toBeVisible()

    // E o cadastro com e-mail já existente também não denuncia a conta.
    await page.goto('/criar-conta')
    await page.getByLabel(/^Nome completo/).fill('Tentativa Duplicada')
    await page.getByLabel(/^E-mail/).fill(CONTAS.vendedor.email)
    await page.getByLabel(/^Senha/).fill('Senha!Qualquer#2024')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible()
    await expect(page.getByText(/já (está cadastrado|existe|possui)/i)).toHaveCount(0)
  })

  test('barra dados inválidos no navegador e senha comum no servidor', async ({ page }) => {
    await page.goto('/criar-conta')
    await page.getByLabel(/^Nome completo/).fill('Teste Validacao')
    await page.getByLabel(/^E-mail/).fill('nao-e-email')
    await page.getByLabel(/^Senha/).fill('curta')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    // Primeira barreira: o próprio navegador recusa enviar. Continuamos no
    // formulário e nada foi criado.
    await expect(page).toHaveURL(/\/criar-conta/)
    await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toHaveCount(0)

    const emailValido = await page
      .getByLabel(/^E-mail/)
      .evaluate((campo) => (campo as HTMLInputElement).validity.valid)
    expect(emailValido).toBe(false)

    const senhaValida = await page
      .getByLabel(/^Senha/)
      .evaluate((campo) => (campo as HTMLInputElement).validity.valid)
    expect(senhaValida).toBe(false)

    // Segunda barreira: dados que passam pelo navegador e são recusados pelo
    // servidor. A senha tem tamanho suficiente, mas está na lista de senhas
    // notoriamente comuns.
    await page.getByLabel(/^E-mail/).fill(`valida.${Date.now()}@e2e.local`)
    await page.getByLabel(/^Senha/).fill('senha123456')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByText('Essa senha é muito comum. Escolha outra.')).toBeVisible()
  })
})
