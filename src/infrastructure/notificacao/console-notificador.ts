import { Injectable, Logger } from '@nestjs/common';

import { Email, INotificador } from '../../application/ports/notificador';

/**
 * Envio simulado (decisão D3 do plano): o e-mail vira log estruturado, com o link, para a
 * demonstração. Trocar por SES é só implementar INotificador e mudar o binding.
 */
@Injectable()
export class ConsoleNotificador implements INotificador {
  private readonly logger = new Logger('Email');

  async enviar(email: Email): Promise<void> {
    this.logger.log({
      msg: 'E-mail enviado (simulado)',
      para: email.para,
      assunto: email.assunto,
      corpo: email.corpo,
    });
  }
}
