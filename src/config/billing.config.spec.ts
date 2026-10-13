import { lerConfigBilling } from './billing.config';

describe('lerConfigBilling', () => {
  it('usa padrões quando nada é informado', () => {
    expect(lerConfigBilling({})).toEqual({
      validadeOrcamentoHoras: 48,
      urlPublica: 'http://localhost:3004',
      intervaloExpiracaoMs: 60_000,
      pagamentoFake: true,
    });
  });

  it('lê os valores informados e tira a barra final da URL', () => {
    expect(
      lerConfigBilling({
        ORCAMENTO_VALIDADE_HORAS: '2',
        PUBLIC_BASE_URL: 'https://api.exemplo.com/',
        ORCAMENTO_EXPIRACAO_INTERVALO_MS: '0',
        PAYMENT_PROVIDER: 'mercadopago',
      }),
    ).toEqual({
      validadeOrcamentoHoras: 2,
      urlPublica: 'https://api.exemplo.com',
      intervaloExpiracaoMs: 0,
      pagamentoFake: false,
    });
  });
});
