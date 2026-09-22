# Segurança

Análise das ameaças relevantes para este marketplace e as proteções que foram
efetivamente implementadas. Onde algo **não** está resolvido, está dito
explicitamente.

> Todos os testes de segurança descritos aqui foram feitos contra a instalação
> local deste projeto, com dados fictícios. Nenhum sistema de terceiro foi
> testado.

---

## 1. Ameaças consideradas

| # | Ameaça | Impacto | Onde é tratada |
| --- | --- | --- | --- |
| A1 | Alguém edita ou exclui o anúncio de outra pessoa | Alto | §3 |
| A2 | Foto de rascunho / anúncio em análise vaza publicamente | Alto | §4 |
| A3 | Usuário comum alcança a área administrativa | Alto | §3 |
| A4 | Força bruta em senha de uma conta | Alto | §2 |
| A5 | Descobrir quais e-mails têm conta na plataforma | Médio | §2 |
| A6 | Upload de arquivo perigoso servido pelo nosso domínio | Alto | §5 |
| A7 | Coordenadas de GPS vazando na foto enviada | Médio | §5 |
| A8 | Sessão continuar válida após suspensão ou troca de senha | Alto | §2 |
| A9 | XSS por conteúdo de anúncio | Alto | §6 |
| A10 | CSRF em ação de escrita | Médio | §6 |
| A11 | Path traversal na entrega de arquivos | Alto | §5 |
| A12 | Redirecionamento aberto após login | Médio | §2 |
| A13 | Stack trace ou segredo em resposta de erro | Médio | §7 |
| A14 | Enumeração de tokens de recuperação de senha | Alto | §2 |
| A15 | Consumo abusivo de disco por upload | Médio | §5 |

---

## 2. Autenticação e sessão

### Senha

- **bcrypt** (`bcryptjs`), custo 12. Nenhuma criptografia própria.
- Mínimo de 10 caracteres, máximo de 200, sem regra de composição (seguindo a
  orientação do NIST SP 800-63B), com bloqueio de senhas notoriamente comuns.
- O hash nunca aparece em log: `src/lib/logger.ts` oculta chaves sensíveis.

### Sessão

- Token de **32 bytes aleatórios** (`crypto.randomBytes`), enviado só no cookie.
- O banco guarda apenas o **SHA-256** do token. Um dump do banco não permite
  assumir sessões. SHA-256 (e não bcrypt) é adequado aqui: o segredo já tem
  entropia alta, não há dicionário a atacar, e a verificação precisa ser rápida.
- Cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção, `Path=/`.
- Validade de 30 dias, com renovação deslizante quando faltam menos de 15.
- **Revogação imediata** (A8):
  - conta suspensa → `validateSessionToken` apaga **todas** as sessões dela na
    primeira requisição;
  - troca de senha → todas as sessões são encerradas e uma nova é emitida para
    o aparelho atual;
  - redefinição por link → todas as sessões são encerradas, sem exceção.
- A página **Minha conta** lista as sessões abertas (navegador, sistema,
  último uso).

### Limitação de tentativas (A4)

Janela fixa persistida no banco (`src/lib/rate-limit.ts`), consumida por um
`UPDATE` condicional: a comparação `count < limite` faz parte do `WHERE`, então
o banco decide se há vaga no mesmo comando que incrementa.

> **Corrigido depois de uma revisão externa.** A versão anterior lia o
> contador, comparava e só então incrementava — três operações separadas.
> Requisições simultâneas liam o mesmo valor antes de qualquer gravação e
> passavam todas. Com o código antigo, **24 de 24 chamadas concorrentes foram
> autorizadas num limite de 8**: na prática, o limite de login não existia
> contra um atacante que dispara em paralelo, que é exatamente como se ataca.
> O teste que expõe isso está em `tests/integration/auth-and-access.test.ts` e
> foi conferido contra o código antigo, para garantir que ele falha de verdade.

