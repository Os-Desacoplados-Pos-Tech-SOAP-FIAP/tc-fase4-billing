import { lerPaymentConfig } from './payment.config';

describe('lerPaymentConfig', () => {
  it('padrão é fake com a API pública do Mercado Pago', () => {
    expect(lerPaymentConfig({})).toEqual({
      provider: 'fake',
      accessToken: '',
      webhookSecret: '',
      notificationUrl: '',
      apiUrl: 'https://api.mercadopago.com',
    });
  });

  it('lê as variáveis do Mercado Pago', () => {
    expect(
      lerPaymentConfig({
        PAYMENT_PROVIDER: 'mercadopago',
        MP_ACCESS_TOKEN: 'a',
        MP_WEBHOOK_SECRET: 'b',
        MP_NOTIFICATION_URL: 'https://x/hook',
        MP_API_URL: 'http://mock',
      }),
    ).toEqual({
      provider: 'mercadopago',
      accessToken: 'a',
      webhookSecret: 'b',
      notificationUrl: 'https://x/hook',
      apiUrl: 'http://mock',
    });
  });
});
