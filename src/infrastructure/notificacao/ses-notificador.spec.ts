import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { mockClient } from 'aws-sdk-client-mock';

import { SesNotificador } from './ses-notificador';

describe('SesNotificador', () => {
  const ses = mockClient(SESv2Client);
  const notificador = new SesNotificador(new SESv2Client({}), 'oficina@example.com');
  const email = { para: 'cliente@example.com', assunto: 'Oi', corpo: 'linha 1\nlinha 2' };

  beforeEach(() => ses.reset());

  it('envia e-mail de texto simples do remetente configurado para o cliente', async () => {
    ses.on(SendEmailCommand).resolves({ MessageId: 'm-1' });
    await notificador.enviar(email);

    const chamadas = ses.commandCalls(SendEmailCommand);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].args[0].input).toEqual({
      FromEmailAddress: 'oficina@example.com',
      Destination: { ToAddresses: ['cliente@example.com'] },
      Content: {
        Simple: {
          Subject: { Data: 'Oi', Charset: 'UTF-8' },
          Body: { Text: { Data: 'linha 1\nlinha 2', Charset: 'UTF-8' } },
        },
      },
    });
  });

  it('propaga a falha do SES (quem chama transforma em log)', async () => {
    ses.on(SendEmailCommand).rejects(new Error('Email address is not verified'));
    await expect(notificador.enviar(email)).rejects.toThrow('Email address is not verified');
  });
});
