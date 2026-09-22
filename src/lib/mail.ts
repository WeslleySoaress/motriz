import { mkdir, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { createTransport, type Transporter } from 'nodemailer'
import { env } from './env'
import { logger, maskEmail } from './logger'

/**
 * Envio de e-mail. Dois transportes, escolhidos por `MAIL_TRANSPORT`.
 *
 * "console" (padrão): grava em `log/emails.log` e imprime o link no terminal.
 * Não envia nada de verdade — é o suficiente para exercitar verificação de
 * e-mail e recuperação de senha em desenvolvimento e em teste.
 *
 * "smtp": envia de verdade, por nodemailer. **O código está implementado e
 * verificado quanto a tipos e lint, mas nunca foi exercitado contra um
 * servidor SMTP real** — isso depende de credenciais e de um domínio com SPF e
 * DKIM configurados, que este projeto não tem. Tratar como integração
 * preparada, não como funcionalidade comprovada. Ver docs/PENDENCIAS.md.
 */

export type MailMessage = {
  to: string
  subject: string
  text: string
}

const LOG_FILE = path.join(process.cwd(), 'log', 'emails.log')

export async function sendMail(message: MailMessage): Promise<void> {
  if (env.MAIL_TRANSPORT === 'smtp') {
    await sendViaSmtp(message)
    return
  }
  await sendViaConsole(message)
}

/**
 * O transporte é criado uma vez e reaproveitado: o nodemailer mantém um pool
 * de conexões, e abrir uma sessão SMTP por mensagem é caro e costuma esbarrar
 * em limite de conexões do provedor.
 */
let transporterCache: Transporter | null = null

function getTransporter(): Transporter {
  if (transporterCache) return transporterCache
  transporterCache = createTransport({
    host: env.MAIL_SMTP_HOST,
    port: env.MAIL_SMTP_PORT,
    // `secure` verdadeiro é TLS direto (porta 465). Falso na 587 não significa
    // texto puro: o nodemailer sobe para TLS via STARTTLS, e `requireTLS`
    // garante que a mensagem não parta se essa negociação falhar.
    secure: env.MAIL_SMTP_SECURE,
    requireTLS: !env.MAIL_SMTP_SECURE,
    auth: { user: env.MAIL_SMTP_USER, pass: env.MAIL_SMTP_PASSWORD },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return transporterCache
}

async function sendViaSmtp(message: MailMessage): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
    })
    // Só o endereço mascarado vai para o log: o corpo pode conter o link de
    // redefinição de senha, que é credencial de uso único.
    logger.info('e-mail enviado (transporte smtp)', {
      to: maskEmail(message.to),
      subject: message.subject,
    })
  } catch (error) {
    // Uma falha aqui derruba a conexão em pool; descartá-la força a próxima
    // tentativa a abrir uma sessão nova em vez de reusar uma quebrada.
    transporterCache = null
    logger.error('falha ao enviar e-mail por smtp', {
      to: maskEmail(message.to),
      subject: message.subject,
      error,
    })
    throw new Error('Não foi possível enviar o e-mail agora. Tente novamente em instantes.')
  }
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
