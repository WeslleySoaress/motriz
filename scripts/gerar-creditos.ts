/**
 * Gera docs/IMAGENS.md a partir do manifesto de fotos.
 *
 * O crédito das imagens não é escrito à mão: é derivado do que o script de
 * download registrou. Assim, se as fotos mudarem, o documento acompanha.
 *
 * Uso: npx tsx scripts/gerar-creditos.ts
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type PhotoRecord = {
  arquivo: string
  titulo: string
  paginaUrl: string
  autor: string
  licenca: string
  licencaUrl: string
  correspondenciaConfirmada: boolean
}

type Manifest = {
  geradoEm: string
  fonte: string
  observacao: string
  veiculos: Record<string, PhotoRecord[]>
}

const MANIFESTO = path.join(process.cwd(), 'scripts', '.cache', 'fotos', 'manifesto.json')
const SAIDA = path.join(process.cwd(), 'docs', 'IMAGENS.md')

function escapar(texto: string): string {
  return texto.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
}

async function main() {
  let manifesto: Manifest
  try {
    manifesto = JSON.parse(await readFile(MANIFESTO, 'utf8')) as Manifest
  } catch {
    console.error(
      'Manifesto não encontrado. Rode `npm run photos:fetch` antes de gerar os créditos.',
    )
    process.exit(1)
  }

  const veiculos = Object.entries(manifesto.veiculos)
  const todas = veiculos.flatMap(([, fotos]) => fotos)
  const ilustrativas = todas.filter((f) => !f.correspondenciaConfirmada)

  const porLicenca = todas.reduce<Record<string, number>>((acc, f) => {
    acc[f.licenca] = (acc[f.licenca] ?? 0) + 1
    return acc
  }, {})

  const linhas: string[] = []

  linhas.push('# Fotografias de demonstração')
  linhas.push('')
  linhas.push(
    '> Documento gerado por `npx tsx scripts/gerar-creditos.ts` a partir do',
    '> manifesto criado por `npm run photos:fetch`. Não edite à mão.',
  )
  linhas.push('')
  linhas.push('---')
  linhas.push('')
  linhas.push('## Origem e condições de uso')
  linhas.push('')
  linhas.push(`- **Fonte:** ${manifesto.fonte}`)
  linhas.push(`- **Coletadas em:** ${new Date(manifesto.geradoEm).toLocaleString('pt-BR')}`)
  linhas.push(`- **Total de imagens:** ${todas.length}, em ${veiculos.length} anúncios`)
  linhas.push('')
  linhas.push('### Licenças')
  linhas.push('')
  linhas.push('| Licença | Imagens |')
  linhas.push('| --- | --- |')
  for (const [licenca, total] of Object.entries(porLicenca).sort((a, b) => b[1] - a[1])) {
    linhas.push(`| ${escapar(licenca)} | ${total} |`)
  }
  linhas.push('')
  linhas.push(
    'Só são aceitas licenças livres: CC0, CC BY, CC BY-SA e domínio público.',
    'O script recusa qualquer outra — inclusive licenças não comerciais e',
    '"uso justo". A regra está em `ALLOWED_LICENSE`, em',
    '`scripts/fetch-demo-photos.ts`.',
  )
  linhas.push('')
  linhas.push('### Atribuição')
  linhas.push('')
  linhas.push(
    'CC BY e CC BY-SA exigem crédito ao autor. O crédito aparece **na própria',
    'página do anúncio**, abaixo da galeria, com nome do autor, licença e link',
    'para a página de origem no Commons. Os campos ficam em `ListingImage`',
    '(`sourceAuthor`, `sourceLicense`, `sourceUrl`).',
  )
  linhas.push('')
  linhas.push('### Correspondência com o veículo anunciado')
  linhas.push('')
  linhas.push(
    `De ${todas.length} imagens, **${todas.length - ilustrativas.length} têm o ano confirmado**`,
    `no título do arquivo e **${ilustrativas.length} não têm**.`,
  )
  linhas.push('')
  linhas.push(
    'As que não têm são marcadas como **ilustrativas** no banco',
    '(`isIllustrative = true`) e a interface avisa isso em dois lugares: um selo',
    '"Foto ilustrativa" no card do catálogo e uma faixa sobre a foto na página do',
    'anúncio, com o texto "não confirmamos que corresponde exatamente a esta',
    'versão e ano".',
  )
  linhas.push('')
  linhas.push(
    'O critério é conservador de propósito: a correspondência só é considerada',
    'confirmada quando marca, modelo **e** ano aparecem no título do arquivo no',
    'Commons. Marca e modelo corretos com ano não confirmado já bastam para a',
    'imagem entrar como ilustrativa.',
  )
  linhas.push('')
  linhas.push('### O que o script não faz')
  linhas.push('')
  linhas.push('- Não baixa foto de anúncio de terceiro.')
  linhas.push('- Não usa imagem gerada por IA.')
  linhas.push('- Não apresenta nenhuma imagem como foto de um veículo realmente à venda.')
  linhas.push('')
  linhas.push(
    'Todos os anúncios de demonstração carregam o selo **Demonstração** e o',
    'rodapé do site explica que os veículos não estão à venda e que os',
    'anunciantes são fictícios.',
  )
  linhas.push('')
  linhas.push('---')
  linhas.push('')
  linhas.push('## Créditos por anúncio')
  linhas.push('')

  for (const [veiculo, fotos] of veiculos) {
    if (fotos.length === 0) continue
    linhas.push(`### ${veiculo}`)
    linhas.push('')
    linhas.push('| Arquivo no Commons | Autor | Licença | Correspondência |')
    linhas.push('| --- | --- | --- | --- |')
    for (const foto of fotos) {
      const marca = foto.correspondenciaConfirmada ? 'Ano confirmado' : '**Ilustrativa**'
      linhas.push(
        `| [${escapar(foto.titulo)}](${foto.paginaUrl}) | ${escapar(foto.autor)} | ${escapar(foto.licenca)} | ${marca} |`,
      )
    }
    linhas.push('')
  }

  const semFoto = veiculos.filter(([, fotos]) => fotos.length === 0)
  if (semFoto.length > 0) {
    linhas.push('---')
    linhas.push('')
    linhas.push('## Anúncios sem fotografia')
    linhas.push('')
    linhas.push(
      'Nenhuma imagem com licença compatível foi encontrada para os veículos',
      'abaixo. Eles ficam como **rascunho** — a plataforma não permite publicar',
      'anúncio sem foto.',
    )
    linhas.push('')
    for (const [veiculo] of semFoto) linhas.push(`- ${veiculo}`)
    linhas.push('')
  }

  await writeFile(SAIDA, linhas.join('\n'), 'utf8')
  console.log(`docs/IMAGENS.md gerado: ${todas.length} imagens, ${ilustrativas.length} ilustrativas.`)
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
