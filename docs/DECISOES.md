# Decisões técnicas e de design

Registro do que foi escolhido, por quê, e o que foi descartado. A intenção é
que alguém que pegue o projeto daqui a seis meses entenda o raciocínio sem
precisar arqueologia no histórico.

---

## 1. Arquitetura

### Stack

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Framework | **Next.js 16 (App Router)** | Renderização no servidor para SEO de anúncio, e Server Components/Actions para manter regra de negócio e autorização fora do cliente. |
| Linguagem | **TypeScript** (strict + `noUncheckedIndexedAccess`) | O modelo tem muitos estados (6 situações de anúncio); tipos evitam tratar um `undefined` como valor. |
| Banco | **SQLite via Prisma 7** | Roda sem serviço externo — quem avalia só precisa de Node. O schema evita recursos exclusivos do SQLite para a troca por PostgreSQL ser barata. |
| Estilo | **Tailwind CSS 4** | Tokens semânticos em CSS puro + utilitários. Sem CSS-in-JS, que custaria runtime no cliente. |
| Validação | **Zod 4** | Um schema por operação, usado no servidor. O mesmo schema documenta o contrato. |
| Imagens | **sharp** | Decodifica pelo conteúdo real, redimensiona e recodifica (o que descarta metadados). |
| Senhas | **bcryptjs** | Biblioteca consolidada; nada de criptografia própria. |
| Testes | **Vitest** + **Playwright** | Vitest para lógica e banco; Playwright para o que só existe no navegador (cookies, teclado, upload). |

### O que foi descartado e por quê

- **NextAuth / Auth.js**: o fluxo aqui é e-mail + senha com sessão no banco,
  verificação de e-mail e recuperação — tudo com regra própria (suspensão
  derruba sessão na hora, troca de senha encerra as demais). Com o provider de
  credenciais, o Auth.js empurra para JWT sem estado, que não permite revogar
  sessão imediatamente. A sessão em banco é ~150 linhas, e a parte sensível
  (hash de senha) continua em biblioteca.
- **PostgreSQL desde já**: melhor banco para produção, mas exigiria Docker ou
  serviço gerenciado para rodar o projeto. A migração está documentada em
  [`IMPLANTACAO.md`](IMPLANTACAO.md).
- **Armazenamento em S3/R2**: adiciona credencial e custo para um projeto que
  precisa rodar localmente. `src/lib/storage.ts` é uma interface pequena
  (`putObject`, `getObject`, `deleteObject`) — trocar por S3 é reescrever esse
  arquivo, e nada mais.
- **Rolagem infinita no catálogo**: paginação por link mantém a posição
  compartilhável, funciona com teclado e não acumula centenas de cards em
  memória.
- **Arrastar-e-soltar para reordenar fotos**: substituído por botões
  "mover para trás / para frente" + "definir como capa". Funciona com teclado,
  leitor de tela e toque, sem gesto de precisão.
- **`tailwind-merge`**: nenhum componente sobrescreve classe conflitante —
  variação é declarada como variante. Uma dependência a menos.

### Separação de camadas

```
página / componente          →  apresentação
src/server/actions/*         →  escrita: autoriza, valida, grava
src/server/queries.ts        →  leitura: um select por finalidade
src/server/listing-rules.ts  →  regra de negócio pura (sem banco, sem React)
src/lib/*                    →  infraestrutura (db, sessão, imagens, e-mail…)
```

`listing-rules.ts` existe para que "quem pode ver o quê" seja uma função pura,
testável sem subir nada, e usada igual em página, server action e route
handler. É o oposto de espalhar `if (user.id === listing.sellerId)` por
quinze arquivos.

### Por que o anúncio nasce como rascunho antes do upload

O anúncio é criado vazio (`DRAFT`) e só depois recebe fotos. Assim toda imagem
já chega vinculada a um anúncio com dono, e a autorização do upload é a mesma
do anúncio. Não existe arquivo "solto" esperando dono — que é de onde saem
arquivos órfãos e brechas de autorização.

### Por que os uploads não ficam em `/public`

