# Relatório de testes

O que foi efetivamente executado, com o resultado. Onde algo **não** foi
testado, está dito — ver também [PENDENCIAS.md](PENDENCIAS.md).

**Ambiente:** Windows 11, Node 22.18.0, npm 11.6.2, Chromium (Playwright 1.63).

---

## 1. Resumo

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Tipos | `npm run typecheck` | **Sem erros** |
| Lint | `npm run lint` | **Sem erros nem avisos** |
| Build de produção | `npm run build` | **Sucesso** (2 avisos, §6) |
| Unidade + integração | `npm test` | **105/105** em ~8 s |
| Ponta a ponta | `npm run test:e2e` | **52/52** em ~2 min |
| Dependências | `npm run audit:deps` | **0 vulnerabilidades** (§5) |
| Contraste de cor | `npm run check:contraste` | **23/23 pares ≥ WCAG AA** |

---

## 2. Estratégia

A divisão segue o risco, não a cobertura por si:

| Camada | Ferramenta | O que cobre | Por quê aqui |
| --- | --- | --- | --- |
| Unidade | Vitest | Regras de visibilidade e transição, tradução URL↔consulta, validação, formatação, chaves de arquivo | São decisões puras; erro aqui vira falha de autorização em todo lugar |
| Integração | Vitest + SQLite real | Sessão, senha, limitação de requisições, isolamento entre contas, processamento de imagem | Precisa de banco e de `sharp` de verdade; simulação não provaria nada |
| Ponta a ponta | Playwright | Fluxos completos no navegador, teclado, upload, e **tentativas de acesso por requisição HTTP direta** | É a única camada que exercita cookie, hidratação e o servidor como um todo |

**Não** perseguimos porcentagem de cobertura. O critério foi: todo caminho que
decide *quem pode ver ou alterar o quê* tem teste.

---

## 3. Unidade e integração — 105 testes

```
tests/unit/listing-rules.test.ts             21 testes
tests/unit/catalog.test.ts                   15 testes
tests/unit/validation.test.ts                30 testes
tests/unit/slug-publicacao.test.ts            3 testes
tests/integration/images.test.ts             12 testes
tests/integration/auth-and-access.test.ts    24 testes
─────────────────────────────────────────────────────
Total                                       105 passando
```

Banco isolado (`prisma/test.db`), criado e destruído pela própria suíte. O
banco de desenvolvimento nunca é tocado.

### Destaques do que é verificado

**Visibilidade e autorização** (`listing-rules`)
- Publicado e vendido aparecem para qualquer pessoa.
- Rascunho, em análise, pausado e rejeitado **não** aparecem para visitante nem
  para outra conta — mas aparecem para o dono e para a administração.
- O anunciante não consegue publicar sozinho um anúncio rejeitado (só reenviar
  para análise).
- Publicar exige foto, e-mail confirmado, ficha completa e conta ativa.

**Catálogo** (`catalog`)
- Ida e volta pela URL: os filtros reconstruídos são idênticos aos originais.
- Valor desconhecido é descartado em vez de quebrar a página.
- Faixa invertida (preço máximo menor que o mínimo) é normalizada.
- **O filtro de situação pública está sempre presente na consulta**, com ou sem
  outros filtros.
- Remover um chip preserva os demais filtros e volta para a página 1.

**Validação** (`validation`)
- Ano do modelo anterior à fabricação: recusado.
- Opcional fora da lista fechada (inclusive `<script>`): recusado.
- Combustível e carroceria inventados: recusados.
- Senha curta, comum ou só de espaços: recusada.
- Chaves de arquivo perigosas (`../../.env`, `abc/arquivo.php`, caminho
  absoluto, barra invertida): recusadas.

**Imagens** (`images`, com arquivos reais gerados pelo `sharp`)
- JPEG válido vira WebP + miniatura de 480px.
- Imagem grande é reduzida mantendo a proporção.
- Nome enviado pelo cliente (`../../../etc/passwd.jpg`) é descartado; a chave
  gerada é `<listingId>/<uuid>.webp`.
- **EXIF com bloco GPS desaparece na saída** — conferido por metadados e por
  busca textual nos bytes gravados.
- Recusados: SVG com `<script>`, texto com nome `.jpg`, executável disfarçado
  (cabeçalho `MZ`), imagem 200×150, arquivo vazio, arquivo de 9 MB.