| Operação | Limite | Janela |
| --- | --- | --- |
| Login | 8 | 10 min |
| Cadastro | 5 | 1 h |
| Recuperação de senha | 5 | 1 h |
| Upload de foto | 60 | 1 h |
| Criação de anúncio | 20 | 1 h |
| Denúncia | 10 | 1 h |
| Mensagem ao anunciante | 20 | 1 h |

O login conta **em dois eixos**: por IP (ataque distribuído em várias contas) e
por e-mail (força bruta em uma conta a partir de vários IPs). Login correto
zera os dois contadores.

### Enumeração de contas (A5)

- **Login**: mensagem idêntica para e-mail inexistente e senha errada. Quando o
  e-mail não existe, um `bcrypt.compare` contra um hash descartável é executado
  assim mesmo, para o tempo de resposta não denunciar a diferença.
- **Cadastro com e-mail já existente**: a tela de sucesso é a mesma. Quem já
  tem conta recebe um e-mail avisando da tentativa.
- **Recuperação de senha**: a tela "Pedido registrado" aparece sempre.

### Tokens de e-mail e de senha (A14)

- 32 bytes aleatórios; o banco guarda só o SHA-256.
- **Uso único** (`usedAt`) e com prazo: 24 h para verificação, 1 h para
  redefinição.
- Pedir um token novo invalida o anterior do mesmo tipo.
- A página `/redefinir-senha` **não** valida o token ao abrir — a verificação
  acontece só no envio, para a página não virar um oráculo de tokens válidos.

### Redirecionamento após login (A12)

`safeNext()` aceita apenas caminho interno: precisa começar com `/` e não pode
começar com `//`. Qualquer outra coisa cai em `/painel`. Mesma checagem na
página `/entrar`.

---

## 3. Autorização (A1, A3)

**Regra do projeto: a permissão é conferida no servidor, em toda operação.**

Não há autorização baseada apenas em middleware — middleware pode ser
contornado, e já houve falha grave de bypass nesse padrão no próprio Next.js
(CVE-2025-29927). Aqui:

- Toda página privada chama `requireUser()` / `requireAdmin()`.
- **Toda server action repete a checagem**, porque uma server action é um
  endpoint próprio e não herda proteção de layout.
- Todo route handler chama `requireUserApi()` / `requireAdminApi()`.

### Propriedade verificada na própria consulta

Onde é possível, o filtro de dono entra no `where`, não em um `if` depois:

```ts
// src/server/queries.ts
prisma.listing.findFirst({ where: { id: listingId, sellerId } })
```

Um id de anúncio alheio simplesmente não retorna linha. Isso elimina o padrão
"carrega e depois compara", que é de onde costumam sair falhas de autorização.

### Ser dono não basta: a situação também é conferida

> **Corrigido depois de uma revisão externa.** `saveDraftAction` usa a
> validação permissiva do rascunho, que aceita campo vazio e preço zerado. Ela
> conferia o dono, mas **não conferia a situação do anúncio**. O formulário só
> oferece essa ação para rascunho e recusado, mas o servidor confiava nessa
> escolha: uma chamada direta com o id de um anúncio **publicado** gravaria
> marca vazia e preço zero — e, como salvar não mexe na situação, o anúncio
> continuaria no catálogo assim.
>
> A regra virou uma função pura, `canSaveAsDraft`, conferida no servidor antes
> de qualquer gravação. Um dos testes percorre `PUBLICLY_VISIBLE_STATUSES`, de
> modo que acrescentar uma situação pública nova quebra a suíte até a regra ser
> revista.

### Respostas que não confirmam existência

Anúncio de outra pessoa, arquivo de outra pessoa e a área administrativa
respondem **404**, não 403. Um 403 confirmaria que o recurso existe.

### Administração

- `/admin/*` exige `role === 'ADMIN'`, conferido a cada requisição.
- Um administrador **não pode** suspender a própria conta nem outra conta
  administradora pela interface — promover ou rebaixar exige acesso ao banco.
