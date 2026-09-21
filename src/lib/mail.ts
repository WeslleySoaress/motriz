import { mkdir, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from './env'
import { logger, maskEmail } from './logger'

/**
 * Envio de e-mail.
 *
 * ESTADO ATUAL: apenas o transporte "console", que grava a mensagem em
 * `log/emails.log` e imprime o link no terminal. É o bastante para exercitar
 * verificação de e-mail e recuperação de senha em desenvolvimento e em teste.
 *
 * O transporte "smtp" NÃO está implementado — depende de um provedor real
 * (credenciais, domínio verificado, SPF/DKIM). A interface abaixo é o ponto de
 * extensão: basta implementar `sendViaSmtp`. Ver docs/PENDENCIAS.md.
 */

export type MailMessage = {
  to: string
  subject: string
  text: string
}

const LOG_FILE = path.join(process.cwd(), 'log', 'emails.log')

export async function sendMail(message: MailMessage): Promise<void> {
  if (env.MAIL_TRANSPORT === 'smtp') {
    throw new Error(
      'MAIL_TRANSPORT="smtp" ainda não está implementado. Use "console" ou implemente sendViaSmtp em src/lib/mail.ts.',
    )
  }
  await sendViaConsole(message)
}

async function sendViaConsole(message: MailMessage) {
  const record = [
    '─'.repeat(72),
    `Data:    ${new Date().toISOString()}`,
    `De:      ${env.MAIL_FROM}`,
    `Para:    ${message.to}`,
    `Assunto: ${message.subject}`,
    '',
    message.text,
    '',
  ].join('\n')

  try {
    await mkdir(path.dirname(LOG_FILE), { recursive: true })
    await appendFile(LOG_FILE, record + '\n', 'utf8')
  } catch (error) {
    logger.warn('não foi possível gravar log/emails.log', { error })
  }

  // O e-mail do destinatário é mascarado no log estruturado; o conteúdo
  // completo fica apenas no arquivo local de desenvolvimento.
  logger.info('e-mail enviado (transporte console)', {
    to: maskEmail(message.to),
    subject: message.subject,
  })

  if (env.NODE_ENV !== 'test') {
    console.log(`\n[e-mail para ${message.to}] ${message.subject}\n${message.text}\n`)
  }
}

export function verifyEmailMessage(name: string, link: string): Omit<MailMessage, 'to'> {
  return {
    subject: 'Confirme seu e-mail na Motriz',
    text: [
      `Olá, ${name}.`,
      '',
      'Confirme seu e-mail para publicar anúncios na Motriz:',
      link,
      '',
      'O link vale por 24 horas. Se não foi você que criou a conta, ignore esta mensagem.',
    ].join('\n'),
  }
}

export function resetPasswordMessage(name: string, link: string): Omit<MailMessage, 'to'> {
  return {
    subject: 'Redefinição de senha na Motriz',
    text: [
      `Olá, ${name}.`,
      '',
      'Recebemos um pedido para redefinir sua senha. Para criar uma nova, acesse:',
      link,
      '',
      'O link vale por 1 hora e só pode ser usado uma vez.',
      'Se não foi você, ignore esta mensagem — sua senha continua a mesma.',
    ].join('\n'),
  }
}

export function listingModeratedMessage(
  name: string,
  title: string,
  approved: boolean,
  reason?: string | null,
): Omit<MailMessage, 'to'> {
  return {
    subject: approved
      ? `Seu anúncio "${title}" foi aprovado`
      : `Seu anúncio "${title}" não foi aprovado`,
    text: approved
      ? [`Olá, ${name}.`, '', `O anúncio "${title}" já está publicado no catálogo.`].join('\n')
      : [
          `Olá, ${name}.`,
          '',
          `O anúncio "${title}" não foi aprovado pelo seguinte motivo:`,
          reason ?? 'Motivo não informado.',
          '',
          'Você pode corrigir e enviar novamente pelo painel do anunciante.',
        ].join('\n'),
  }
}
