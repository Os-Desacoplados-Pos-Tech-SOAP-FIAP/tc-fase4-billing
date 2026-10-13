import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { INJECTION_TOKENS } from '../common/constants/injection-tokens';
import { InfrastructureModule } from './infrastructure.module';
import { FakePaymentGateway } from './payment/fake-payment.gateway';
import { MercadoPagoGateway } from './payment/mercado-pago.gateway';

/** O JwtStrategy lê o segredo do ConfigService, que no app vem do ConfigModule global. */
@Global()
@Module({
  providers: [{ provide: ConfigService, useValue: { getOrThrow: () => 'segredo-teste' } }],
  exports: [ConfigService],
})
class ConfigFalsoModule {}

describe('InfrastructureModule', () => {
  const compilar = () =>
    Test.createTestingModule({ imports: [ConfigFalsoModule, InfrastructureModule] }).compile();

  it.each(Object.entries(INJECTION_TOKENS))('resolve %s', async (_nome, token) => {
    const modulo = await compilar();
    expect(modulo.get(token)).toBeDefined();
  });

  it('usa o gateway fake por padrão', async () => {
    const modulo = await compilar();
    expect(modulo.get(INJECTION_TOKENS.PAYMENT_GATEWAY)).toBeInstanceOf(FakePaymentGateway);
  });

  it('com o provedor fake, gateway e simulador são a mesma instância', async () => {
    const modulo = await compilar();
    expect(modulo.get(INJECTION_TOKENS.PAYMENT_GATEWAY)).toBe(
      modulo.get(INJECTION_TOKENS.SIMULADOR_PAGAMENTO),
    );
  });

  it('usa o Mercado Pago quando PAYMENT_PROVIDER=mercadopago', async () => {
    const anterior = process.env.PAYMENT_PROVIDER;
    process.env.PAYMENT_PROVIDER = 'mercadopago';
    try {
      const modulo = await compilar();
      expect(modulo.get(INJECTION_TOKENS.PAYMENT_GATEWAY)).toBeInstanceOf(MercadoPagoGateway);
    } finally {
      if (anterior === undefined) delete process.env.PAYMENT_PROVIDER;
      else process.env.PAYMENT_PROVIDER = anterior;
    }
  });
});
