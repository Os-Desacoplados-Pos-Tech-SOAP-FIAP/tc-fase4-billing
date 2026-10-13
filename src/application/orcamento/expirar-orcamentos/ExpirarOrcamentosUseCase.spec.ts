import { Logger } from '@nestjs/common';

import { Cenario, criarCenario, payloadOrcamento } from '../../../../test/fakes/cenario';
import { Orcamento, StatusOrcamento } from '../../../domain/orcamento/entities/Orcamento';
import { BILLING_EVENTS } from '../../billing-messages';
import { ConcorrenciaError } from '../../errors';
import { ExpirarOrcamentosUseCase } from './ExpirarOrcamentosUseCase';

const OS_1 = '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d01';
const OS_2 = '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d02';
const OS_3 = '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d03';

describe('ExpirarOrcamentosUseCase', () => {
  let c: Cenario;
  let useCase: ExpirarOrcamentosUseCase;

  const gravar = (osId: string, numeroOs: number, validoAte: string) =>
    c.orcamentos.salvar(
      Orcamento.criar({
        osId,
        ...payloadOrcamento(numeroOs),
        validoAte: new Date(validoAte),
        tokenHash: 'h',
      }),
    );

  afterEach(() => jest.restoreAllMocks());

  beforeEach(async () => {
    c = criarCenario();
    useCase = new ExpirarOrcamentosUseCase(c.transacao, c.orcamentos, c.outbox, c.relogio);
    await gravar(OS_1, 1, '2026-10-20T08:00:00Z');
    await gravar(OS_2, 2, '2026-10-20T09:00:00Z');
    await gravar(OS_3, 3, '2026-10-21T09:00:00Z');
  });

  it('expira só os vencidos e publica orcamento-expirado de cada um', async () => {
    expect(await useCase.execute()).toBe(2);
    expect((await c.orcamentos.buscarPorOs(OS_1))!.status).toBe(StatusOrcamento.EXPIRADO);
    expect((await c.orcamentos.buscarPorOs(OS_3))!.status).toBe(StatusOrcamento.ENVIADO);
    expect(c.outbox.mensagens.map((m) => [m.type, m.correlationId])).toEqual([
      [BILLING_EVENTS.ORCAMENTO_EXPIRADO, OS_1],
      [BILLING_EVENTS.ORCAMENTO_EXPIRADO, OS_2],
    ]);
  });

  it('conflito com a decisão do cliente pula o orçamento sem derrubar o lote', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const salvar = c.orcamentos.salvar.bind(c.orcamentos);
    jest
      .spyOn(c.orcamentos, 'salvar')
      .mockRejectedValueOnce(new ConcorrenciaError('Orçamento'))
      .mockImplementation(salvar);
    expect(await useCase.execute()).toBe(1);
    expect(c.outbox.mensagens.map((m) => m.correlationId)).toEqual([OS_2]);
  });

  it('erro de infraestrutura não bloqueia os outros orçamentos e é relançado no fim', async () => {
    const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const salvar = c.orcamentos.salvar.bind(c.orcamentos);
    jest
      .spyOn(c.orcamentos, 'salvar')
      .mockRejectedValueOnce(new Error('banco fora'))
      .mockImplementation(salvar);
    await expect(useCase.execute()).rejects.toThrow('banco fora');
    expect((await c.orcamentos.buscarPorOs(OS_2))!.status).toBe(StatusOrcamento.EXPIRADO);
    expect(c.outbox.mensagens.map((m) => m.correlationId)).toEqual([OS_2]);
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ osId: OS_1, erro: 'Error: banco fora' }),
    );
  });
});
