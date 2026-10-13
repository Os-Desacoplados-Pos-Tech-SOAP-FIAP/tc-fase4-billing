import { validarAmbiente } from './env.validation';

const BASE = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 's', MESSAGING_ENABLED: 'false' };

describe('validarAmbiente', () => {
  it('aceita o mínimo com pagamento fake (padrão)', () => {
    expect(validarAmbiente(BASE)).toBe(BASE);
  });

  it('exige variáveis de mensageria quando ligada', () => {
    expect(() => validarAmbiente({ ...BASE, MESSAGING_ENABLED: 'true' })).toThrow(
      'INBOX_QUEUE_URL, EVENTS_TOPIC_ARN',
    );
  });

  it('exige DATABASE_URL e JWT_SECRET', () => {
    expect(() => validarAmbiente({ MESSAGING_ENABLED: 'false' })).toThrow('DATABASE_URL, JWT_SECRET');
  });

  it('exige credenciais do Mercado Pago quando o provedor é mercadopago', () => {
    expect(() => validarAmbiente({ ...BASE, PAYMENT_PROVIDER: 'mercadopago' })).toThrow(
      'MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_NOTIFICATION_URL',
    );
    const completo = {
      ...BASE,
      PAYMENT_PROVIDER: 'mercadopago',
      MP_ACCESS_TOKEN: 'a',
      MP_WEBHOOK_SECRET: 'b',
      MP_NOTIFICATION_URL: 'https://x/api/billing/webhooks/mercadopago',
    };
    expect(validarAmbiente(completo)).toBe(completo);
  });

  it('rejeita provedor desconhecido', () => {
    expect(() => validarAmbiente({ ...BASE, PAYMENT_PROVIDER: 'pix' })).toThrow('PAYMENT_PROVIDER');
  });

  it('rejeita validade e intervalo inválidos', () => {
    expect(() => validarAmbiente({ ...BASE, ORCAMENTO_VALIDADE_HORAS: '0' })).toThrow(
      'ORCAMENTO_VALIDADE_HORAS',
    );
    expect(() => validarAmbiente({ ...BASE, ORCAMENTO_EXPIRACAO_INTERVALO_MS: '-1' })).toThrow(
      'ORCAMENTO_EXPIRACAO_INTERVALO_MS',
    );
    expect(validarAmbiente({ ...BASE, ORCAMENTO_EXPIRACAO_INTERVALO_MS: '0' })).toBeDefined();
  });
});
