# Pendências, limitações e dependências externas

O que **não** está pronto, o que depende de configuração externa e o que é
limitação assumida do desenho atual. Lista deliberadamente honesta: é mais útil
saber onde estão as bordas do que ler que está tudo pronto.

---

## 1. Bloqueadores para uso real

Itens que impedem operar a plataforma de verdade.

### 1.1 Envio de e-mail — `MAIL_TRANSPORT`

**Situação:** apenas o transporte `console` está implementado. Ele grava a
mensagem em `log/emails.log` e imprime no terminal. `MAIL_TRANSPORT="smtp"`
lança erro explícito na chamada, em vez de fingir que enviou.

**O que depende disso:**

- confirmação de e-mail no cadastro;
- recuperação de senha;
- aviso de aprovação ou rejeição de anúncio;
- mensagem do interessado para o anunciante.

Em desenvolvimento e em teste tudo funciona (os testes leem o link do arquivo
de log). **Em produção, sem um provedor real, ninguém confirma e-mail nem
recupera a senha.**

**O que falta:** implementar `sendViaSmtp` em `src/lib/mail.ts` (a interface
`MailMessage` já é o ponto de extensão), contratar um provedor, verificar o
domínio e configurar SPF, DKIM e DMARC.

### 1.2 Armazenamento persistente de arquivos

Os uploads vão para `STORAGE_DIR` no disco local. Em plataformas com sistema de
arquivos efêmero (Vercel, Heroku, Cloud Run sem volume), **todo upload some no
próximo deploy**.

**O que falta:** volume persistente, ou trocar `src/lib/storage.ts` por S3/R2 —
são quatro funções (`putObject`, `getObject`, `deleteObject`, `objectExists`) e
nenhum outro arquivo muda. Ver [IMPLANTACAO.md](IMPLANTACAO.md).

### 1.3 Banco para mais de uma instância

SQLite serve uma instância com pouco tráfego. Acima disso, a escrita
concorrente vira gargalo. Migração para PostgreSQL documentada em
[IMPLANTACAO.md](IMPLANTACAO.md).

---

## 2. Segurança — o que ficou de fora

### 2.1 Segundo fator para administradores

**Não implementado.** A área administrativa é protegida por sessão e papel,
mas uma senha comprometida de administrador dá acesso total à moderação. Um
segundo fator (TOTP) é o próximo passo natural.

### 2.2 CSP com `unsafe-inline` em scripts

A política inclui `script-src 'unsafe-inline'`, necessário para os scripts de
hidratação do Next.js sem infraestrutura de nonce. Isso reduz a proteção da CSP
contra XSS.

**Mitigação atual:** não há `dangerouslySetInnerHTML` em nenhum ponto, o React
escapa toda interpolação, e os campos de texto livre são validados e
renderizados como texto.

**O que falta:** gerar nonce por requisição e propagá-lo para os scripts do
Next.

### 2.3 Limitação de requisições em várias instâncias

Os contadores ficam numa tabela do banco, o que funciona com PostgreSQL
compartilhado, mas gera escrita a cada tentativa. Com tráfego alto, isso
deveria migrar para Redis.

### 2.4 Sem cota total de disco por conta

Há limite por arquivo (8 MB), por anúncio (12 fotos) e por hora (60 uploads),
mas **não** há teto acumulado por conta. Uma conta determinada pode ocupar
bastante espaço ao longo do tempo.

### 2.5 Proteção contra automação no cadastro

Não há CAPTCHA nem prova de trabalho. A limitação por IP reduz o volume, mas
não impede cadastro automatizado distribuído.

### 2.6 Antivírus nos uploads

As imagens são recodificadas pelo `sharp`, o que já descarta payload embutido
em metadados e recusa qualquer coisa que não seja imagem decodificável. Não há,
porém, varredura antivírus dos arquivos recebidos.

---

## 3. Funcionalidades ausentes por decisão de escopo

Nenhuma destas aparece simulada na interface:

| Funcionalidade | Situação |
| --- | --- |
| Pagamentos | Fora de escopo. Não há tela, botão nem menção. |
| Financiamento / simulação | Fora de escopo. |
| Verificação de procedência (laudo, débitos, sinistro) | Fora de escopo. A página do anúncio avisa explicitamente que a plataforma **não** verifica procedência nem identidade. |
| Avaliações e reputação de anunciante | Fora de escopo. Nenhuma nota inventada. |
| Chat interno | Fora de escopo. O contato é por e-mail ou WhatsApp. |
| Notificações no navegador | Fora de escopo. |
| Troca de e-mail da conta | Não implementada. O campo aparece desabilitado com explicação. |
| Exportação de dados da conta | Não implementada. Ver [PRIVACIDADE.md](PRIVACIDADE.md). |

