import { Logger } from '@nestjs/common';

import { Cenario, criarCenario, OS, payloadOrcamento } from '../../../../test/fakes/cenario';
import { Cobranca, StatusCobranca } from '../../../domain/cobranca/entities/Cobranca';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { UniqueID } from '../../../domain/shared/UniqueID';
import { BILLING_EVENTS } from '../../billing-messages';
import { RecursoNaoEncontradoError } from '../../errors';
import { GerarCobrancaUseCase } from './GerarCobrancaUseCase';

describe('GerarCobrancaUseCase', () => {
  let c: Cenario;
  let useCase: GerarCobrancaUseCase;
  let orcamento: Orcamento;
  const comando = (messageId = 'cob-1') => ({ messageId, correlationId: OS });

  const gravarCobranca = async (status?: 'PAGA' | 'RECUSADA') => {
    const cobranca = Cobranca.criar(
      {
        osId: OS,
        orcamentoId: orcamento.id.toValue(),
        valor: 165.5,
        preferenceId: 'pref-antiga',
        initPoint: 'https://mp.test/checkout/antigo',
      },
      new UniqueID(),
    );
    if (status === 'PAGA') cobranca.confirmar('mp-1');
    if (status === 'RECUSADA') cobranca.recusar('mp-1');
    await c.cobrancas.salvar(cobranca);
    return cobranca;
  };

  beforeEach(async () => {
    c = criarCenario();
    useCase = new GerarCobrancaUseCase(
      c.transacao,
      c.processadas,
      c.orcamentos,
      c.cobrancas,
      c.outbox,
      c.gateway,
      c.notificador,
    );
    orcamento = Orcamento.criar({
      osId: OS,
      ...payloadOrcamento(),
      validoAte: new Date('2026-10-22T10:00:00Z'),
      tokenHash: 'h',
    });
    orcamento.aprovar(c.relogio.agora());
    await c.orcamentos.salvar(orcamento);
  });

  it('cria a preferência com o id da cobrança, grava PENDENTE, publica e envia o link', async () => {
    await useCase.execute(comando());

    expect(c.gateway.preferencias).toHaveLength(1);
    const { cobrancaId } = c.gateway.preferencias[0];
    expect(c.gateway.preferencias[0]).toMatchObject({ osId: OS, numeroOs: 42, valor: 165.5 });
    const cobranca = (await c.cobrancas.buscarPorId(cobrancaId))!;
    expect(cobranca.status).toBe(StatusCobranca.PENDENTE);
    expect(cobranca.initPoint).toBe(`https://mp.test/checkout/${cobrancaId}`);
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.COBRANCA_GERADA,
      causationId: 'cob-1',
      payload: { osId: OS, cobrancaId, valor: 165.5, initPoint: cobranca.initPoint },
    });
    expect(c.notificador.emails[0].corpo).toContain(cobranca.initPoint);
  });

  it('com cobrança pendente, reemite o link sem chamar o gateway', async () => {
    const pendente = await gravarCobranca();
    await useCase.execute(comando());
    expect(c.gateway.preferencias).toHaveLength(0);
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.COBRANCA_GERADA,
      payload: { cobrancaId: pendente.id.toValue() },
    });
  });

  it('com cobrança já paga, reemite pagamento-confirmado', async () => {
    await gravarCobranca('PAGA');
    await useCase.execute(comando());
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.PAGAMENTO_CONFIRMADO,
      payload: { mpPaymentId: 'mp-1' },
    });
  });

  it('pendente lida fora da transação que já virou paga reemite pagamento-confirmado', async () => {
    const pendente = await gravarCobranca();
    jest.spyOn(c.cobrancas, 'buscarPendentePorOs').mockImplementationOnce(async () => {
      const lida = (await c.cobrancas.buscarPorId(pendente.id.toValue()))!;
      const paga = (await c.cobrancas.buscarPorId(pendente.id.toValue()))!;
      paga.confirmar('mp-1');
      await c.cobrancas.salvar(paga);
      return lida;
    });
    await useCase.execute(comando());
    expect(c.outbox.mensagens).toHaveLength(1);
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.PAGAMENTO_CONFIRMADO,
      payload: { cobrancaId: pendente.id.toValue(), mpPaymentId: 'mp-1' },
    });
  });

  it('pendente lida fora da transação que já virou recusada não publica e registra a mensagem', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const pendente = await gravarCobranca();
    jest.spyOn(c.cobrancas, 'buscarPendentePorOs').mockImplementationOnce(async () => {
      const lida = (await c.cobrancas.buscarPorId(pendente.id.toValue()))!;
      const recusada = (await c.cobrancas.buscarPorId(pendente.id.toValue()))!;
      recusada.recusar('mp-1');
      await c.cobrancas.salvar(recusada);
      return lida;
    });
    await useCase.execute(comando());
    expect(c.outbox.mensagens).toHaveLength(0);
    expect(c.processadas.ids.has('cob-1')).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ osId: OS, cobrancaId: pendente.id.toValue() }),
    );
    warn.mockRestore();
  });

  it('depois de uma recusa, gera nova cobrança (novo link)', async () => {
    await gravarCobranca('RECUSADA');
    await useCase.execute(comando('cob-2'));
    expect(c.gateway.preferencias).toHaveLength(1);
    expect(await c.cobrancas.listarPorOs(OS)).toHaveLength(2);
  });

  it('é idempotente por messageId', async () => {
    await useCase.execute(comando());
    await useCase.execute(comando());
    expect(c.gateway.preferencias).toHaveLength(1);
    expect(c.outbox.mensagens).toHaveLength(1);
    expect(c.notificador.emails).toHaveLength(1);
  });

  it('exige orçamento aprovado', async () => {
    const outra = '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d99';
    await expect(useCase.execute({ messageId: 'x', correlationId: outra })).rejects.toBeInstanceOf(
      RecursoNaoEncontradoError,
    );
    await c.orcamentos.salvar(
      Orcamento.criar({
        osId: outra,
        ...payloadOrcamento(43),
        validoAte: new Date('2026-10-22T10:00:00Z'),
        tokenHash: 'h',
      }),
    );
    await expect(useCase.execute({ messageId: 'y', correlationId: outra })).rejects.toMatchObject({
      code: 'ORCAMENTO_NAO_APROVADO',
    });
  });

  it('falha no gateway propaga (mensagem volta à fila) e nada é gravado', async () => {
    c.gateway.falharCriacao = true;
    await expect(useCase.execute(comando())).rejects.toThrow('gateway indisponível');
    expect(await c.cobrancas.listarPorOs(OS)).toHaveLength(0);
    expect(c.processadas.ids.size).toBe(0);
  });
});
