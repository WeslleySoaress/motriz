# Privacidade e dados pessoais

O que a plataforma coleta, por quê, por quanto tempo guarda e como a pessoa
tira seus dados de lá.

> **Este documento descreve o comportamento técnico implementado.** Ele não é
> um parecer jurídico e não afirma conformidade com a LGPD. Antes de qualquer
> operação real, uma revisão jurídica é necessária — ver
> [o que ainda falta](#o-que-ainda-falta).

---

## 1. Dados coletados

### Fornecidos pela pessoa

| Dado | Quando | Obrigatório | Público |
| --- | --- | --- | --- |
| Nome | Cadastro | Sim | **Sim** — aparece como anunciante |
| E-mail | Cadastro | Sim | **Não**, salvo escolha explícita |
| Senha (hash bcrypt) | Cadastro | Sim | Nunca |
| Telefone | Perfil | Não | **Não**, salvo escolha explícita |
| Cidade / UF | Perfil | Não | Sim, se preenchido |
| Descrição pessoal | Perfil | Não | Sim, se preenchida |
| Dados do veículo e fotos | Anúncio | Sim para publicar | Sim, quando publicado |

### Coletados automaticamente

| Dado | Por quê | Onde fica |
| --- | --- | --- |
| IP e navegador da sessão | Mostrar as sessões abertas na tela "Minha conta" | `Session.ip`, `Session.userAgent` |
| IP (para limitar tentativas) | Barrar força bruta em login e cadastro | `RateLimit.key`, junto do tipo da operação |
| Contagem de visualizações | Métrica do anúncio para o anunciante | `Listing.viewCount`, `ListingViewDay` |

**A contagem de visualizações não guarda IP.** A deduplicação usa um hash
SHA-256 de IP + navegador + segredo do servidor, truncado em 22 caracteres. O
IP em claro nunca é gravado por esse caminho, e o hash não é reversível sem o
segredo.

### O que não é coletado

Não há analytics de terceiro, pixel de rastreamento, cookie publicitário nem
script externo. As fontes são auto-hospedadas — o navegador não faz nenhuma
requisição para fora do domínio da aplicação.

---

## 2. Cookies

Um só:

| Cookie | Conteúdo | Validade | Atributos |
| --- | --- | --- | --- |
| `motriz_session` | Token de sessão aleatório | 30 dias | `HttpOnly`, `SameSite=Lax`, `Secure` em produção, `Path=/` |

É estritamente necessário para manter a pessoa conectada. Não há cookie de
análise ou de publicidade, e portanto não há banner de consentimento a exibir.

---

## 3. Contato público: escolha explícita

Este é o ponto central do desenho de privacidade do projeto.

- `showPhone` e `showEmail` começam **desmarcados**.
- Enquanto estiverem assim, nem telefone nem e-mail aparecem em **nenhuma**
  página pública.
- A função `publicSeller()` (`src/server/queries.ts`) é o único caminho pelo
  qual os dados do anunciante chegam à interface, e é ela que aplica a escolha.
  Usar o objeto `seller` direto não acontece em lugar nenhum.
- A caixa "exibir telefone" fica **desabilitada** enquanto não houver telefone
  cadastrado, e o texto de apoio avisa que qualquer visitante poderá ver o
  número.
- Há um teste automatizado que carrega a página de um anúncio e verifica que o
  HTML **não contém** o e-mail nem o telefone do anunciante que não os liberou.

Mesmo sem nenhum contato público, o interessado consegue enviar mensagem: o
formulário exige login e o anunciante recebe o e-mail do interessado para
responder. O endereço do anunciante nunca é revelado ao interessado nesse
fluxo.

---

## 4. Fotos e metadados

Toda imagem enviada é **recodificada para WebP no servidor**, o que descarta o
bloco de metadados do arquivo original — incluindo EXIF com coordenadas de GPS.
Uma foto tirada na garagem de casa não entrega o endereço de quem anuncia.

Verificado por teste automatizado: uma imagem com EXIF contendo bloco GPS é
processada e o resultado é inspecionado tanto por metadados quanto por busca
textual nos bytes gravados.

---

## 5. Quem vê o quê

| Dado | Visitante | Outro usuário | Anunciante | Administração |
| --- | --- | --- | --- | --- |
| Anúncio publicado | Sim | Sim | Sim | Sim |
| Rascunho / em análise / pausado / rejeitado | Não | Não | Só o próprio | Sim |
| Fotos de anúncio não público | Não | Não | Só as próprias | Sim |
| Nome do anunciante | Sim | Sim | — | Sim |
| E-mail do anunciante | Só se liberado | Só se liberado | — | **Sim** |
| Telefone do anunciante | Só se liberado | Só se liberado | — | Sim |
| Favoritos | Não | Não | Só os próprios | Não |
| Sessões abertas | Não | Não | Só as próprias | Não |
| Denúncia feita | Não | Não | Não | Sim, com autor |

A administração enxerga e-mail e telefone porque precisa deles para moderar
(responder a denúncia, avisar sobre rejeição, apurar fraude). Toda ação
administrativa fica registrada com autor e motivo em `AdminAction`.

---

## 6. Retenção e exclusão

### Retenção implementada

| Dado | Prazo |
| --- | --- |
| Sessão | 30 dias sem uso; apagada na primeira validação depois disso |
| Token de verificação de e-mail | 24 h, uso único |
| Token de redefinição de senha | 1 h, uso único |
| Contador de limitação | 24 h (`pruneRateLimits()`) |
| Conta, anúncios, fotos, favoritos | Até a exclusão pela pessoa |

### Exclusão de conta

Em **Minha conta → Excluir conta**, com dupla confirmação (senha + digitar
`EXCLUIR`). O que acontece:

1. As fotos são removidas do disco **antes** do registro — o cascade do banco
   apagaria as linhas e deixaria os arquivos para trás.
2. `prisma.user.delete` remove em cascata: anúncios, imagens, favoritos,
   sessões e tokens.
3. Denúncias feitas pela pessoa têm o autor anulado (`onDelete: SetNull`) e o
   conteúdo preservado, para a moderação não perder o histórico.
4. O cookie de sessão é apagado.

Não há "exclusão lógica" nem período de carência: a remoção é definitiva, e a
interface avisa isso antes de confirmar.

### Portabilidade

**Não implementada.** Não existe exportação dos dados da conta em formato
legível por máquina. Ver abaixo.

---

## 7. O que ainda falta

Itens que exigem decisão de produto ou revisão jurídica antes de uma operação
real:

1. **Revisão jurídica de adequação à LGPD**, incluindo base legal de cada
   tratamento, política de privacidade e termos de uso. Nada disso existe aqui.
2. **Exportação dos dados** da conta (direito de portabilidade).
3. **Registro de consentimento** com data e versão do texto aceito.
4. **Política de retenção de logs** — hoje os logs vão para a saída padrão do
   processo e a retenção depende de onde a aplicação for hospedada.
5. **Anonimização do IP** nas sessões após um prazo definido.
6. **Encarregado de dados (DPO)** e canal de atendimento ao titular.
7. **Avaliação de transferência internacional**, caso a hospedagem fique fora
   do Brasil.