---

## 4. Limitações técnicas assumidas

### 4.1 Busca textual por `LIKE`

`src/lib/catalog.ts` usa `contains`, que vira `LIKE` no SQLite. Adequado para
milhares de anúncios; não escala para milhões e não trata erro de digitação nem
sinônimo.

**Efeito colateral no SQLite:** o `LIKE` é insensível a maiúsculas apenas para
ASCII. Buscar "citroen" não encontra "Citroën". Em PostgreSQL, resolve-se com
índice `unaccent` + `pg_trgm` ou tabela de busca dedicada.

### 4.2 Contagem de visualizações

Deduplicada por hash de IP + navegador + segredo, por anúncio e por dia.

**Limitação:** pessoas atrás do mesmo IP e navegador (mesmo escritório, mesma
operadora móvel) contam uma vez só. É uma métrica de tendência, e a interface a
apresenta como tal — não como número de pessoas distintas.

### 4.3 Slug congelado após a publicação

O slug é recalculado enquanto o anúncio é rascunho e congela na publicação.
Corrigir um erro de digitação na marca depois de publicado mantém a URL antiga.
É intencional: mudar a URL de um anúncio que já circula quebraria links
compartilhados. Um sistema de redirecionamento resolveria.

### 4.4 Sem estado compartilhado de cache

Nenhum cache além do que o Next faz por requisição. Com várias instâncias, cada
uma consulta o banco. Não é problema no volume atual.

### 4.5 Fotos processadas de forma síncrona

O upload processa as imagens durante a requisição. Com muitas fotos grandes ao
mesmo tempo, a resposta demora. Uma fila de processamento resolveria.

### 4.6 Moderação sem fila de prioridade

A fila é ordenada por data de atualização. Não há priorização por risco nem
distribuição entre moderadores.

---

## 5. Dados de demonstração

### 5.1 Fotografias dependem de internet

`npm run photos:fetch` baixa do Wikimedia Commons. Sem internet, o seed cria os
anúncios **sem foto e como rascunho** (a plataforma não permite publicar sem
foto) e avisa no terminal.

### 5.2 Fotos ilustrativas

18 das 72 fotos não têm o ano confirmado no título do arquivo de origem. Elas
são marcadas como **ilustrativas** e a interface avisa isso no card e na página
do anúncio. Detalhes e critério em [IMAGENS.md](IMAGENS.md).

### 5.3 Anunciantes e descrições são fictícios

Nomes, telefones, cidades e descrições dos anúncios de demonstração foram
inventados para este projeto. Os telefones seguem o formato brasileiro mas não
correspondem a linhas reais. Todo anúncio criado pelo seed carrega o selo
**Demonstração**, e o rodapé do site explica o que isso significa.

---

## 6. Testes — cobertura e lacunas

O que foi executado está em [TESTES.md](TESTES.md). O que **não** foi:

- **Navegadores além do Chromium.** Firefox e WebKit não foram executados.
- **Leitor de tela real.** A acessibilidade foi construída pelos padrões
  corretos e verificada por estrutura (papéis, nomes acessíveis, foco, teclado),
  mas não foi testada com NVDA, JAWS ou VoiceOver.
- **Lighthouse / Core Web Vitals.** Não foram medidos. As decisões de
  desempenho (dimensões declaradas, carregamento tardio, WebP, fontes
  auto-hospedadas) foram tomadas, mas o número não foi coletado.
- **Carga.** Nenhum teste de carga ou estresse.
- **Testes automatizados de acessibilidade** (`axe-core`).
- **Os testes ponta a ponta rodam contra `next dev`**, não contra o build de
  produção. O build de produção é verificado separadamente por `npm run build`.

---

## 7. Sobre o nome

**Motriz** é um nome provisório escolhido para este projeto. **Não foi feita
nenhuma verificação** de disponibilidade de marca no INPI, de domínio ou de uso
por terceiros. Antes de qualquer uso comercial, isso precisa ser checado.

O mesmo vale para a identidade visual: ela foi desenhada especificamente aqui,
mas não há como afirmar que seja inédita no mundo sem uma busca de
anterioridade.
