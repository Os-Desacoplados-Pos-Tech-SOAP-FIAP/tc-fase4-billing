import { Logger } from '@nestjs/common';

import { Email, INotificador } from './ports/notificador';

/** E-mail é efeito colateral depois do commit: falha vira log, nunca exceção. */
export async function notificarSemFalhar(
  notificador: INotificador,
  email: Email,
  logger: Logger,
  osId: string,
): Promise<void> {
  try {
    await notificador.enviar(email);
  } catch (erro) {
    logger.error({
      msg: 'Falha ao enviar e-mail ao cliente',
      osId,
      assunto: email.assunto,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
  }
}
