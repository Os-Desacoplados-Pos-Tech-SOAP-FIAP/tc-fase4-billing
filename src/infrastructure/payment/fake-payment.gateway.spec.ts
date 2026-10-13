import { RecursoNaoEncontradoError } from '../../application/errors';
import { FakePaymentGateway } from './fake-payment.gateway';

describe('FakePaymentGateway', () => {
  const gateway = new FakePaymentGateway({
    validadeOrcamentoHoras: 48,
    urlPublica: 'http://localhost:3004',
    intervaloExpiracaoMs: 0,
    pagamentoFake: true,
  });

  it('cria preferência apontando para a rota de simulação', async () => {
    const preferencia = await gateway.criarPreferencia({
      cobrancaId: 'c-1',
      osId: 'os-1',
      numeroOs: 1,
      valor: 10,
    });
    expect(preferencia).toEqual({
      preferenceId: 'fake-pref-c-1',
      initPoint: 'http://localhost:3004/api/billing/dev/pagamentos/os-1/simular',
    });
  });

  it('registra pagamentos aprovados e recusados e os devolve na consulta', async () => {
    const aprovado = gateway.registrarPagamento({ referenciaExterna: 'c-1', valor: 10, aprovado: true });
    const recusado = gateway.registrarPagamento({ referenciaExterna: 'c-1', valor: 10, aprovado: false });
    expect(await gateway.consultarPagamento(aprovado)).toMatchObject({
      status: 'approved',
      referenciaExterna: 'c-1',
      valor: 10,
    });
    expect(await gateway.consultarPagamento(recusado)).toMatchObject({
      status: 'rejected',
      statusDetail: 'cc_rejected_other_reason',
    });
  });

  it('pagamento desconhecido é 404', async () => {
    await expect(gateway.consultarPagamento('x')).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
  });
});