- **Toda** ação administrativa grava uma linha em `AdminAction` com autor,
  alvo, motivo e estado anterior, **na mesma transação da alteração que
  descreve**. Ou as duas gravações acontecem, ou nenhuma acontece. A tela de
  auditoria é somente leitura: não existe caminho na aplicação para editar ou
  apagar um registro.

  > **Corrigido depois de uma revisão externa.** Antes, a alteração e o
  > registro eram duas gravações sequenciais. Se a segunda falhasse, sobrava um
  > anúncio tirado do ar ou uma conta suspensa sem histórico de quem fez e por
  > quê — a promessa de rastro completo valia só enquanto nada desse errado. As
  > cinco operações administrativas passaram a usar `$transaction`, e um teste
  > força a falha do registro com autor inexistente para exigir que a alteração
  > seja desfeita.
- Rejeição, suspensão de anúncio e suspensão de conta exigem motivo escrito,
  que é enviado ao anunciante.

### Autenticação adicional para administradores

**Não implementada.** Segundo fator é o próximo passo natural para esta área —
ver [`PENDENCIAS.md`](PENDENCIAS.md).

---

## 4. Visibilidade dos anúncios (A2)

A regra é uma constante única, `PUBLICLY_VISIBLE_STATUSES = ['PUBLISHED', 'SOLD']`,
e **todas** as leituras públicas derivam dela:

| Superfície | Como é garantido |
| --- | --- |
| Catálogo | `buildWhere()` sempre injeta o filtro de situação como primeira condição |
| Página do anúncio | `canView()` antes de renderizar; caso contrário, `notFound()` |
| Metadados / prévia de link | Anúncio não público não gera título nem descrição, e recebe `robots: noindex` |
| Imagens | `/api/midia` consulta a situação do anúncio dono antes de entregar |
| Favoritos | Anúncio que saiu do ar some da lista |
| Relacionados | Consulta restrita a `PUBLISHED` |

Coberto por teste em três níveis: unidade (`canView`), integração
(`searchListings` nunca devolve rascunho) e ponta a ponta (URL direta de
rascunho responde 404 para visitante e para outra conta).

---

## 5. Uploads e arquivos

### Validação (A6)

`src/lib/images.ts`:

1. **O formato é decidido pelo conteúdo.** O `sharp` lê o cabeçalho real do
   arquivo. Extensão e `Content-Type` enviados pelo navegador são ignorados
   para essa decisão.
2. Aceitos: **JPEG, PNG, WebP e AVIF**. **SVG é recusado de propósito** — pode
   conter script e seria servido pelo nosso domínio.
3. Limites: tamanho (8 MB por padrão), dimensão mínima (480px por lado),
   máxima (12.000px) e total de pixels (50 MP, contra bomba de descompressão).
4. Quantidade por anúncio: 12 por padrão, conferido no servidor.
5. A saída é **sempre WebP recodificado**.

### Metadados e GPS (A7)

Recodificar descarta todo o bloco de metadados do original. O `sharp` só
preserva metadados quando `withMetadata()` é chamado — e não é. `rotate()` sem
argumento aplica a orientação EXIF **antes** de descartá-la, para a foto não
sair deitada.

Verificado por teste: uma imagem com EXIF contendo bloco GPS é processada e o
resultado é inspecionado tanto por `sharp().metadata()` (sem `exif`) quanto
por busca textual nos bytes gravados.

### Nome de arquivo e path traversal (A11)

- O nome é gerado no servidor: `<listingId>/<uuid>.webp`. O nome enviado pelo
  cliente nunca toca o disco.
