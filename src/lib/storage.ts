import { mkdir, writeFile, readFile, unlink, stat } from 'node:fs/promises'
import path from 'node:path'
import { env } from './env'
import { logger } from './logger'

/**
 * Armazenamento local de arquivos, em `STORAGE_DIR` (fora de /public).
 *
 * Nada aqui é servido pelo servidor de arquivos estáticos: o acesso passa
 * sempre por `/api/midia/[...key]`, que checa a visibilidade do anúncio antes
 * de entregar o byte. Isso evita que a foto de um rascunho fique acessível por
 * URL adivinhada.
 */

const ROOT = path.resolve(process.cwd(), env.STORAGE_DIR)

/**
 * Chaves são geradas pelo servidor e têm forma fixa:
 *   <listingId>/<uuid>.webp  ou  <listingId>/<uuid>_t.webp
 * A validação abaixo é a barreira contra path traversal — nenhum nome vindo
 * do cliente chega ao sistema de arquivos.
 */
const KEY_PATTERN = /^[a-z0-9]{1,40}\/[a-z0-9-]{1,60}(_t)?\.webp$/i

export function isValidStorageKey(key: string): boolean {
  if (!KEY_PATTERN.test(key)) return false
  if (key.includes('..') || key.includes('\\')) return false
  return true
}

function resolveKey(key: string): string {
  if (!isValidStorageKey(key)) {
    throw new Error('Chave de armazenamento inválida.')
  }
  const full = path.resolve(ROOT, key)
  // Defesa em profundidade: mesmo com a chave validada, confirmamos que o
  // caminho resolvido continua dentro da raiz.
  const rel = path.relative(ROOT, full)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Chave de armazenamento fora do diretório permitido.')
  }
  return full
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, data)
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(key))
  } catch {
    return null
  }
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await stat(resolveKey(key))
    return true
  } catch {
    return false
  }
}

/**
 * Remoção tolerante a falha: se o arquivo já não existe, não é erro.
 * Nunca deixamos a exclusão de um registro no banco falhar por causa do disco.
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    await unlink(resolveKey(key))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      logger.warn('falha ao remover arquivo do armazenamento', { key, code })
    }
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => deleteObject(k)))
}

export function storageRoot(): string {
  return ROOT
}
