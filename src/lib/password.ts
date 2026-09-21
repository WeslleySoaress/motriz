import bcrypt from 'bcryptjs'

/**
 * Hashing de senha via bcrypt (biblioteca consolidada, sem criptografia
 * própria). Custo 12: ~200–300 ms por hash em hardware de desenvolvimento,
 * o que torna força bruta offline cara sem travar o cadastro.
 */
const COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash)
  } catch {
    return false
  }
}

/**
 * Hash descartável usado quando o e-mail informado no login não existe.
 * Sem isso, a resposta para "e-mail inexistente" voltaria bem mais rápido que
 * a de "senha errada", permitindo enumerar contas por tempo de resposta.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO9a5GWvCTnYAfQ2bKoHcvVfKlKk6IfPu'

export async function fakeVerify(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH).catch(() => false)
}