- Falha de validação não deixa arquivo órfão no disco.

**Sessão e isolamento** (`auth-and-access`)
- O banco guarda só o hash do token — o token em si nunca aparece lá.
- Sessão expirada é recusada **e apagada**.
- Suspender a conta invalida **todas** as sessões dela na hora.
- A conta B não carrega anúncio nem rascunho da conta A para edição.
- Favoritos de uma conta não aparecem na outra.
- Anúncio que sai do ar some dos favoritos e volta quando é republicado.
- O card do catálogo não carrega nenhum campo do vendedor (verificado por
  inspeção do objeto serializado).
- Limitação de requisições: libera até o limite, bloqueia depois, conta
  separado por identificador e zera após sucesso.

### Defeitos encontrados pelos próprios testes

1. **`?pagina=-5` virava a página 5.** A função que lia inteiros da URL removia
   todos os caracteres não numéricos, e o sinal ia junto. Corrigido em
   `src/lib/catalog.ts`: valor negativo agora é recusado (vale para preço, ano,
   quilometragem e página).
2. **Ler a sessão fora de uma requisição HTTP lançava exceção.** Isso quebrava
   qualquer uso das consultas em script ou teste. Corrigido em
   `src/lib/session.ts`: sem contexto de requisição, a resposta correta é
   "ninguém autenticado", não um erro.
3. **A URL do anúncio mudava na primeira edição depois de publicado.** O slug
   definitivo só era calculado em `saveListingAction`, então um anúncio
   publicado a partir de um rascunho ia ao ar ainda com o slug provisório
   (`rascunho-xxxx`) e trocava de endereço no primeiro "Salvar alterações" —
   quebrando qualquer link já compartilhado. Encontrado pelo teste de ciclo de
   vida (a página do veículo passou a responder 404 depois da edição).
   Corrigido em `src/server/actions/listings.ts`: o slug passou a ser gerado
   **no momento da publicação** e congelado a partir dali; a edição não o
   altera mais. Coberto por `tests/unit/slug-publicacao.test.ts`.

O item 3 é o melhor argumento a favor do teste ponta a ponta: nenhuma
verificação de tipos, lint ou teste de unidade encontraria esse defeito, porque
cada peça isolada estava correta — o problema estava na ordem em que elas
aconteciam.

---

## 4. Ponta a ponta — 52 testes, todos passando

```
Running 52 tests using 1 worker
...
52 passed (2.0m)
```

Dois projetos do Playwright, ambos em Chromium:

- **desktop** — 1440×900, todos os arquivos menos `responsivo.spec.ts`
- **celular** — Pixel 7, apenas `responsivo.spec.ts`

Ambiente isolado: banco (`prisma/e2e.db`), uploads (`storage/e2e-uploads`) e
porta (3210) próprios, preparados do zero a cada execução. Os testes rodam com
`prefers-reduced-motion: reduce` — o que também exercita esse suporte do site.

### Cobertura dos cenários obrigatórios

| # | Cenário exigido | Onde é coberto |
| --- | --- | --- |
| 1 | Criar conta, entrar, sair e recuperar acesso | `conta.spec.ts` — inclui abrir o link de confirmação e o de redefinição lidos de `log/emails.log` |
| 2 | Criar anúncio com fotos e encontrá-lo no catálogo | `anuncio.spec.ts` — rascunho → fotos → ficha → análise → aprovação → catálogo |
| 3 | Editar, pausar e marcar como vendido | `anuncio.spec.ts` — ciclo completo, com segunda passagem pela moderação |
| 4 | Buscar, combinar filtros, ordenar e abrir detalhes | `catalogo.spec.ts` |
| 5 | Favoritar e remover favoritos | `catalogo.spec.ts` — com conferência de persistência em outra rota |
| 6 | Impedir acesso de visitante a recursos privados | `autorizacao.spec.ts` |
| 7 | Impedir que a conta A altere anúncios ou arquivos da conta B, inclusive por requisição direta | `autorizacao.spec.ts` — POST, PATCH e DELETE direto nas rotas de API, com a sessão da conta B |
| 8 | Impedir acesso administrativo de usuários comuns | `autorizacao.spec.ts` |
| 9 | Rejeitar uploads inválidos ou acima dos limites | `anuncio.spec.ts` — texto com nome `.jpg`, SVG com `<script>`, imagem 200×150 e arquivo de 9 MB |
| 10 | Tratar falhas de rede, armazenamento e dados inexistentes | `autorizacao.spec.ts` — 404 em anúncio inexistente, chave de mídia inválida, filtro absurdo |
| 11 | Confirmar que rascunhos e anúncios moderados não vazam publicamente | `autorizacao.spec.ts` + `anuncio.spec.ts` |

