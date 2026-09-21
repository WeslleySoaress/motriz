'use client'

import { useActionState, useState } from 'react'
import { MailCheck, ShieldAlert } from 'lucide-react'
import {
  changePasswordAction,
  deleteAccountAction,
  resendVerificationAction,
  updateProfileAction,
} from '@/server/actions/auth'
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { UFS } from '@/lib/enums'

export type ProfileData = {
  name: string
  email: string
  phone: string | null
  city: string | null
  state: string | null
  bio: string | null
  showPhone: boolean
  showEmail: boolean
  emailVerified: boolean
}

/**
 * Perfil e privacidade.
 *
 * As duas caixas de seleção no fim são o controle de privacidade do projeto:
 * por padrão vêm desmarcadas e, enquanto estiverem assim, nem o telefone nem o
 * e-mail aparecem em qualquer página pública.
 */
export function ProfileForm({ profile }: { profile: ProfileData }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, { ok: false })
  const [hasPhone, setHasPhone] = useState(Boolean(profile.phone))

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.ok ? <FormSuccess>{state.message}</FormSuccess> : <FormError>{state.message}</FormError>}

      <Field id="perfil-nome" label="Nome" error={state.errors?.name} required>
        {(props) => <Input name="name" defaultValue={profile.name} autoComplete="name" {...props} />}
      </Field>

      <Field
        id="perfil-email"
        label="E-mail"
        hint="Para alterar o e-mail da conta, fale com o suporte — a troca exige nova confirmação."
      >
        {(props) => <Input value={profile.email} disabled readOnly {...props} />}
      </Field>

      <Field
        id="perfil-telefone"
        label="Telefone"
        hint="Com DDD. Fica oculto até você liberar abaixo."
        error={state.errors?.phone}
      >
        {(props) => (
          <Input
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={profile.phone ?? ''}
            placeholder="(11) 98888-7777"
            onChange={(event) => setHasPhone(event.target.value.replace(/\D/g, '').length >= 10)}
            {...props}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <Field id="perfil-cidade" label="Cidade" error={state.errors?.city}>
          {(props) => (
            <Input name="city" defaultValue={profile.city ?? ''} autoComplete="address-level2" {...props} />
          )}
        </Field>

        <Field id="perfil-uf" label="UF" error={state.errors?.state}>
          {(props) => (
            <Select name="state" defaultValue={profile.state ?? ''} {...props}>
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field
        id="perfil-bio"
        label="Sobre você"
        hint="Aparece na página dos seus anúncios. Máximo de 400 caracteres."
        error={state.errors?.bio}
      >
        {(props) => (
          <Textarea
            name="bio"
            defaultValue={profile.bio ?? ''}
            rows={3}
            maxLength={400}
            placeholder="Ex.: Vendedor particular, respondo no mesmo dia."
            {...props}
          />
        )}
      </Field>

      <fieldset className="rounded-lg border border-line bg-surface-2 p-4">
        <legend className="px-1 text-sm font-medium">Dados de contato públicos</legend>
        <div className="flex flex-col gap-3 pt-2">
          <Checkbox
            id="perfil-mostrar-telefone"
            name="showPhone"
            defaultChecked={profile.showPhone}
            disabled={!hasPhone}
            label="Exibir meu telefone na página dos meus anúncios"
            description={
              hasPhone
                ? 'Qualquer visitante poderá ver e ligar para este número.'
                : 'Cadastre um telefone acima para poder liberar a exibição.'
            }
          />
          <Checkbox
            id="perfil-mostrar-email"
            name="showEmail"
            defaultChecked={profile.showEmail}
            label="Exibir meu e-mail na página dos meus anúncios"
            description="Endereços expostos publicamente costumam receber mensagens automatizadas."
          />
        </div>
      </fieldset>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? 'Salvando…' : 'Salvar perfil'}
      </Button>
    </form>
  )
}

export function ResendVerification({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    async () => resendVerificationAction(),
    { ok: false },
  )

  return (
    <div className="rounded-lg border border-accent-line bg-accent-soft p-5">
      <p className="flex items-center gap-2 font-semibold text-accent">
        <MailCheck size={18} aria-hidden="true" />
        Confirme seu e-mail
      </p>
      <p className="mt-2 text-sm text-fg-muted">
        Enviamos um link para <strong>{email}</strong>. Sem a confirmação você pode montar anúncios
        e salvar rascunhos, mas não publicar.
      </p>
      <form action={formAction} className="mt-4">
        <Button type="submit" variant="secundario" size="sm" disabled={pending}>
          {pending ? 'Enviando…' : 'Reenviar e-mail de confirmação'}
        </Button>
      </form>
      {state.message && (
        <p className={`mt-3 text-sm ${state.ok ? 'text-success' : 'text-danger'}`} role="status">
          {state.message}
        </p>
      )}
    </div>
  )
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, { ok: false })

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.ok ? <FormSuccess>{state.message}</FormSuccess> : <FormError>{state.message}</FormError>}

      <Field id="senha-atual" label="Senha atual" error={state.errors?.current} required>
        {(props) => (
          <Input name="current" type="password" autoComplete="current-password" required {...props} />
        )}
      </Field>

      <Field
        id="senha-nova"
        label="Nova senha"
        hint="No mínimo 10 caracteres."
        error={state.errors?.password}
        required
      >
        {(props) => (
          <Input name="password" type="password" autoComplete="new-password" minLength={10} required {...props} />
        )}
      </Field>

      <Field id="senha-confirmar" label="Repita a nova senha" error={state.errors?.confirm} required>
        {(props) => (
          <Input name="confirm" type="password" autoComplete="new-password" required {...props} />
        )}
      </Field>

      <p className="text-xs leading-relaxed text-fg-subtle">
        Ao trocar a senha, todas as outras sessões desta conta são encerradas. Você continua
        conectado neste aparelho.
      </p>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? 'Alterando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}

/**
 * Exclusão de conta.
 *
 * Dupla confirmação (senha + digitar EXCLUIR) porque a operação é definitiva:
 * apaga anúncios, fotos no disco, favoritos e sessões.
 */
export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, { ok: false })
  const [aberto, setAberto] = useState(false)

  if (!aberto) {
    return (
      <div className="rounded-lg border border-line bg-surface-2 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-fg">
          <ShieldAlert size={17} aria-hidden="true" className="text-danger" />
          Excluir minha conta
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Remove a conta, os anúncios, as fotos enviadas, os favoritos e as sessões abertas. Não há
          como desfazer.
        </p>
        <Button
          type="button"
          variant="perigo"
          size="sm"
          className="mt-4"
          onClick={() => setAberto(true)}
        >
          Quero excluir minha conta
        </Button>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-danger/40 bg-danger-soft p-5"
    >
      <p className="text-sm font-semibold text-danger">Confirmar exclusão da conta</p>

      <FormError>{state.message}</FormError>

      <Field id="excluir-senha" label="Sua senha" error={state.errors?.password} required>
        {(props) => (
          <Input name="password" type="password" autoComplete="current-password" required {...props} />
        )}
      </Field>

      <Field
        id="excluir-confirmacao"
        label="Digite EXCLUIR para confirmar"
        error={state.errors?.confirmacao}
        required
      >
        {(props) => <Input name="confirmacao" autoComplete="off" placeholder="EXCLUIR" required {...props} />}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="perigo" disabled={pending}>
          {pending ? 'Excluindo…' : 'Excluir conta em definitivo'}
        </Button>
        <Button type="button" variant="fantasma" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
