# Implantação, backup e recuperação

> **Nada foi publicado.** Este documento descreve como publicar; a publicação
> em si depende de autorização e não foi executada.

---

## 1. Antes de publicar

Lista de verificação obrigatória:

- [ ] `AUTH_SECRET` gerado com 32 bytes aleatórios, **diferente** do de
      desenvolvimento
      (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] `APP_URL` apontando para o domínio real, com `https://`
- [ ] `NODE_ENV=production` (ativa HSTS, CSP sem `unsafe-eval`, cookie `Secure`)
- [ ] `MAIL_TRANSPORT` resolvido — ver [PENDENCIAS.md](PENDENCIAS.md); com
      `console`, ninguém consegue confirmar e-mail nem recuperar a senha
- [ ] Banco migrado de SQLite para PostgreSQL, se houver mais de uma instância
- [ ] Diretório de uploads em volume persistente, **fora** do diretório do
      código
- [ ] `npm run audit:deps` sem vulnerabilidade alta ou crítica em aberto
- [ ] `npm run build`, `npm run typecheck`, `npm test` e `npm run test:e2e`
      passando
- [ ] Rotina de backup configurada e **restauração testada** (§5)
- [ ] Senha do administrador do seed trocada, ou o admin criado manualmente
      sem passar pelo seed

---

## 2. Build e execução

```bash
npm ci                 # instalação reproduzível, a partir do package-lock
npm run db:deploy      # aplica as migrações existentes (não cria novas)
npm run build          # roda prisma generate + next build
npm start              # servidor de produção
```

`npm run db:deploy` usa `prisma migrate deploy`: aplica apenas migrações já
versionadas e **nunca** apaga dados. `prisma migrate dev` e `db:reset` são
comandos de desenvolvimento e não devem ser usados em produção.

### Variáveis mínimas em produção

```bash
NODE_ENV=production
DATABASE_URL=postgresql://usuario:senha@host:5432/motriz?schema=public
APP_URL=https://seu-dominio
AUTH_SECRET=<32 bytes em hexadecimal>
STORAGE_DIR=/var/lib/motriz/uploads
MAIL_TRANSPORT=smtp
MAIL_FROM="Motriz <nao-responda@seu-dominio>"
MODERATION_ENABLED=true
```

A aplicação **falha na inicialização** com mensagem clara se algo obrigatório
faltar (`src/lib/env.ts`), em vez de quebrar no meio de uma requisição.

---

## 3. Migração de SQLite para PostgreSQL

SQLite é adequado para uma instância única com pouco tráfego. Para várias
instâncias, ou para escrita concorrente, migre.

1. Em `prisma/schema.prisma`, troque o provider:

   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```

2. Instale e configure o adapter correspondente:

   ```bash
   npm install @prisma/adapter-pg pg
   ```

   Ajuste `src/lib/db.ts` e `prisma.config.ts` para usar `PrismaPg` no lugar de
   `PrismaBetterSqlite3`.

3. Gere uma migração nova (a de SQLite não serve) e aplique:

   ```bash
   npm run db:migrate -- --name postgres-inicial
   ```

4. O schema foi escrito evitando recursos exclusivos de SQLite, mas revise:
   - os campos `String` que representam enumerações podem virar `enum` nativo
     do PostgreSQL;
   - `Listing.features` (JSON em texto) pode virar `String[]`;
   - considere índice GIN para a busca textual.

Se houver dados a preservar, exporte com `sqlite3 .dump`, adapte a sintaxe e
importe — ou escreva um script que leia pelo Prisma e grave no destino.

### Limitação em várias instâncias

A limitação de requisições usa uma tabela no banco, o que funciona bem com
PostgreSQL compartilhado. Já o **cache do Next** e a sessão não têm estado
compartilhado além do banco, então não há impedimento — mas veja
[PENDENCIAS.md](PENDENCIAS.md) para o caso de picos de escrita.

---

## 4. Armazenamento de arquivos

Os uploads ficam em `STORAGE_DIR`, **fora** de `/public`, e são servidos por
`/api/midia/[...key]` — que confere a visibilidade do anúncio antes de
entregar.

**Em produção, esse diretório precisa ser um volume persistente.** Em
plataformas com sistema de arquivos efêmero (Vercel, Heroku, Cloud Run sem
volume), todo upload some no próximo deploy.

Opções:

| Cenário | Recomendação |
| --- | --- |
| VPS / contêiner com volume | `STORAGE_DIR=/var/lib/motriz/uploads` num volume montado |
| Plataforma sem disco persistente | Trocar `src/lib/storage.ts` por S3 / R2 |

Para trocar por armazenamento de objetos, basta reescrever `src/lib/storage.ts`:
a interface é `putObject`, `getObject`, `deleteObject`, `objectExists`. Nenhum
outro arquivo precisa mudar. **Mantenha o bucket privado** e continue servindo
pela rota — o controle de acesso depende disso.

---

## 5. Backup

São **dois** conjuntos, e eles precisam ser consistentes entre si: banco sem
arquivos gera anúncio com foto quebrada; arquivos sem banco gera lixo órfão.

### Banco

**PostgreSQL**

```bash
pg_dump --format=custom --no-owner \
  "$DATABASE_URL" > "/backups/motriz-$(date +%F-%H%M).dump"
