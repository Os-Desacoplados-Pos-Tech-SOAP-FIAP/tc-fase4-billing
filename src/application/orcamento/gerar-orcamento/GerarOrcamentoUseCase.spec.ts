import { Logger } from '@nestjs/common';

import { Cenario, criarCenario, OS, payloadOrcamento } from '../../../../test/fakes/cenario';
import { StatusOrcamento } from '../../../domain/orcamento/entities/Orcamento';
import { DomainError } from '../../../domain/shared/DomainError';
import { BILLING_EVENTS } from '../../billing-messages';
import { tokenConfere } from '../token-aprovacao';
import { GerarOrcamentoUseCase } from './GerarOrcamentoUseCase';

describe('GerarOrcamentoUseCase', () => {
  let c: Cenario;
  let useCase: GerarOrcamentoUseCase;
  const comando = (messageId = 'cmd-1') => ({ messageId, correlationId: OS, ...payloadOrcamento() });

  beforeEach(() => {
    c = criarCenario();
    useCase = new GerarOrcamentoUseCase(
      c.transacao,
      c.processadas,
      c.orcamentos,
      c.outbox,
      c.notificador,
      c.relogio,
      c.config,
    );
  });

  it('cria o orçamento ENVIADO, publica orcamento-enviado e envia o link com token válido', async () => {
    await useCase.execute(comando());

    const orcamento = (await c.orcamentos.buscarPorOs(OS))!;
    expect(orcamento.status).toBe(StatusOrcamento.ENVIADO);
    expect(orcamento.valorTotal).toBe(165.5);
    expect(orcamento.validoAte).toEqual(new Date('2026-10-22T10:00:00.000Z'));
    expect(c.outbox.mensagens).toHaveLength(1);
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.ORCAMENTO_ENVIADO,
      correlationId: OS,
      causationId: 'cmd-1',
      payload: {
        osId: OS,
        orcamentoId: orcamento.id.toValue(),
        numeroOs: 42,
        valorTotal: 165.5,
        validoAte: '2026-10-22T10:00:00.000Z',
      },
    });
    expect(c.notificador.emails).toHaveLength(1);
    expect(c.notificador.emails[0].corpo).toContain(
      'http://billing.test/api/billing/publico/orcamentos/42?token=',
    );
    expect(tokenConfere(c.notificador.ultimoToken(), orcamento.tokenHash)).toBe(true);
  });

  it('é idempotente por messageId', async () => {
    await useCase.execute(comando());
    await useCase.execute(comando());
    expect(c.outbox.mensagens).toHaveLength(1);
    expect(c.notificador.emails).toHaveLength(1);
  });

  it('comando repetido com outro messageId reemite o evento sem novo e-mail', async () => {
    await useCase.execute(comando('cmd-1'));
    await useCase.execute(comando('cmd-2'));
    expect(c.outbox.tipos()).toEqual([
      BILLING_EVENTS.ORCAMENTO_ENVIADO,
      BILLING_EVENTS.ORCAMENTO_ENVIADO,
    ]);
    expect(c.outbox.mensagens[1].causationId).toBe('cmd-2');
    expect(c.notificador.emails).toHaveLength(1);
  });

  it('não reemite para orçamento já decidido', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await useCase.execute(comando('cmd-1'));
    const orcamento = (await c.orcamentos.buscarPorOs(OS))!;
    orcamento.reprovar(c.relogio.agora());
    await c.orcamentos.salvar(orcamento);

    await useCase.execute(comando('cmd-2'));
    expect(c.outbox.mensagens).toHaveLength(1);
  });

  it('falha no e-mail não desfaz o orçamento nem o evento', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    c.notificador.falhar = true;
    await useCase.execute(comando());
    expect(await c.orcamentos.buscarPorOs(OS)).not.toBeNull();
    expect(c.outbox.mensagens).toHaveLength(1);
  });

  it('payload que viola o domínio propaga e nada fica gravado', async () => {
    await expect(useCase.execute({ ...comando(), itens: [] })).rejects.toBeInstanceOf(DomainError);
    expect(await c.orcamentos.buscarPorOs(OS)).toBeNull();
    expect(c.processadas.ids.size).toBe(0);
    expect(c.outbox.mensagens).toHaveLength(0);
  });

  afterEach(() => jest.restoreAllMocks());
});
