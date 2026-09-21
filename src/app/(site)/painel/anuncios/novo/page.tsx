import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { createDraftAction } from '@/server/actions/listings'
import { Button } from '@/components/ui/button'
import { Camera, ListChecks, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Anunciar veículo',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Início do anúncio.
 *
 * Criar o rascunho é uma ação (POST), não um efeito de abrir a página: assim
 * atualizar a tela não gera rascunhos duplicados, e a criação passa pela
 * proteção de origem das server actions.
 */
export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireUser('/painel/anuncios/novo')
  const params = await searchParams

  const erro =
    params.erro === 'limite'
      ? `Você criou muitos anúncios em pouco tempo. Tente de novo em ${params.minutos ?? 'alguns'} minutos.`
      : params.erro === 'falha'
        ? 'Não foi possível criar o rascunho agora. Tente novamente em instantes.'
        : null

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Anunciar um veículo</h2>

      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {erro}
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Vamos criar um rascunho. Você preenche a ficha, envia as fotos e publica quando estiver
        pronto — dá para parar no meio e voltar depois.
      </p>

      <ol className="mt-8 flex flex-col gap-px overflow-hidden rounded-lg border border-line bg-line">
        <Passo
          numero="01"
          icone={<ListChecks size={18} aria-hidden="true" />}
          titulo="Ficha do veículo"
          texto="Marca, modelo, versão, ano, quilometragem, câmbio, combustível, cor e localização."
        />
        <Passo
          numero="02"
          icone={<Camera size={18} aria-hidden="true" />}
          titulo="Fotos"
          texto="Até 12 imagens. Você escolhe a capa e a ordem. Os metadados, inclusive a localização por GPS, são removidos no envio."
        />
        <Passo
          numero="03"
          icone={<ShieldCheck size={18} aria-hidden="true" />}
          titulo="Publicação"
          texto="O anúncio passa por moderação antes de entrar no catálogo. Você acompanha tudo por aqui."
        />
      </ol>

      <form action={createDraftAction} className="mt-8">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Criar rascunho e começar
        </Button>
      </form>
    </div>
  )
}

function Passo({
  numero,
  icone,
  titulo,
  texto,
}: {
  numero: string
  icone: React.ReactNode
  titulo: string
  texto: string
}) {
  return (
    <li className="flex gap-5 bg-surface-2 p-5">
      <span className="preco shrink-0 text-lg text-accent">{numero}</span>
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <span className="text-accent">{icone}</span>
          {titulo}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{texto}</p>
      </div>
    </li>
  )
}
