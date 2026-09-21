import type { Metadata } from 'next'
import Link from 'next/link'
import { TickRule } from '@/components/ui/misc'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Segurança e privacidade',
  description:
    'Como a Motriz protege sua conta, o que aparece publicamente e como negociar com segurança.',
}

/**
 * Página pública de segurança e privacidade.
 *
 * Descreve apenas o que está implementado. Onde falta algo (envio de e-mail
 * dependendo de configuração, ausência de verificação de procedência), o texto
 * diz isso em vez de omitir.
 */
export default function SegurancaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
      <p className="rotulo mb-3">Segurança e privacidade</p>
      <h1 className="text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-5xl">
        O que é seu continua seu.
      </h1>
      <p className="mt-5 max-w-prose text-base leading-relaxed text-fg-muted">
        Esta página explica, em português claro, o que a plataforma faz com seus dados e o que ela
        não faz por você.
      </p>

      <TickRule className="mt-8" />

      <Secao titulo="Seu contato só aparece se você mandar">
        <p>
          Telefone e e-mail começam <strong className="text-fg">ocultos</strong>. Enquanto você não
          marcar a opção em <Link href="/conta" className="link-sublinhado text-accent">Minha conta</Link>,
          eles não aparecem em nenhuma página pública — nem para quem abrir o seu anúncio.
        </p>
        <p>
          Mesmo sem contato público, interessados conseguem falar com você: a mensagem chega no seu
          e-mail cadastrado, com o endereço de quem escreveu para você responder. O seu endereço
          não é revelado nesse caminho.
        </p>
      </Secao>

      <Secao titulo="Suas fotos não entregam onde você mora">
        <p>
          Fotos de celular costumam carregar metadados EXIF com as coordenadas de GPS de onde
          foram tiradas. Toda imagem enviada aqui é reprocessada no servidor, o que{' '}
          <strong className="text-fg">descarta esses metadados</strong> — inclusive a localização.
        </p>
      </Secao>

      <Secao titulo="Sua conta">
        <ul className="ml-5 list-disc space-y-2">
          <li>A senha é guardada como hash bcrypt. Ninguém, nem a administração, consegue lê-la.</li>
          <li>
            Ao trocar a senha, todas as outras sessões são encerradas. Você continua conectado
            apenas no aparelho em que fez a troca.
          </li>
          <li>
            Em <Link href="/conta" className="link-sublinhado text-accent">Minha conta</Link> você vê
            as sessões abertas, com navegador, sistema e último uso.
          </li>
          <li>
            Links de recuperação de senha valem por 1 hora e só funcionam uma vez.
          </li>
          <li>
            Você pode excluir a conta a qualquer momento. Isso apaga anúncios, fotos, favoritos e
            sessões, em definitivo.
          </li>
        </ul>
      </Secao>

      <Secao titulo="Rascunho é rascunho">
        <p>
          Um anúncio em rascunho, em análise, pausado ou recusado{' '}
          <strong className="text-fg">não aparece para ninguém</strong> além de você e da
          moderação. Isso vale também para as fotos: quem tiver o endereço exato do arquivo recebe
          &quot;não encontrado&quot;.
        </p>
      </Secao>

      <Secao titulo="Moderação e denúncia">
        <p>
          Anúncios novos passam por análise antes de entrar no catálogo. Qualquer anúncio publicado
          pode ser denunciado pelo botão &quot;Denunciar anúncio&quot;, na própria página.
        </p>
        <p>
          Toda decisão da moderação fica registrada com autor, motivo e data. Quando um anúncio é
          recusado, o motivo é enviado a quem anunciou — não há recusa sem explicação.
        </p>
      </Secao>

      <Secao titulo="O que a plataforma não faz por você">
        <p>
          A Motriz <strong className="text-fg">não verifica a procedência dos veículos</strong> nem
          a identidade dos anunciantes, e não intermedia pagamento. Antes de fechar negócio:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Combine a visita em local movimentado e à luz do dia.</li>
          <li>Confira o documento do veículo e o número do chassi pessoalmente.</li>
          <li>Consulte débitos, multas e restrições pelo Renavam, no Detran do seu estado.</li>
          <li>Considere um laudo cautelar independente.</li>
          <li>
            Desconfie de preço muito abaixo do mercado, de pressa para fechar e de pedido de
            depósito antecipado ou sinal antes de ver o carro.
          </li>
        </ul>
      </Secao>

      <Secao titulo="Sem rastreamento">
        <p>
          Não usamos analytics de terceiro, pixel de rastreamento nem cookie publicitário. O único
          cookie é o de sessão, necessário para manter você conectado. As fontes do site são
          servidas pelo nosso próprio domínio — seu navegador não faz requisição para fora.
        </p>
      </Secao>

      <div className="mt-12 rounded-lg border border-line bg-surface-2 p-5">
        <p className="text-sm leading-relaxed text-fg-muted">
          <strong className="text-fg">Aviso.</strong> Este é um projeto de demonstração técnica.
          Ele descreve o comportamento implementado, mas não constitui política de privacidade nem
          declaração de conformidade legal. Anúncios marcados como{' '}
          <strong className="text-fg">Demonstração</strong> não correspondem a veículos à venda.
        </p>
      </div>

      <div className="mt-8">
        <ButtonLink href="/catalogo" variant="contorno">
          Voltar ao catálogo
        </ButtonLink>
      </div>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      <div className="mt-3 flex max-w-prose flex-col gap-3 text-sm leading-relaxed text-fg-muted">
        {children}
      </div>
    </section>
  )
}