Arquivo em `/public` é servido pelo servidor de estáticos, sem passar por
código. Como a foto de um rascunho não pode vazar, tudo passa por
`/api/midia/[...key]`, que confere a situação do anúncio antes de responder.
O custo é perder o cache automático do CDN para estáticos; em compensação,
imagens de anúncio público recebem `Cache-Control: immutable` (a chave contém
um UUID e o conteúdo nunca muda) e as privadas recebem `private, no-store`.

### Estado do catálogo mora na URL

Busca, filtros, ordenação e página são lidos de `searchParams` no servidor.
Consequências: link compartilhável, botão "voltar" funciona, e o servidor nunca
depende de algo que só existe no cliente para decidir o que mostrar.
`src/lib/catalog.ts` faz a tradução nos dois sentidos e é coberto por testes de
ida e volta.

---

## 2. Modelo de dados

Oito tabelas: `User`, `Session`, `AuthToken`, `RateLimit`, `Listing`,
`ListingImage`, `Favorite`, `Report`, `AdminAction`, `ListingViewDay`.

Decisões que merecem nota:

- **Preço em centavos (`Int`)**. Ponto flutuante para dinheiro gera erro de
  arredondamento. A conversão acontece só na entrada e na exibição.
- **Enums como `String`**. O conector SQLite do Prisma não suporta `enum`. A
  fonte única dos valores é `src/lib/enums.ts`, e o Zod recusa qualquer coisa
  fora da lista antes de chegar ao banco.
- **`features` como JSON em texto**. SQLite não tem tipo lista. A lista de
  opcionais é fechada (`FEATURES`), então não há texto livre entrando — o que
  também elimina a chance de alguém injetar conteúdo por esse campo.
- **`PUBLICLY_VISIBLE_STATUSES` como constante única**. Toda consulta pública
  deriva dela. Adicionar uma situação nova sem pensar em visibilidade fica
  difícil de propósito.
- **Índices** em `(status, publishedAt)`, `(sellerId, status)`, `priceCents`,
  `modelYear`, `mileageKm`, `(state, city)`, `bodyType` — exatamente os campos
  que o catálogo filtra e ordena.
- **`isDemo`** separa dado de demonstração de dado real. O seed só apaga o que
  ele mesmo criou; contas e anúncios reais sobrevivem a `npm run db:seed`.

---

## 3. Identidade visual

### Conceito: "editorial de garagem"

A referência de mercado para marketplace automotivo é quase sempre a mesma:
fundo branco, vermelho saturado, cards apertados e selos de confiança sem
lastro. A direção aqui é outra: **página de revista especializada**. Fotografia
grande, tipografia com peso, espaço para respirar e informação técnica tratada
como conteúdo, não como ruído.

### Cor

| Token | Escuro | Claro | Uso |
| --- | --- | --- | --- |
| `surface` | `#0E0F12` | `#F3F3EF` | fundo da página |
| `surface-2` | `#16181C` | `#FFFFFF` | cards e painéis |
| `fg` | `#F3F3EF` | `#14161A` | texto principal |
| `fg-muted` | `#A7AAB1` | `#54585F` | texto secundário |
| `accent-solid` | `#E9A23B` | `#E9A23B` | botão principal, anel de foco |
| `accent-text` | `#F0B75E` | `#8A4B0B` | destaque em texto e link |

O âmbar (`#E9A23B`) foi escolhido por evocar farol e latão sem cair no vermelho
da concorrência, e por render contraste alto sobre grafite. Ele tem **duas
variantes** porque a mesma cor não pode servir de texto em fundo claro e escuro:
`accent-solid` é a cor de preenchimento, `accent-text` é a cor legível.

**Inversão de superfície.** Todos os componentes usam tokens semânticos
(`bg-surface-2`, `text-fg-muted`, `border-line`). Uma seção marcada com
`.superficie-clara` redefine esses tokens localmente e todo o conteúdo dentro
dela troca de tema — sem variante por componente. É o que permite a faixa clara
"Publique o seu anúncio" na página inicial usar exatamente os mesmos cards.

