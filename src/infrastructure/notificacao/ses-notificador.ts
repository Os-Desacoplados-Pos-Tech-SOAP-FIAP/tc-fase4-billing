import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

import { Email, INotificador } from '../../application/ports/notificador';

/**
 * Envio real pelo Amazon SES (API v2): texto simples e, quando houver, a versão HTML. No sandbox só entrega para
 * endereços verificados. Falha propaga: notificarSemFalhar transforma em log.
 */
export class SesNotificador implements INotificador {
  constructor(
    private readonly ses: SESv2Client,
    private readonly remetente: string,
  ) {}

  async enviar(email: Email): Promise<void> {
    await this.ses.send(
      new SendEmailCommand({
        FromEmailAddress: this.remetente,
        Destination: { ToAddresses: [email.para] },
        Content: {
          Simple: {
            Subject: { Data: email.assunto, Charset: 'UTF-8' },
            Body: {
              Text: { Data: email.corpo, Charset: 'UTF-8' },
              ...(email.html ? { Html: { Data: email.html, Charset: 'UTF-8' } } : {}),
            },
          },
        },
      }),
    );
  }
}