### `anuncio.spec.ts` — 5 testes (ciclo de vida, em série)

| Teste | O que prova |
| --- | --- |
| cria rascunho, envia fotos e preenche a ficha | Upload de 2 fotos, exatamente uma capa, ficha salva; o rascunho **não** aparece no catálogo |
| recusa upload inválido e acima do limite | Quatro arquivos recusados com mensagem específica; a galeria continua com 2 fotos |
| publica, passa por moderação e aparece no catálogo | Publicar → análise (fora do catálogo) → administração aprova → entra no catálogo; a decisão fica na auditoria |
| edita, marca como vendido, reativa e pausa | Preço editado reflete na página pública; vendido mantém o anúncio visível com selo; reativar volta à análise; nova aprovação; pausar tira do catálogo |
| anúncio pausado não vaza pela URL direta | O dono vê a pré-visualização; sem sessão, a mesma URL responde **404** |

### `autorizacao.spec.ts` — 17 testes

Visitante sem sessão: redirecionado nas áreas privadas; `POST` de foto responde
**401**; foto de rascunho e slug de rascunho respondem **404**; o rascunho não
aparece na busca.

Conta B contra conta A — **todas por requisição HTTP direta, com a sessão da
conta B**: abrir a edição, enviar foto, reordenar fotos e apagar arquivo alheio
respondem **404**, e a foto do outro continua intacta depois das tentativas.

Usuário comum contra a administração: **404** nas cinco telas administrativas, e
o menu da conta nem oferece o atalho. O administrador entra normalmente (200).

Entradas malformadas: anúncio inexistente responde 404 em português; chaves de
mídia como `../../.env` e `..%2F..%2Fprisma%2Fe2e.db` respondem 400/404; filtro
com valor absurdo não quebra o catálogo.

### `catalogo.spec.ts` — 15 testes

Busca a partir da primeira dobra; filtros combinados refletidos na URL; link de
busca compartilhado reabre a mesma seleção; remoção de um filtro por vez e
"limpar todos"; ordenação por preço conferida comparando os valores exibidos;
estado de nenhum resultado; contagem de resultados.

Página do veículo: ficha técnica completa, galeria pelo teclado, ampliação que
fecha no Esc, veículos relacionados e — importante — **o HTML não contém o
e-mail nem o telefone do anunciante que não liberou a exibição**.

Favoritos: visitante é levado ao login; usuário autenticado salva, confere na
lista de favoritos, remove e confere de novo. Denúncia: enviada pelo diálogo e
encontrada na fila de moderação em outra sessão.

### `conta.spec.ts` — 4 testes

Ciclo completo: cadastro → confirmação de e-mail pelo link real → login →
logout → área privada volta a exigir login → recuperação de senha pelo link
real → a senha antiga deixa de funcionar e a nova funciona.

Também: o mesmo link de redefinição não pode ser usado duas vezes; nem o
cadastro nem a recuperação revelam se um e-mail está cadastrado; dados
inválidos são barrados pelo navegador e a senha comum é recusada pelo servidor.

### `responsivo.spec.ts` — 10 testes (Pixel 7)

Ausência de rolagem horizontal em `/`, `/catalogo`, `/entrar`, `/criar-conta` e
na página do veículo; menu abre, navega, fecha no botão e no Esc; painel de
filtros abre e aplica; alvos de toque com pelo menos 44px; busca funciona com a
tecla Enter do teclado do celular.

### Estabilidade

A suíte foi executada **três vezes seguidas** com a configuração final:
52/52 em todas, em ~1,9 min cada. Não houve teste intermitente.

Chegar nesse ponto exigiu dois apoios no lado do teste, ambos por causa da
janela entre o HTML chegar e o React assumir a página — nessa janela um botão
já parece clicável, mas o clique não faz nada:

