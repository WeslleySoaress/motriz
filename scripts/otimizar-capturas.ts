/**
 * Converte as capturas de tela de PNG para WebP.
 *
 * O Playwright só grava PNG, e capturas de página inteira em PNG passam
 * facilmente de 30 MB no total — peso demais para um repositório. WebP a 82%
 * reduz isso em mais de uma ordem de grandeza sem perda visível em captura de
 * interface.
 *
 * Roda automaticamente depois de `npm run capturas`.
 */

import { readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const RAIZ = path.join(process.cwd(), 'docs', 'capturas')

/** Limite de lado do formato WebP. */
const MAX_LADO = 16_000

async function converterPasta(pasta: string) {
  const arquivos = (await readdir(pasta)).filter((f) => f.endsWith('.png'))
  let antes = 0
  let depois = 0

  let convertidos = 0

  for (const arquivo of arquivos) {
    const origem = path.join(pasta, arquivo)
    const destino = origem.replace(/\.png$/, '.webp')
    const tamanhoOrigem = (await stat(origem)).size

    try {
      await sharp(origem)
        // O WebP não aceita lado maior que 16383px, e uma captura de página
        // inteira passa disso. Reduzir a altura mantém o documento legível.
        .resize({ height: MAX_LADO, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(destino)
    } catch (erro) {
      // Sem conversão, o PNG fica como está: melhor uma imagem pesada do que
      // nenhuma imagem.
      console.warn(`  aviso: mantido em PNG — ${arquivo} (${(erro as Error).message})`)
      continue
    }

    antes += tamanhoOrigem
    depois += (await stat(destino)).size
    convertidos++
    await unlink(origem)
  }

  return { total: convertidos, antes, depois }
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function main() {
  let pastas: string[]
  try {
    pastas = await readdir(RAIZ)
  } catch {
    console.log('Nenhuma captura encontrada. Rode `npm run capturas` primeiro.')
    return
  }

  let totalAntes = 0
  let totalDepois = 0
  let totalArquivos = 0

  for (const pasta of pastas) {
    const caminho = path.join(RAIZ, pasta)
    if (!(await stat(caminho)).isDirectory()) continue

    const r = await converterPasta(caminho)
    if (r.total === 0) continue

    totalArquivos += r.total
    totalAntes += r.antes
    totalDepois += r.depois
    console.log(`${pasta}: ${r.total} imagens, ${mb(r.antes)} → ${mb(r.depois)}`)
  }

  if (totalArquivos === 0) {
    console.log('Nada a converter (as capturas já estão em WebP).')
    return
  }

  const reducao = Math.round((1 - totalDepois / totalAntes) * 100)
  console.log(`\nTotal: ${totalArquivos} imagens, ${mb(totalAntes)} → ${mb(totalDepois)} (−${reducao}%)`)
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