Contraste: `node scripts/check-contrast.mjs` confere 23 pares (texto, botão,
erro, sucesso, anel de foco) contra o mínimo da WCAG 2.1 AA. **23/23 aprovados**,
com o pior caso em 4,53:1.

### Tipografia

- **Archivo** (500–800) nos títulos: grotesca de traço firme, boa em corpo
  grande, com `letter-spacing: -0.025em` para fechar os títulos.
- **Inter** no texto corrido.
- Ambas auto-hospedadas pelo `next/font` — sem requisição a terceiro em tempo
  de execução e sem salto de layout no carregamento da fonte.
- Preços e quilometragens usam `font-variant-numeric: tabular-nums`, para a
  coluna de preços poder ser lida de cima a baixo.

### Elementos autorais

1. **Régua de instrumento** (`.regua-tick`): filete com marcações regulares,
   como a escala de um velocímetro. Separa seções e dá ritmo à página. Custa
   um `repeating-linear-gradient` — nenhuma imagem.
2. **Símbolo da marca**: conta-giros reduzido ao essencial — arco, marcações e
   um ponteiro âmbar na faixa de potência. É o mesmo gesto da régua, então
   símbolo e layout falam a mesma língua.
3. **Rótulo editorial** (`.rotulo`): caixa alta, `letter-spacing: 0.14em`,
   corpo pequeno. Marca seções sem precisar de mais um tamanho de título.
4. **Faixa âmbar no card**: um filete de 2px que cresce da esquerda ao passar o
   mouse ou ao receber foco. Sinaliza o alvo sem mover nada de lugar.

### Movimento

Transições de 120–200 ms, só em cor, borda e deslocamento de 2px. Nada de
paralaxe ou entrada encenada. O bloco `@media (prefers-reduced-motion: reduce)`
no `globals.css` zera animação, transição e rolagem suave para quem pediu menos
movimento.

### O que foi evitado deliberadamente

- Gradiente decorativo e vidro fosco sem função.
- Selos e números sem dado por trás. **Todos** os números da página inicial vêm
  de contagem real no banco; conteúdo de demonstração é marcado como tal.
- Card com dez informações competindo. A hierarquia é fixa: foto → marca e
  modelo → versão → preço → dados essenciais → local.

---

## 4. Acessibilidade

Decisões, não apenas intenções:

- **Foco sempre visível**: `:focus-visible` com anel âmbar de 2px e
  `outline-offset`, conferido contra o mínimo de 3:1 da WCAG 1.4.11.
- **Formulários**: rótulo visível ligado por `id`, instrução e erro em
  `aria-describedby`, `aria-invalid` no campo com problema. O erro é anunciado
  junto com o campo, não só pintado de vermelho.
- **Modais escritos à mão** (menu, filtros no celular, denúncia, foto
  ampliada): `role="dialog"`, `aria-modal`, foco movido para o painel, foco
  preso enquanto aberto, Esc fecha, foco devolvido ao elemento de origem,
  rolagem do fundo travada.
- **Galeria**: miniaturas como `role="tablist"`; setas ←/→, Home e End navegam.
- **Card clicável sem link aninhado**: o `<a>` do título cobre o card com
  `::after`; o botão de favoritar fica por cima, fora do link.
- **Alvos de toque**: `@media (pointer: coarse)` garante 44px de altura mínima
  em botões e links de navegação.
- **Zoom**: `maximumScale: 5` — ampliar a página continua possível.
- **Sem rolagem horizontal**: verificado por teste automatizado em largura de
  celular nas rotas principais.

---

## 5. O que eu faria diferente com mais tempo

1. **Filtro por faixa com histograma** de preço, em vez de dois campos.
2. **Comparador** de até três veículos lado a lado.
3. **Busca por texto com índice FTS** — hoje é `LIKE`, o que é adequado para
   milhares de anúncios, mas não para milhões.
4. **Fila de processamento de imagem**: hoje o upload processa de forma
   síncrona. Com volume, isso vira trabalho em fila.
5. **Testes de acessibilidade automatizados** com `axe-core` no Playwright,
   complementando a inspeção manual.