- `clicarAteVer` / `clicarAteNavegar`: clicam e conferem o efeito, repetindo
  se nada aconteceu.
- `aguardarHidratacao`: usado onde repetir não serve (marcar uma caixa já
  marcada é operação sem efeito). Espera o React gravar suas propriedades no
  nó do DOM.

Isso é limitação do teste, **não do produto**: os formulários são `<form>` de
verdade e funcionam sem JavaScript — no catálogo, o botão "Aplicar filtros"
navega; nos formulários de conta, as Server Actions têm melhoria progressiva.
O envio automático ao marcar um filtro é um acréscimo, não o caminho único.

### Defeitos encontrados nesta camada

Além do slug (§3, item 3), o teste de celular encontrou outro: **o botão "Ver N
resultados" do painel de filtros não navegava**. O `onSubmit` fechava o painel,
o que desmontava o formulário durante o próprio envio e cancelava a navegação.
Corrigido em `src/components/catalog/filters-panel.tsx`: como o envio é um GET
nativo, a página recarrega e o painel some sozinho — não havia o que fechar.

E um terceiro, na configuração e não no código: o servidor de desenvolvimento
do Next recusava servir `/_next/*` para a origem `127.0.0.1`, então **o bundle
do cliente não carregava** e a aplicação ficava renderizada porém sem
interatividade. Ficou visível porque só falhavam os testes que dependiam de
JavaScript; os que passam por Server Action continuavam verdes, graças à
melhoria progressiva. Resolvido com `allowedDevOrigins` em `next.config.ts`.

---

## 5. Auditoria de dependências

Antes:

```
4 high severity vulnerabilities
  mysql2  <=3.23.0    (via prisma → @prisma/client)
  deepmerge-ts        (via prisma → @prisma/config)
```

Nenhuma das duas é usada em tempo de execução por esta aplicação — o `mysql2`
vem embutido no CLI do Prisma e só é carregado com um adapter MySQL, que não
existe aqui. Mesmo assim, deixá-las vulneráveis na árvore não se justifica.

A correção oficial (`npm audit fix --force`) rebaixaria o Prisma de 7 para 6, o
que é uma mudança incompatível. Em vez disso, foram declaradas versões
corrigidas em `overrides` no `package.json`:

```json
"overrides": { "mysql2": "^3.24.4", "deepmerge-ts": "^8.0.2" }
```

Depois:

```
found 0 vulnerabilities
```

---

## 6. Build de produção

`npm run build` conclui com sucesso. 26 rotas, 2 estáticas e 24 dinâmicas
(esperado: quase tudo depende de sessão ou de dados do banco).

Dois avisos, ambos do mesmo ponto:

```
Warning: Dynamic filesystem access causes tracing of the whole project
  src/lib/storage.ts
```

Vem de `path.resolve(ROOT, key)` na leitura e escrita de arquivos. O Turbopack
não consegue determinar estaticamente quais arquivos serão acessados e amplia o
rastreamento de dependências. Não afeta o funcionamento; o efeito prático é um
pacote de saída maior no modo `standalone`.

---

## 7. Acessibilidade e responsividade

### Verificado por teste automatizado

- Ausência de rolagem horizontal em largura de celular (Pixel 7) nas rotas
  principais e na página do anúncio.
- Menu e painel de filtros do celular abrem, navegam, fecham no botão e no Esc.
- Alvos de toque principais com pelo menos 44px de altura.
- Galeria navegável por teclado; ampliação fecha no Esc.
- Nomes acessíveis usados como seletores em toda a suíte — um rótulo quebrado
  quebra o teste.

### Verificado por ferramenta própria

`npm run check:contraste` calcula o contraste WCAG 2.1 de 23 pares de cor
(texto principal, secundário, discreto, destaque, erro, sucesso, texto sobre
botão e anel de foco), nos dois temas de superfície.

```
23/23 pares aprovados.   Pior caso: 4,53:1 (mínimo exigido 4,5:1)
```

### Construído pelos padrões, **não** verificado com leitor de tela

