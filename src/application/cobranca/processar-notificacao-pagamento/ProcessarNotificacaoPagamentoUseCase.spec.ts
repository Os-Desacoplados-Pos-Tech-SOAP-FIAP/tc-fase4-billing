import { Logger } from '@nestjs/common';

import { Cenario, criarCenario, OS, payloadOrcamento } from '../../../../test/fakes/cenario';
import { Cobranca, StatusCobranca } from '../../../domain/cobranca/entities/Cobranca';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { UniqueID } from '../../../domain/shared/UniqueID';
import { BILLING_EVENTS } from '../../billing-messages';
import { ProcessarNotificacaoPagamentoUseCase } from './ProcessarNotificacaoPagamentoUseCase';

describe('ProcessarNotificacaoPagamentoUseCase', () => {
  let c: Cenario;
  let useCase: ProcessarNotificacaoPagamentoUseCase;
  let cobrancaId: string;
  let loggerError: jest.SpyInstance;
  let loggerWarn: jest.SpyInstance;

  const statusAtual = async () => (await c.cobrancas.buscarPorId(cobrancaId))!.status;

  beforeEach(async () => {
    loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    c = criarCenario();
    useCase = new ProcessarNotificacaoPagamentoUseCase(
      c.transacao,
      c.cobrancas,
      c.pagamentos,
      c.outbox,
      c.gateway,
      c.orcamentos,
      c.notificador,
    );
    await c.orcamentos.salvar(
      Orcamento.criar({
        osId: OS,
        ...payloadOrcamento(),
        validoAte: new Date('2026-10-22T10:00:00Z'),
        tokenHash: 'h',
      }),
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

  it('aprovado na cobrança pendente quando a recusada já foi paga depois (D7) confirma e alerta estorno manual', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5, status: 'rejected' });
    await useCase.execute('mp-1');
    const nova = Cobranca.criar(
      {
        osId: OS,
        orcamentoId: '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d11',
        valor: 165.5,
        preferenceId: 'p2',
        initPoint: 'https://mp.test/checkout/2',
      },
      new UniqueID(),
    );
    await c.cobrancas.salvar(nova);
    const novaId = nova.id.toValue();

    c.gateway.pagar('mp-2', { referenciaExterna: cobrancaId, valor: 165.5 });
    await useCase.execute('mp-2');
    expect(await statusAtual()).toBe(StatusCobranca.PAGA);
    expect(loggerError).not.toHaveBeenCalled();

    c.gateway.pagar('mp-3', { referenciaExterna: novaId, valor: 165.5 });
    await useCase.execute('mp-3');

    expect((await c.cobrancas.buscarPorId(novaId))!.status).toBe(StatusCobranca.PAGA);
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Segundo pagamento aprovado na mesma OS (estorno manual)',
        osId: OS,
        cobrancaId: novaId,
        outraCobrancaId: cobrancaId,
        mpPaymentId: 'mp-3',
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
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ cobrancaId, mpPaymentId: 'mp-1', valorPago: 1, valorCobrado: 165.5 }),
    );
    expect(c.pagamentos.registros.get('mp-1')).toMatchObject({ cobrancaId, status: 'approved' });
  });

  it('pagamento sem cobrança correspondente é ignorado', async () => {
    c.gateway.pagar('mp-1', { referenciaExterna: null, valor: 10 });
    c.gateway.pagar('mp-2', { referenciaExterna: 'nao-existe', valor: 10 });
    await useCase.execute('mp-1');
    await useCase.execute('mp-2');
    expect(c.outbox.mensagens).toHaveLength(0);
    expect(c.pagamentos.registros.size).toBe(0);
  });

  it('pagamento inexistente no gateway é ignorado com aviso, sem erro', async () => {
    await expect(useCase.execute('mp-fantasma')).resolves.toBeUndefined();
    expect(loggerWarn).toHaveBeenCalledWith({
      msg: 'Pagamento inexistente no gateway; ignorado',
      mpPaymentId: 'mp-fantasma',
    });
    expect(c.outbox.mensagens).toHaveLength(0);
    expect(c.pagamentos.registros.size).toBe(0);
  });

  it('outros erros do gateway continuam propagando', async () => {
    jest.spyOn(c.gateway, 'consultarPagamento').mockRejectedValueOnce(new Error('mp fora'));
    await expect(useCase.execute('mp-1')).rejects.toThrow('mp fora');
  });

  describe('e-mail ao cliente', () => {
    it('aprovado avisa o cliente do orçamento com o valor pago', async () => {
      c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5 });
      await useCase.execute('mp-1');
      expect(c.notificador.emails).toHaveLength(1);
      expect(c.notificador.emails[0]).toMatchObject({
        para: 'maria@example.com',
        assunto: expect.stringContaining('#42'),
      });
      expect(c.notificador.emails[0].assunto).toContain('confirmado');
      expect(c.notificador.emails[0].corpo).toMatch(/R\$\s165,50/);
    });

    it('recusado avisa a recusa e o novo link', async () => {
      c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5, status: 'rejected' });
      await useCase.execute('mp-1');
      expect(c.notificador.emails).toHaveLength(1);
      expect(c.notificador.emails[0].para).toBe('maria@example.com');
      expect(c.notificador.emails[0].assunto).toContain('recusado');
      expect(c.notificador.emails[0].corpo).toContain('novo link de pagamento');
    });

    it('pendente, valor menor, notificação repetida e recusa ignorada não enviam e-mail', async () => {
      const pagar = (id: string, valor: number, status = 'approved') =>
        c.gateway.pagar(id, { referenciaExterna: cobrancaId, valor, status });
      pagar('mp-1', 165.5, 'in_process');
      pagar('mp-2', 1);
      pagar('mp-3', 165.5);
      pagar('mp-4', 165.5, 'rejected');
      for (const id of ['mp-1', 'mp-2', 'mp-3', 'mp-3', 'mp-4']) {
        await useCase.execute(id);
      }
      expect(c.notificador.emails).toHaveLength(1);
      expect(c.notificador.emails[0].assunto).toContain('confirmado');
    });

    it('falha no envio vira log e não desfaz a confirmação', async () => {
      c.notificador.falhar = true;
      c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5 });
      await expect(useCase.execute('mp-1')).resolves.toBeUndefined();
      expect(await statusAtual()).toBe(StatusCobranca.PAGA);
      expect(c.outbox.tipos()).toEqual([BILLING_EVENTS.PAGAMENTO_CONFIRMADO]);
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'Falha ao enviar e-mail ao cliente', osId: OS }),
      );
    });

    it('sem orçamento da OS confirma sem e-mail e avisa no log', async () => {
      jest.spyOn(c.orcamentos, 'buscarPorOs').mockResolvedValue(null);
      c.gateway.pagar('mp-1', { referenciaExterna: cobrancaId, valor: 165.5 });
      await useCase.execute('mp-1');
      expect(await statusAtual()).toBe(StatusCobranca.PAGA);
      expect(c.notificador.emails).toHaveLength(0);
      expect(loggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Orçamento da OS não encontrado; e-mail não enviado',
          osId: OS,
        }),
      );
    });
  });
});
