export const PAYMENT_CONFIG = Symbol('PaymentConfig');

export interface PaymentConfig {
  provider: 'fake' | 'mercadopago';
  accessToken: string;
  webhookSecret: string;
  /** Vai em cada preferência e tem prioridade sobre a URL do painel do Mercado Pago. */
  notificationUrl: string;
  apiUrl: string;
}

export function lerPaymentConfig(env: NodeJS.ProcessEnv): PaymentConfig {
  return {
    provider: env.PAYMENT_PROVIDER === 'mercadopago' ? 'mercadopago' : 'fake',
    accessToken: env.MP_ACCESS_TOKEN ?? '',
    webhookSecret: env.MP_WEBHOOK_SECRET ?? '',
    notificationUrl: env.MP_NOTIFICATION_URL ?? '',
    apiUrl: env.MP_API_URL || 'https://api.mercadopago.com',
  };
}