```

**SQLite** — use `.backup`, que é consistente com escrita concorrente. Copiar o
arquivo com `cp` durante uma escrita pode gerar um backup corrompido.

```bash
sqlite3 prisma/dev.db ".backup '/backups/motriz-$(date +%F-%H%M).db'"
```

### Arquivos

```bash
tar -czf "/backups/uploads-$(date +%F-%H%M).tar.gz" -C /var/lib/motriz uploads
```

### Frequência sugerida

| Item | Frequência | Retenção |
| --- | --- | --- |
| Banco | Diário + incremental (WAL/PITR se PostgreSQL) | 30 dias |
| Uploads | Diário (incremental com `rsync`) | 30 dias |
| Teste de restauração | Mensal | — |

Guarde os backups **fora** da máquina da aplicação e criptografados em repouso.
Backup de banco contém hash de senha e e-mails.

---

## 6. Recuperação

### Restaurar o banco

```bash
# PostgreSQL
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" motriz-2026-09-21-1600.dump

# SQLite
cp /backups/motriz-2026-09-21-1600.db prisma/dev.db
```

Depois, confirme que o schema está na versão esperada:

```bash
npx prisma migrate status
```

### Restaurar os arquivos

```bash
tar -xzf /backups/uploads-2026-09-21-1600.tar.gz -C /var/lib/motriz
```

### Verificar a consistência

Depois de restaurar, confira se todo registro de imagem tem arquivo no disco:

```bash
npx tsx -e "
import 'dotenv/config'
import { prisma } from './src/lib/db'
import { objectExists } from './src/lib/storage'

const imagens = await prisma.listingImage.findMany({
  select: { id: true, storageKey: true, thumbKey: true, listingId: true },
})
let faltando = 0
for (const img of imagens) {
  for (const chave of [img.storageKey, img.thumbKey]) {
    if (!(await objectExists(chave))) {
      console.log('sem arquivo:', chave, '(anúncio', img.listingId + ')')
      faltando++
    }
  }
}
console.log(faltando === 0 ? 'OK: todas as imagens têm arquivo.' : faltando + ' arquivo(s) ausente(s).')
await prisma.\$disconnect()
"
```

### Plano de recuperação resumido

| Situação | Ação |
| --- | --- |
| Banco corrompido, arquivos intactos | Restaure o banco mais recente e rode a verificação acima |
| Arquivos perdidos, banco intacto | Restaure os uploads; as imagens sem arquivo aparecem como "Imagem indisponível" na interface, sem quebrar a página |
| Ambos perdidos | Restaure os dois do **mesmo horário**; use o backup de banco mais antigo que o de arquivos, nunca o contrário |
| Deploy ruim | Volte a versão anterior do código; as migrações são aditivas, mas confira `prisma migrate status` |

**Objetivos sugeridos:** RPO de 24 h (backup diário) e RTO de 2 h. Ajuste
conforme a criticidade real e valide com um teste de restauração completo.

---

## 7. Monitoramento

O que observar no mínimo:

- **Logs da aplicação** — já saem em JSON estruturado, com id de correlação nos
  erros. Não contêm senha, token nem cookie.
- **Taxa de erro 5xx** por rota.
- **Tempo de resposta** de `/catalogo` e `/veiculo/[slug]` (as rotas que mais
  consultam o banco).
- **Espaço em disco** do `STORAGE_DIR`.
- **Fila de moderação**: anúncios em `PENDING` e denúncias em `OPEN` parados há
  muito tempo indicam moderação desatendida.
- **Tamanho da tabela `RateLimit`** — cresce com o tráfego; `pruneRateLimits()`
  limpa janelas com mais de 24 h e deve virar tarefa agendada.

---

## 8. Tarefas agendadas recomendadas

Nenhuma está configurada; são recomendações para produção.

| Tarefa | Frequência | Comando / função |
| --- | --- | --- |
| Limpar janelas de limitação | Diária | `pruneRateLimits()` |
| Apagar sessões expiradas | Diária | `DELETE FROM Session WHERE expiresAt < now()` |
| Apagar tokens usados/expirados | Diária | `DELETE FROM AuthToken WHERE usedAt IS NOT NULL OR expiresAt < now()` |
| Backup | Diária | §5 |
| Teste de restauração | Mensal | §6 |
| Auditoria de dependências | Semanal | `npm run audit:deps` |
