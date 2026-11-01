import { lerNotificacaoConfig } from './notificacao.config';

describe('lerNotificacaoConfig', () => {
  it('padrão é console, sem remetente', () => {
    expect(lerNotificacaoConfig({})).toEqual({ notificador: 'console', remetente: '' });
    expect(lerNotificacaoConfig({ NOTIFICADOR: '' })).toEqual({
      notificador: 'console',
      remetente: '',
    });
  });

  it('lê o SES e o remetente', () => {
    expect(
      lerNotificacaoConfig({ NOTIFICADOR: 'ses', SES_REMETENTE: 'oficina@example.com' }),
    ).toEqual({ notificador: 'ses', remetente: 'oficina@example.com' });
  });
});
