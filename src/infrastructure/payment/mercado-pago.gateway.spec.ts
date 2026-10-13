import { RecursoNaoEncontradoError } from '../../application/errors';
import { MercadoPagoGateway } from './mercado-pago.gateway';
import { PaymentConfig } from './payment.config';

const config: PaymentConfig = {
  provider: 'mercadopago',
  accessToken: 'TOKEN-TESTE',
  webhookSecret: 's',
  notificationUrl: 'https://api.exemplo.com/api/billing/webhooks/mercadopago',
  apiUrl: 'https://mp.test',
};

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

describe('MercadoPagoGateway', () => {
  it('cria a preferência do Checkout Pro com referência, notificação e idempotência', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      resposta({ id: 'pref-1', init_point: 'https://mp/checkout?pref=pref-1' }),
    );
    const gateway = new MercadoPagoGateway(config, fetcher);

    const preferencia = await gateway.criarPreferencia({
      cobrancaId: 'c-1',
      osId: 'os-1',
      numeroOs: 42,
      valor: 165.5,
    });

    expect(preferencia).toEqual({ preferenceId: 'pref-1', initPoint: 'https://mp/checkout?pref=pref-1' });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://mp.test/checkout/preferences');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer TOKEN-TESTE',
      'X-Idempotency-Key': 'c-1',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      items: [
        { id: 'os-1', title: 'Ordem de serviço #42', quantity: 1, unit_price: 165.5, currency_id: 'BRL' },
      ],
      external_reference: 'c-1',
      notification_url: config.notificationUrl,
    });
  });

  it('consulta o pagamento e traduz os campos', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      resposta({
        id: 987,
        status: 'approved',
        status_detail: 'accredited',
        external_reference: 'c-1',
        transaction_amount: 165.5,
      }),
    );
    const pagamento = await new MercadoPagoGateway(config, fetcher).consultarPagamento('987');
    expect(fetcher.mock.calls[0][0]).toBe('https://mp.test/v1/payments/987');
    expect(pagamento).toMatchObject({
      id: '987',
      status: 'approved',
      statusDetail: 'accredited',
      referenciaExterna: 'c-1',
      valor: 165.5,
    });
  });

  it('referência vazia e detalhe ausente viram null', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      resposta({ id: 1, status: 'pending', external_reference: '', transaction_amount: 1 }),
    );
    const pagamento = await new MercadoPagoGateway(config, fetcher).consultarPagamento('1');
    expect(pagamento.referenciaExterna).toBeNull();
    expect(pagamento.statusDetail).toBeNull();
  });

  it('erro HTTP vira exceção sem expor o token', async () => {
    const fetcher = jest.fn().mockResolvedValue(resposta({ message: 'unauthorized' }, 401));
    const chamada = new MercadoPagoGateway(config, fetcher).consultarPagamento('1');
    await expect(chamada).rejects.toThrow('Mercado Pago respondeu 401');
    await expect(chamada).rejects.not.toThrow('TOKEN-TESTE');
  });

  it('pagamento inexistente (404) vira RecursoNaoEncontradoError', async () => {
    const fetcher = jest.fn().mockResolvedValue(resposta({ message: 'not found' }, 404));
    const chamada = new MercadoPagoGateway(config, fetcher).consultarPagamento('999');
    await expect(chamada).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
  });

  it('404 na criação da preferência é erro genérico, não recurso inexistente', async () => {
    const fetcher = jest.fn().mockResolvedValue(resposta({ message: 'not found' }, 404));
    const chamada = new MercadoPagoGateway(config, fetcher).criarPreferencia({
      cobrancaId: 'c-1',
      osId: 'os-1',
      numeroOs: 42,
      valor: 10,
    });
    await expect(chamada).rejects.toThrow('Mercado Pago respondeu 404 em /checkout/preferences');
    await expect(chamada).rejects.not.toBeInstanceOf(RecursoNaoEncontradoError);
  });
});