Foram aplicados: `aria-describedby` ligando instrução e erro ao campo,
`aria-invalid`, `aria-required`, `role="dialog"` + `aria-modal` + foco preso nos
quatro modais escritos à mão, `role="tablist"` na galeria, `aria-pressed` no
botão de favoritar, `aria-current` na paginação, link "pular para o conteúdo" e
`prefers-reduced-motion` respeitado globalmente.

**Não houve teste com NVDA, JAWS ou VoiceOver**, nem auditoria automatizada com
`axe-core`. Ver [PENDENCIAS.md](PENDENCIAS.md).

---

## 7.1 Desempenho (Lighthouse)

Medido com **Lighthouse 12.8** contra o **build de produção** (`next start`),
perfil **celular** com estrangulamento simulado. São números de uma máquina
local: servem para comparar antes e depois, não para prometer o que acontece
na rede de um usuário real.

A medição encontrou dois defeitos reais, ambos corrigidos:

1. **Quatro cards em `eager` na página inicial.** `priority={index < 4}` fazia
   quatro fotografias grandes disputarem banda com a foto do herói, que é o
   elemento de LCP — e a seção de destaques fica abaixo da dobra nas duas
   larguras. O mesmo padrão estava no catálogo (`index < 3`) e nos favoritos.
2. **Compressão WebP folgada.** Qualidade 82 com esforço 4 produzia arquivos de
   250 a 636 KB. Passou para qualidade 76 com esforço 6: o custo extra acontece
   uma vez, no upload; a economia vale em toda visita.

| Página | Desempenho | LCP | Peso total |
| --- | --- | --- | --- |
| Inicial | 75 → **81** | 7,8 s → **5,3 s** | 1738 KB → **1353 KB** |
| Catálogo | 75 → **78** | 8,3 s → **6,0 s** | 2238 KB → **1728 KB** |
| Veículo | 76 → **80** | 5,7 s → **4,8 s** | 1112 KB → **901 KB** |

Os uploads no disco caíram 23% (22,4 MB → 17,3 MB) para o mesmo conjunto de
fotografias.

Outras categorias, na medição final:

| Página | Acessibilidade | CLS | TBT |
| --- | --- | --- | --- |
| Inicial | **100** | 0,000 | 48 ms |
| Catálogo | **99** | 0,000 | 88 ms |
| Veículo | **100** | 0,092 | 97 ms |

**O que continua ruim, e por quê.** O LCP ainda está acima dos 2,5 s
considerados bons. A causa está identificada e **não foi corrigida**: o
`srcset` oferece apenas 480w e 1600w. No celular o layout pede cerca de 985 px
reais, então o navegador escolhe o arquivo de 1600w. Falta um degrau
intermediário (algo como 1024w), o que exige uma variante nova no processamento
de imagem, uma coluna nova em `ListingImage` e o reprocessamento das fotos
existentes. Está registrado em [PENDENCIAS.md](PENDENCIAS.md).

Dois outros achados menores, ainda abertos: o catálogo fica em 99 de
acessibilidade por uma sequência de títulos fora de ordem, e a página do
veículo tem CLS de 0,092 — dentro do limite bom de 0,1, mas perto dele.

**Como repetir:**

```bash
npm run build
npx next start --port 3310
npx lighthouse http://127.0.0.1:3310/ --form-factor=mobile \
  --chrome-flags="--headless=new" --output=html --output-path=./lh.html
```

---

## 8. O que não foi testado

- Firefox e WebKit (só Chromium).
- Teste de carga.
- Leitor de tela real.
- **Envio de e-mail por SMTP contra um provedor real.** O transporte está
  implementado e a validação da configuração é testada, mas nenhuma mensagem
  foi entregue por um servidor SMTP de verdade — ver [PENDENCIAS.md](PENDENCIAS.md).
- Os testes ponta a ponta rodam contra `next dev`, não contra o build de
  produção. O build é verificado separadamente por `npm run build`.

---

## 9. Como reproduzir

```bash
npm install
cp .env.example .env          # e troque o AUTH_SECRET
npm run db:migrate
npm run photos:fetch          # opcional, requer internet
npm run db:seed

npm run typecheck
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run audit:deps
npm run check:contraste
```

Os testes ponta a ponta sobem o próprio servidor, em banco e diretório de
uploads separados (`prisma/e2e.db`, `storage/e2e-uploads`). Nada do ambiente de
desenvolvimento é alterado.
