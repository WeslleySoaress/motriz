'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import {
  loginAction,
  signupAction,
  requestResetAction,
  resetPasswordAction,
} from '@/server/actions/auth'
import { Field, FormError, FormSuccess, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'

/**
 * Formulários de conta.
 *
 * Todos seguem o mesmo padrão: `useActionState` chama a server action, que é
 * quem valida de fato. O schema Zod do servidor é a autoridade; aqui usamos
 * apenas `required`/`type` para o navegador dar o primeiro retorno.
 *
 * As mensagens de erro são propositalmente genéricas em login e recuperação:
 * dizer "este e-mail não existe" entregaria quais endereços têm conta aqui.
 */

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, { ok: false })

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {next && <input type="hidden" name="proximo" value={next} />}

      <FormError>{state.message}</FormError>

      <Field id="login-email" label="E-mail" error={state.errors?.email} required>
        {(props) => (
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="voce@exemplo.com"
            {...props}
          />
        )}
      </Field>

      <Field id="login-senha" label="Senha" error={state.errors?.password} required>
        {(props) => (
          <Input name="password" type="password" autoComplete="current-password" required {...props} />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>

      <div className="flex flex-col gap-2 text-sm">
        <Link href="/recuperar-senha" className="link-sublinhado text-fg-muted hover:text-fg">
          Esqueci minha senha
        </Link>
        <p className="text-fg-muted">
          Ainda não tem conta?{' '}
          <Link
            href={next ? `/criar-conta?proximo=${encodeURIComponent(next)}` : '/criar-conta'}
            className="link-sublinhado font-medium text-accent"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </form>
  )
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, { ok: false })

  if (state.ok && state.message === 'verificacao-enviada') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface-2 p-8 text-center">
        <MailCheck size={32} aria-hidden="true" className="text-accent" />
        <h2 className="text-lg font-semibold">Confira seu e-mail</h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          Se o endereço informado ainda não tinha conta, enviamos um link de confirmação. Ele vale
          por 24 horas.
        </p>
        <p className="text-xs leading-relaxed text-fg-subtle">
          Em ambiente de desenvolvimento, o e-mail é gravado em{' '}
          <code className="font-mono">log/emails.log</code> e impresso no terminal do servidor.
        </p>
        <Link
          href="/entrar"
          className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md border border-line-strong font-semibold text-fg"
        >
          Ir para o login
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError>{state.message}</FormError>

      <Field id="cadastro-nome" label="Nome completo" error={state.errors?.name} required>
        {(props) => (
          <Input name="name" autoComplete="name" required placeholder="Maria Silva" {...props} />
        )}
      </Field>

      <Field id="cadastro-email" label="E-mail" error={state.errors?.email} required>
        {(props) => (
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="voce@exemplo.com"
            {...props}
          />
        )}
      </Field>

      <Field
        id="cadastro-senha"
        label="Senha"
        hint="No mínimo 10 caracteres. Use uma senha que você não use em outro serviço."
        error={state.errors?.password}
        required
      >
        {(props) => (
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            {...props}
          />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Criando conta…' : 'Criar conta'}
      </Button>

      <p className="text-sm text-fg-muted">
        Já tem conta?{' '}
        <Link href="/entrar" className="link-sublinhado font-medium text-accent">
          Entrar
        </Link>
      </p>
    </form>
  )
}

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, { ok: false })

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface-2 p-8 text-center">
        <MailCheck size={32} aria-hidden="true" className="text-accent" />
        <h2 className="text-lg font-semibold">Pedido registrado</h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele vale
          por 1 hora e só pode ser usado uma vez.
        </p>
        <Link
          href="/entrar"
          className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md border border-line-strong font-semibold text-fg"
        >
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError>{state.message}</FormError>

      <Field
        id="recuperar-email"
        label="E-mail da conta"
        hint="Enviaremos um link para você criar uma nova senha."
        error={state.errors?.email}
        required
      >
        {(props) => (
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="voce@exemplo.com"
            {...props}
          />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar link de recuperação'}
      </Button>

      <Link href="/entrar" className="link-sublinhado text-sm text-fg-muted hover:text-fg">
        Voltar para o login
      </Link>
    </form>
  )
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, { ok: false })

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <FormSuccess>
          Senha redefinida. Por segurança, todas as sessões anteriores foram encerradas.
        </FormSuccess>
        <Link
          href="/entrar"
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-accent-solid font-semibold text-accent-solid-fg"
        >
          Entrar com a nova senha
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />

      <FormError>{state.message}</FormError>

      <Field
        id="nova-senha"
        label="Nova senha"
        hint="No mínimo 10 caracteres."
        error={state.errors?.password}
        required
      >
        {(props) => (
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            {...props}
          />
        )}
      </Field>

      <Field id="confirmar-senha" label="Repita a nova senha" error={state.errors?.confirm} required>
        {(props) => (
          <Input name="confirm" type="password" autoComplete="new-password" required {...props} />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  )
}
