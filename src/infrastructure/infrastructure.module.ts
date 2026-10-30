import { SESv2Client } from '@aws-sdk/client-sesv2';
import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import { INJECTION_TOKENS } from '../common/constants/injection-tokens';
import { lerConfigBilling } from '../config/billing.config';
import { JwtStrategy } from './auth/jwt.strategy';
import { DatabaseModule } from './database/database.module';
import { PrismaTransactionManager } from './database/prisma-transaction.manager';
import { MESSAGING_CONFIG, MessagingConfig } from './messaging/messaging.config';
import { MessagingModule } from './messaging/messaging.module';
import { ConsoleNotificador } from './notificacao/console-notificador';
import {
  lerNotificacaoConfig,
  NOTIFICACAO_CONFIG,
  NotificacaoConfig,
} from './notificacao/notificacao.config';
import { SesNotificador } from './notificacao/ses-notificador';
import { FakePaymentGateway } from './payment/fake-payment.gateway';
import { MercadoPagoGateway } from './payment/mercado-pago.gateway';
import { lerPaymentConfig, PAYMENT_CONFIG, PaymentConfig } from './payment/payment.config';
import { relogioSistema } from './relogio-sistema';
import { PrismaCobrancaRepository } from './repositories/PrismaCobrancaRepository';
import { PrismaOrcamentoRepository } from './repositories/PrismaOrcamentoRepository';
import { PrismaOutbox } from './repositories/PrismaOutbox';
import { PrismaPagamentoRepository } from './repositories/PrismaPagamentoRepository';
import { PrismaProcessedMessageRepository } from './repositories/PrismaProcessedMessageRepository';

/**
 * Só a região vem da config AWS: o endpoint do LocalStack não vale para o SES. Timeout curto
 * porque o envio roda depois do commit, ainda dentro do tratamento da mensagem/requisição.
 */
const criarSesNotificador = (config: NotificacaoConfig, aws: MessagingConfig) =>
  new SesNotificador(
    new SESv2Client({
      region: aws.region,
      maxAttempts: 2,
      requestHandler: new NodeHttpHandler({ requestTimeout: 5000, connectionTimeout: 2000 }),
    }),
    config.remetente,
  );

const bindings = [
  { provide: INJECTION_TOKENS.ORCAMENTO_REPOSITORY, useClass: PrismaOrcamentoRepository },
  { provide: INJECTION_TOKENS.COBRANCA_REPOSITORY, useClass: PrismaCobrancaRepository },
  { provide: INJECTION_TOKENS.PAGAMENTO_REPOSITORY, useClass: PrismaPagamentoRepository },
  {
    provide: INJECTION_TOKENS.PROCESSED_MESSAGE_REPOSITORY,
    useClass: PrismaProcessedMessageRepository,
  },
  { provide: INJECTION_TOKENS.OUTBOX, useClass: PrismaOutbox },
  { provide: INJECTION_TOKENS.TRANSACTION_MANAGER, useExisting: PrismaTransactionManager },
  {
    provide: INJECTION_TOKENS.NOTIFICADOR,
    inject: [NOTIFICACAO_CONFIG, MESSAGING_CONFIG],
    useFactory: (config: NotificacaoConfig, aws: MessagingConfig) =>
      config.notificador === 'ses' ? criarSesNotificador(config, aws) : new ConsoleNotificador(),
  },
  { provide: INJECTION_TOKENS.RELOGIO, useValue: relogioSistema },
  { provide: INJECTION_TOKENS.CONFIG_BILLING, useFactory: () => lerConfigBilling(process.env) },
  {
    provide: INJECTION_TOKENS.PAYMENT_GATEWAY,
    inject: [PAYMENT_CONFIG, FakePaymentGateway],
    useFactory: (config: PaymentConfig, fake: FakePaymentGateway) =>
      config.provider === 'mercadopago' ? new MercadoPagoGateway(config) : fake,
  },
  { provide: INJECTION_TOKENS.SIMULADOR_PAGAMENTO, useExisting: FakePaymentGateway },
];

@Global()
@Module({
  imports: [DatabaseModule, MessagingModule, PassportModule],
  providers: [
    ...bindings,
    { provide: PAYMENT_CONFIG, useFactory: () => lerPaymentConfig(process.env) },
    { provide: NOTIFICACAO_CONFIG, useFactory: () => lerNotificacaoConfig(process.env) },
    FakePaymentGateway,
    JwtStrategy,
  ],
  exports: [...bindings.map((binding) => binding.provide), PAYMENT_CONFIG, FakePaymentGateway],
})
export class InfrastructureModule {}
