import { Logger } from '@nestjs/common';

import { ConsoleNotificador } from './console-notificador';

describe('ConsoleNotificador', () => {
  it('registra o e-mail no log', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await new ConsoleNotificador().enviar({ para: 'a@b.com', assunto: 'Oi', corpo: 'link' });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'a@b.com', assunto: 'Oi', corpo: 'link' }),
    );
    log.mockRestore();
  });
});
