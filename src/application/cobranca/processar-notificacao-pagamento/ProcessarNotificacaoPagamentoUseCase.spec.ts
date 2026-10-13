import { Logger } from '@nestjs/common';

import { Cenario, criarCenario, OS } from '../../../../test/fakes/cenario';
import { Cobranca, StatusCobranca } from '../../../domain/cobranca/entities/Cobranca';
import { UniqueID } from '../../../domain/shared/UniqueID';
import { BILLING_EVENTS } from '../../billing-messages';
import { ProcessarNotificacaoPagamentoUseCase } from './ProcessarNotificacaoPagamentoUseCase';

describe('ProcessarNotificacaoPagamentoUseCase', () => {
  let c: Cenario;
  let useCase: ProcessarNotificacaoPagamentoUseCase;
  let cobrancaId: string;
  let loggerError: jest.SpyInstance;

  const statusAtual = async () => (await c.cobrancas.buscarPorId(cobrancaId))!.status;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    c = criarCenario();
    useCase = new ProcessarNotificacaoPagamentoUseCase(
      c.transacao,
      c.cobrancas,
      c.pagamentos,
      c.outbox,
      c.gateway,
    );
    const cobranca = Cobranca.criar(
      {
        osId: OS,
        orcamentoId: '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d11',
        valor: 165.5,
        preferenceId: 'p',
        initPoint: 'https://mp.test/checkout/1',
      },
      new UniqueID(),
    );
    cobrancaId = cobranca.id.toValue();
    await c.cobrancas.salvar(cobranca);
  });

  afterEach(() => jest.restoreAllMocks());

  it('aprovado confirma a cobrança, registra o pagamento e publica pagamento-confirmado', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5 });
    await useCase.execute('mp-1');

    expect(await statusAtual()).toBe(StatusCobranca.PAGA);
    expect(c.pagamentos.registros.get('mp-1')).toMatchObject({ cobrancaId, status: 'approved' });
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.PAGAMENTO_CONFIRMADO,
      correlationId: OS,
      payload: { osId: OS, cobrancaId, mpPaymentId: 'mp-1', valor: 165.5 },
    });
  });

  it('recusado marca RECUSADA e publica o motivo', async () => {
    c.gateway.pagar('mp-1', {
      referenciaExterna: cobrancaId,
      valor: 165.5,
      status: 'rejected',
      statusDetail: 'cc_rejected_other_reason',
    });
    await useCase.execute('mp-1');
    expect(await statusAtual()).toBe(StatusCobranca.RECUSADA);
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.PAGAMENTO_RECUSADO,
      payload: { motivo: 'cc_rejected_other_reason' },
    });
  });

  it('pendente só fica registrado', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5, status: 'in_process' });
    await useCase.execute('mp-1');
    expect(await statusAtual()).toBe(StatusCobranca.PENDENTE);
    expect(c.pagamentos.registros.has('mp-1')).toBe(true);
    expect(c.outbox.mensagens).toHaveLength(0);
  });

  it('notificação repetida não publica de novo', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5 });
    await useCase.execute('mp-1');
    await useCase.execute('mp-1');
    expect(c.outbox.mensagens).toHaveLength(1);
  });

  it('aprovado depois de recusado no mesmo link confirma', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5, status: 'rejected' });
    c.gateway.pagar('mp-2', { referenciaExterna: cobrancaId, valor: 165.5 });
    await useCase.execute('mp-1');
    await useCase.execute('mp-2');
    expect(await statusAtual()).toBe(StatusCobranca.PAGA);
    expect(c.outbox.tipos()).toEqual([
      BILLING_EVENTS.PAGAMENTO_RECUSADO,
      BILLING_EVENTS.PAGAMENTO_CONFIRMADO,
    ]);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('aprovado em cobrança recusada quando a OS já tem outra paga confirma e alerta estorno manual', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5, status: 'rejected' });
    await useCase.execute('mp-1');
    const outra = Cobranca.criar(
      {
        osId: OS,
        orcamentoId: '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d11',
        valor: 165.5,
        preferenceId: 'p2',
        initPoint: 'https://mp.test/checkout/2',
      },
      new UniqueID(),
    );
    outra.confirmar('mp-outra');
    await c.cobrancas.salvar(outra);

    c.gateway.pagar('mp-2', { referenciaExterna: cobrancaId, valor: 165.5 });
    await useCase.execute('mp-2');

    expect(await statusAtual()).toBe(StatusCobranca.PAGA);
    expect(c.outbox.tipos()).toContain(BILLING_EVENTS.PAGAMENTO_CONFIRMADO);
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Segundo pagamento aprovado na mesma OS (estorno manual)',
        osId: OS,
        cobrancaId,
        outraCobrancaId: outra.id.toValue(),
        mpPaymentId: 'mp-2',
      }),
    );
  });

  it('recusa depois de pago é ignorada', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5 });
    c.gateway.pagar('mp-2', { referenciaExterna: cobrancaId, valor: 165.5, status: 'rejected' });
    await useCase.execute('mp-1');
    await useCase.execute('mp-2');
    expect(await statusAtual()).toBe(StatusCobranca.PAGA);
    expect(c.outbox.mensagens).toHaveLength(1);
  });

  it('valor pago menor que a cobrança não confirma', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 1 });
    await useCase.execute('mp-1');
    expect(await statusAtual()).toBe(StatusCobranca.PENDENTE);
    expect(c.outbox.mensagens).toHaveLength(0);
  });

  it('pagamento sem cobrança correspondente é ignorado', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: null, valor: 10 });
    c.gateway.pagar('mp-2', { referenciaExterna: 'nao-existe', valor: 10 });
    await useCase.execute('mp-1');
    await useCase.execute('mp-2');
    expect(c.outbox.mensagens).toHaveLength(0);
    expect(c.pagamentos.registros.size).toBe(0);
  });
});