- `isValidStorageKey()` aceita apenas esse formato exato, e recusa `..`, `\` e
  qualquer outra extensão.
- Defesa em profundidade: mesmo com a chave validada, o caminho resolvido é
  comparado com a raiz de armazenamento antes de qualquer leitura ou escrita.

Testado com `../../.env`, `..%2F..%2Fprisma%2Fe2e.db`, `abc/arquivo.php`,
caminho absoluto e barra invertida do Windows.

### Arquivos órfãos

- **Falha no meio do upload**: o que já foi gravado em disco naquela requisição
  é removido antes de propagar o erro.
- **Exclusão de anúncio**: o registro sai primeiro, os arquivos depois. Se o
  disco falhar, sobra no máximo um arquivo inacessível — nunca um anúncio
  apontando para arquivo inexistente.
- **Exclusão de conta**: as imagens são removidas antes do `delete` do usuário,
  porque o cascade do banco apagaria os registros e deixaria os arquivos.
- **Falha ao carregar**: a interface mostra um espaço explicado, em vez do
  ícone quebrado do navegador.

### Consumo de disco (A15)

Limitado por: tamanho por arquivo, quantidade por anúncio, e limite de 60
uploads por hora por usuário. **Não há cota total por conta** — ver
[`PENDENCIAS.md`](PENDENCIAS.md).

---

## 6. Aplicação

### XSS (A9)

- O React escapa toda interpolação por padrão. **Não há `dangerouslySetInnerHTML`
  em nenhum ponto do projeto.**
- A descrição do anúncio é renderizada como texto com `whitespace-pre-line` —
  quebras de linha são preservadas sem interpretar HTML.
- Opcionais vêm de uma **lista fechada**; texto livre não entra por ali.
- Content-Security-Policy restritiva (`next.config.ts`): `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `connect-src 'self'`. Em desenvolvimento, `'unsafe-eval'` é liberado porque o
  fast refresh precisa — em produção, não.

> **Limitação conhecida:** a CSP usa `script-src 'unsafe-inline'`, necessário
> para os scripts de hidratação do Next.js sem infraestrutura de nonce. Está
> registrado em [`PENDENCIAS.md`](PENDENCIAS.md).

### CSRF (A10)

Duas camadas:

1. Cookies `SameSite=Lax` — o navegador não envia o cookie em POST cross-site.
2. Verificação explícita de origem nos route handlers de escrita
   (`assertSameOrigin`), checando `Origin` e `Sec-Fetch-Site`.

Server Actions do Next.js fazem a própria verificação de origem internamente.

### SQL injection

Todo acesso é via Prisma, com consultas parametrizadas. **Não há
`$queryRawUnsafe` nem concatenação de SQL em nenhum ponto.**

### CORS

Nenhuma rota é aberta para outras origens. Não há cabeçalho
`Access-Control-Allow-Origin` — o padrão do navegador (mesma origem) já é o
comportamento desejado.

### Cabeçalhos de segurança

Aplicados a todas as rotas:

| Cabeçalho | Valor |
| --- | --- |
| `Content-Security-Policy` | política restritiva (acima) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | câmera, microfone, geolocalização, pagamento e USB desligados |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | 2 anos, `includeSubDomains`, `preload` (só em produção) |

`poweredByHeader: false` remove o `X-Powered-By`.

---

## 7. Erros e logs (A13)

- Nenhuma resposta HTTP carrega stack trace. `toPublicError()` registra o erro
  completo no log do servidor com um **id de correlação** curto e devolve ao
  usuário uma mensagem genérica em português mais esse id.
- Log estruturado em JSON, com ocultação automática de chaves sensíveis
  (`password`, `senha`, `token`, `tokenHash`, `authorization`, `cookie`,
  `secret`). E-mails são mascarados (`ma***@exemplo.com`).
- Em produção, o Prisma registra apenas `warn` e `error` — nunca as consultas,
  que poderiam conter dados pessoais.
- Segredos vivem só em variável de ambiente. O `.env` está no `.gitignore`; o
  `.env.example` tem apenas valores de exemplo.

---

## 8. Dependências

`npm run audit:deps` roda `npm audit --omit=dev`. O resultado da execução está
em [`TESTES.md`](TESTES.md).

Nenhuma dependência de terceiro é carregada em tempo de execução no navegador:
fontes são auto-hospedadas pelo `next/font` e não há script externo.

---

## 9. Verificações executadas

Ver [`TESTES.md`](TESTES.md) para o relatório completo, incluindo as tentativas
de acesso cruzado feitas por requisição HTTP direta (não apenas pela interface).
